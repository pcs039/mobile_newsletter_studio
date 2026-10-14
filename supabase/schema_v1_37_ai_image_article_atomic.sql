-- Function-only migration. Staging application requires separate approval.
begin;

create or replace function public.newsletter_ai_image_article_fingerprint(p_article_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select md5(jsonb_build_object(
    'article', (select to_jsonb(a) from public.newsletter_articles a where a.id=p_article_id),
    'blocks', coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from public.newsletter_content_blocks b where b.article_id=p_article_id),'[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.newsletter_link_actions l where l.article_id=p_article_id),'[]'::jsonb)
  )::text)
$$;

create or replace function public.apply_newsletter_ai_image_article_atomic(
  p_project_id uuid, p_article_id uuid, p_action text, p_role text,
  p_asset_id uuid default null, p_expected text default null,
  p_generation_key text default null, p_variant_index integer default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.newsletter_articles%rowtype;
  asset public.newsletter_project_design_assets%rowtype;
  b public.newsletter_content_blocks%rowtype;
  fp text; n integer; position integer; occupied boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('snapshot','apply','revoke') or p_role is null or p_role not in ('hero','body') then
    raise exception 'invalid_ai_image_action' using errcode='22023';
  end if;
  select * into a from public.newsletter_articles where id=p_article_id and project_id=p_project_id for update;
  if not found then raise exception 'ai_image_article_not_found' using errcode='P0002'; end if;
  perform 1 from public.newsletter_content_blocks where article_id=p_article_id order by id for update;
  perform 1 from public.newsletter_link_actions where article_id=p_article_id order by id for update;
  fp := public.newsletter_ai_image_article_fingerprint(p_article_id);
  if p_action='snapshot' then
    return jsonb_build_object('snapshot',fp,'connections',coalesce((
      select jsonb_agg(jsonb_build_object('blockId',id,'assetId',metadata->>'source_asset_id','role',metadata->>'applied_role') order by id)
      from public.newsletter_content_blocks where article_id=p_article_id and block_type='image'
        and metadata->>'managed_by'='ai_image_article_v1' and metadata->>'source'='openai'
    ),'[]'::jsonb));
  end if;
  if p_expected is null or fp <> p_expected then raise exception 'ai_image_snapshot_conflict' using errcode='PT409'; end if;

  select count(*) into n from public.newsletter_content_blocks where article_id=p_article_id
    and metadata->>'managed_by'='ai_image_article_v1' and metadata->>'applied_role'=p_role
    and (p_role='hero' or metadata->>'source_asset_id'=p_asset_id::text);
  if n > 1 then raise exception 'ai_image_connection_conflict' using errcode='PT409'; end if;
  select * into b from public.newsletter_content_blocks where article_id=p_article_id
    and metadata->>'managed_by'='ai_image_article_v1' and metadata->>'applied_role'=p_role
    and (p_role='hero' or metadata->>'source_asset_id'=p_asset_id::text);
  if p_action='revoke' then
    -- Only remove the exact managed connection selected by the operator. Never
    -- delete assets, files, jobs, article copy or unrelated image blocks.
    if b.id is null then return jsonb_build_object('applied',false,'notFound',true,'snapshot',fp); end if;
    if b.block_type is distinct from 'image' or b.asset_id is not null or b.metadata->>'source' is distinct from 'openai'
      or b.metadata->>'generated_for_article_id' is distinct from p_article_id::text
      or b.metadata->>'source_asset_id' is distinct from p_asset_id::text then
      raise exception 'ai_image_connection_conflict' using errcode='PT409';
    end if;
    delete from public.newsletter_content_blocks where id=b.id;
    return jsonb_build_object('applied',false,'blockId',b.id,'snapshot',public.newsletter_ai_image_article_fingerprint(p_article_id));
  end if;

  if exists(select 1 from public.newsletter_content_blocks where article_id=p_article_id
    and is_visible and metadata->>'presentation_mode'='full_layout') or exists(
    select 1 from public.newsletter_content_blocks where article_id=p_article_id and metadata->>'presentation_mode'='image'
  ) then raise exception 'ai_image_canva_or_image_mode_conflict' using errcode='PT409'; end if;
  select * into asset from public.newsletter_project_design_assets where id=p_asset_id for share;
  if not found or asset.project_id is distinct from p_project_id or asset.is_active is distinct from true or asset.approval_status is distinct from 'approved'
    or asset.metadata->>'source' is distinct from 'openai'
    or asset.metadata->'imageGeneration'->>'generatedForArticleId' is distinct from p_article_id::text
    or asset.metadata->'imageGeneration'->>'visualStrategy' is distinct from 'ai_generated_image'
    or asset.metadata->'imageGeneration'->>'generationKey' is distinct from p_generation_key
    or p_generation_key is null or p_generation_key !~ '^[a-f0-9]{64}$'
    or asset.storage_bucket is distinct from 'design-production-assets' or asset.mime_type is distinct from 'image/png'
    or asset.asset_type is null or asset.asset_type not in ('background','illustration') then
    raise exception 'ai_image_asset_not_approved_or_owned' using errcode='42501';
  end if;
  if p_variant_index is not null and p_variant_index not between 1 and 3 then raise exception 'invalid_ai_image_variant' using errcode='22023'; end if;
  if b.id is not null and b.metadata->>'source_asset_id'=p_asset_id::text and b.is_visible then
    return jsonb_build_object('applied',true,'duplicate',true,'blockId',b.id,'snapshot',fp);
  end if;
  if b.id is not null and (b.block_type is distinct from 'image' or b.asset_id is not null or b.metadata->>'source' is distinct from 'openai'
    or b.metadata->>'generated_for_article_id' is distinct from p_article_id::text) then raise exception 'ai_image_connection_conflict' using errcode='PT409'; end if;
  if b.id is null then
    if p_role='hero' then
      -- The renderer lifts this block above the HTML title. No original order
      -- or presentation setting is rewritten.
      select coalesce(max(sort_order),-1)+1 into position from public.newsletter_content_blocks where article_id=p_article_id;
    else
      select sort_order+1 into position from public.newsletter_content_blocks where article_id=p_article_id and block_type='paragraph' order by sort_order,id limit 1;
      if position is null then select coalesce(max(sort_order),-1)+1 into position from public.newsletter_content_blocks where article_id=p_article_id; end if;
      select exists(select 1 from public.newsletter_content_blocks where article_id=p_article_id and sort_order=position) into occupied;
      -- A gap is preferred. If occupied, shift subsequent positions in this
      -- transaction; IDs, text, metadata, links and relative order are retained.
      if occupied then update public.newsletter_content_blocks set sort_order=sort_order+1 where article_id=p_article_id and sort_order>=position; end if;
    end if;
    insert into public.newsletter_content_blocks(project_id,article_id,block_type,title,body,asset_id,sort_order,is_visible,metadata)
      values(p_project_id,p_article_id,'image',a.title,null,null,position,true,'{}'::jsonb) returning * into b;
  end if;
  update public.newsletter_content_blocks set title=a.title,body=null,is_visible=true,metadata=jsonb_build_object(
    'managed_by','ai_image_article_v1','source','openai','source_asset_id',p_asset_id,
    'generated_for_article_id',p_article_id,'visual_strategy','ai_generated_image',
    'generation_key',p_generation_key,'variant_index',p_variant_index,'applied_role',p_role
  ) where id=b.id;
  return jsonb_build_object('applied',true,'duplicate',false,'blockId',b.id,'snapshot',public.newsletter_ai_image_article_fingerprint(p_article_id));
end;
$$;
revoke execute on function public.newsletter_ai_image_article_fingerprint(uuid) from public,anon,authenticated;
revoke execute on function public.apply_newsletter_ai_image_article_atomic(uuid,uuid,text,text,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.newsletter_ai_image_article_fingerprint(uuid) to service_role;
grant execute on function public.apply_newsletter_ai_image_article_atomic(uuid,uuid,text,text,uuid,text,text,integer) to service_role;
commit;
