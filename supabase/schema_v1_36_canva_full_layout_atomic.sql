-- Functions only. Do not apply to Staging or Production without approval.
begin;
create or replace function public.newsletter_full_layout_fingerprint(p_article_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select md5(jsonb_build_object(
    'article', (select to_jsonb(a) from public.newsletter_articles a where a.id=p_article_id),
    'blocks', coalesce((select jsonb_agg(((case when b.metadata->>'managed_by'='canva_full_layout_v1' then to_jsonb(b)-'updated_at' else to_jsonb(b) end)-'metadata') || jsonb_build_object('metadata', b.metadata-'source_snapshot'-'applied_snapshot') order by b.id)
      from public.newsletter_content_blocks b where b.article_id=p_article_id),'[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.newsletter_link_actions l where l.article_id=p_article_id),'[]'::jsonb)
  )::text)
$$;
create or replace function public.apply_newsletter_canva_full_layout_atomic(
  p_project_id uuid, p_article_id uuid, p_action text, p_design_asset_id uuid default null,
  p_template_id text default null, p_expected text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.newsletter_articles%rowtype; asset public.newsletter_project_design_assets%rowtype;
  b public.newsletter_content_blocks%rowtype; fp text; source text; mode text; title_visible boolean; count_blocks integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('snapshot','apply','revoke') then raise exception 'invalid_full_layout_input' using errcode='22023'; end if;
  select * into a from public.newsletter_articles where id=p_article_id and project_id=p_project_id for update;
  if not found then raise exception 'full_layout_article_not_found' using errcode='P0002'; end if;
  perform 1 from public.newsletter_content_blocks where article_id=p_article_id order by id for update;
  perform 1 from public.newsletter_link_actions where article_id=p_article_id order by id for update;
  fp := public.newsletter_full_layout_fingerprint(p_article_id);
  select count(*) into count_blocks from public.newsletter_content_blocks where article_id=p_article_id and metadata->>'presentation_mode'='full_layout';
  if count_blocks > 1 then raise exception 'full_layout_conflict' using errcode='PT409'; end if;
  select * into b from public.newsletter_content_blocks where article_id=p_article_id and metadata->>'presentation_mode'='full_layout';
  if p_action='snapshot' then return jsonb_build_object('snapshot',fp,'blockId',b.id,'assetId',b.metadata->>'design_asset_id','applied',b.id is not null and b.metadata->>'applied_snapshot'=fp); end if;
  if p_expected is null or p_expected !~ '^[a-f0-9]{32}$' or p_design_asset_id is null or p_template_id is null then raise exception 'invalid_full_layout_input' using errcode='22023'; end if;
  if p_action='revoke' then
    if b.id is null then raise exception 'full_layout_not_found' using errcode='P0002'; end if;
    if b.block_type <> 'image' or b.metadata->>'managed_by' <> 'canva_full_layout_v1' or b.metadata->>'design_source' <> 'canva'
      or b.metadata->>'design_asset_id' is distinct from p_design_asset_id::text or b.metadata->>'template_id' is distinct from p_template_id
      or b.metadata->>'applied_snapshot' is distinct from fp or p_expected is distinct from fp
      or coalesce(b.metadata->>'source_snapshot','') !~ '^[a-f0-9]{32}$' then raise exception 'full_layout_conflict' using errcode='PT409'; end if;
    source := b.metadata->>'source_snapshot';
    delete from public.newsletter_content_blocks where id=b.id;
    -- Original rows/presentation metadata were never changed; removing the override
    -- must reveal EXACTLY the original state. Failure rolls the DELETE back.
    if public.newsletter_full_layout_fingerprint(p_article_id) is distinct from source then raise exception 'full_layout_conflict' using errcode='PT409'; end if;
    return jsonb_build_object('ok',true,'applied',false,'snapshot',source,'blockId',b.id);
  end if;
  select * into asset from public.newsletter_project_design_assets where id=p_design_asset_id for share;
  if not found or asset.project_id is distinct from p_project_id or not asset.is_active or asset.approval_status <> 'approved'
    or asset.asset_type <> 'card_frame' or asset.mime_type <> 'image/png' or asset.storage_bucket <> 'design-production-assets'
    or coalesce(asset.storage_path,'')='' or asset.storage_path like '%..%' or asset.storage_path like '/%' or asset.storage_path like '%/'
    or asset.metadata->>'source' is distinct from 'canva' or asset.metadata->'canvaExport'->>'articleId' is distinct from p_article_id::text
    or asset.metadata->'canvaExport'->>'templateId' is distinct from p_template_id or asset.metadata->'canvaExport'->>'format' is distinct from 'png'
    then raise exception 'full_layout_asset_not_allowed' using errcode='42501'; end if;
  if b.id is not null then
    if b.block_type='image' and b.metadata->>'managed_by'='canva_full_layout_v1' and b.metadata->>'design_source'='canva'
      and b.metadata->>'design_asset_id'=p_design_asset_id::text and b.metadata->>'template_id'=p_template_id
      and b.metadata->>'applied_snapshot'=fp and p_expected in (fp,b.metadata->>'source_snapshot') then
      return jsonb_build_object('ok',true,'applied',true,'duplicate',true,'blockId',b.id,'snapshot',fp);
    end if;
    raise exception 'full_layout_conflict' using errcode='PT409';
  end if;
  if p_expected is distinct from fp then raise exception 'full_layout_conflict' using errcode='PT409'; end if;
  select metadata->>'presentation_mode' into mode from public.newsletter_content_blocks where article_id=p_article_id and metadata->>'presentation_mode' in ('text','image','mixed') order by sort_order,id limit 1;
  mode := coalesce(mode,case when exists(select 1 from public.newsletter_content_blocks where article_id=p_article_id and block_type='image') then 'mixed' else 'text' end);
  select (metadata->>'show_public_title')::boolean into title_visible from public.newsletter_content_blocks where article_id=p_article_id and jsonb_typeof(metadata->'show_public_title')='boolean' order by sort_order,id limit 1;
  insert into public.newsletter_content_blocks(project_id,article_id,block_type,title,body,asset_id,link_action_id,sort_order,is_visible,metadata)
    values(p_project_id,p_article_id,'image',a.title,'',null,null,(select coalesce(max(sort_order),-1)+1 from public.newsletter_content_blocks where article_id=p_article_id),true,jsonb_build_object('managed_by','canva_full_layout_v1','presentation_mode','full_layout','show_public_title',false,
      'design_asset_id',p_design_asset_id,'design_source','canva','template_id',p_template_id,'source_snapshot',fp,'previous_presentation',mode,'previous_show_public_title',coalesce(title_visible,true))) returning * into b;
  source := public.newsletter_full_layout_fingerprint(p_article_id);
  update public.newsletter_content_blocks set metadata=metadata || jsonb_build_object('applied_snapshot',source) where id=b.id;
  if public.newsletter_full_layout_fingerprint(p_article_id) <> source then raise exception 'full_layout_snapshot_failure'; end if;
  return jsonb_build_object('ok',true,'applied',true,'duplicate',false,'blockId',b.id,'snapshot',source);
end;
$$;
revoke execute on function public.newsletter_full_layout_fingerprint(uuid) from public,anon,authenticated;
revoke execute on function public.apply_newsletter_canva_full_layout_atomic(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.newsletter_full_layout_fingerprint(uuid) to service_role;
grant execute on function public.apply_newsletter_canva_full_layout_atomic(uuid,uuid,text,uuid,text,text) to service_role;
commit;
