-- Fixed Staging only. No tables, columns, Storage policies, or ordinary save RPC changes.
begin;
do $$ begin
  if current_setting('app.sample_text_edit_target',true) is distinct from 'mvrkpmffuhcqwisqvpqi' then
    raise exception 'staging_target_required';
  end if;
end $$;

create or replace function public.save_hwaseong_sample_text_atomic(
  p_project_id uuid, p_article_id uuid, p_expected text default null, p_patch jsonb default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.newsletter_articles%rowtype;
  cover public.newsletter_content_blocks%rowtype;
  b public.newsletter_content_blocks%rowtype;
  m jsonb; e jsonb; editable jsonb; state jsonb; revision text; item jsonb;
  original jsonb; next_body text; next_metadata jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_project_id is distinct from '4cd5297e-a0fd-434c-84d4-fa4d3baf9389'::uuid then raise exception 'sample_project_required' using errcode='42501'; end if;
  perform 1 from public.newsletter_projects where id=p_project_id and slug='hwaseong-2026-10-samples' and status='private' for update;
  if not found then raise exception 'private_sample_project_required' using errcode='42501'; end if;
  select * into a from public.newsletter_articles where id=p_article_id and project_id=p_project_id for update;
  if not found then raise exception 'sample_article_not_found' using errcode='P0002'; end if;
  perform 1 from public.newsletter_content_blocks where article_id=a.id order by id for update;
  perform 1 from public.newsletter_link_actions where article_id=a.id order by id for update;
  if (select count(*) from public.newsletter_content_blocks where article_id=a.id and metadata ? 'proposal_sample') <> 1 then
    raise exception 'sample_metadata_required' using errcode='22023';
  end if;
  select * into cover from public.newsletter_content_blocks where article_id=a.id and metadata ? 'proposal_sample';
  m:=cover.metadata->'proposal_sample'; e:=cover.metadata->'proposal_editorial';
  if cover.block_type::text <> 'image' or m->>'version' <> '1' or m->>'kind' not in ('policy','tourism','event','cartoon','accessible','interview','video') then
    raise exception 'unsupported_sample' using errcode='22023';
  end if;
  if m->>'kind' in ('interview','video') and (jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e->'sections') is distinct from 'array') then
    raise exception 'editorial_metadata_required' using errcode='22023';
  end if;
  -- Editorial features render their attributed sections, not the archived aggregate paragraph.
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',coalesce(title,''),'body',coalesce(body,'')) order by sort_order,id),'[]'::jsonb)
    into editable from public.newsletter_content_blocks where article_id=a.id and is_visible and block_type::text='paragraph'
      and m->>'kind' not in ('interview','video')
      and (m->>'kind'<>'tourism' or metadata->>'proposal_tourism_feature'='1')
      and coalesce(title,'') not in ('자료 구분과 확인 안내','원문·사실 확인 안내','원문 정합성 안내');
  revision:=md5(jsonb_build_object('article',to_jsonb(a),
    'blocks',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.newsletter_content_blocks x where article_id=a.id),
    'links',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.newsletter_link_actions x where article_id=a.id))::text);
  state:=jsonb_build_object('revision',revision,'title',m->>'headline','summary',m->>'summary','blocks',editable,
    'sections',case when m->>'kind' in ('interview','video') then e->'sections' else '[]'::jsonb end);
  if p_patch is null then return state; end if;
  if p_expected is distinct from revision then raise exception 'sample_edit_conflict' using errcode='PT409'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_patch))<>4
    or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('title','summary','blocks','sections'))
    or jsonb_typeof(p_patch->'title') is distinct from 'string' or length(btrim(p_patch->>'title')) not between 1 and 200
    or jsonb_typeof(p_patch->'summary') is distinct from 'string' or length(p_patch->>'summary')>499
    or jsonb_typeof(p_patch->'blocks') is distinct from 'array' or jsonb_typeof(p_patch->'sections') is distinct from 'array'
    or jsonb_array_length(p_patch->'blocks')<>jsonb_array_length(editable)
    or jsonb_array_length(p_patch->'sections')<>jsonb_array_length(state->'sections') then
    raise exception 'invalid_sample_text_patch' using errcode='22023';
  end if;
  -- Complete, ordered membership prevents omitted/duplicate/foreign block IDs and structural edits.
  for item in select value from jsonb_array_elements(p_patch->'blocks') loop
    if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>3
      or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','title','body'))
      or not exists(select 1 from jsonb_array_elements(editable) x where x->>'id'=item->>'id')
      or jsonb_typeof(item->'title') is distinct from 'string' or length(item->>'title')>200
      or jsonb_typeof(item->'body') is distinct from 'string' or length(btrim(item->>'body')) not between 1 and 6000 then
      raise exception 'invalid_sample_text_block' using errcode='22023';
    end if;
  end loop;
  if (select jsonb_agg(x->'id' order by n) from jsonb_array_elements(p_patch->'blocks') with ordinality t(x,n))
    is distinct from (select jsonb_agg(x->'id' order by n) from jsonb_array_elements(editable) with ordinality t(x,n)) then
    raise exception 'sample_block_membership_changed' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_patch->'sections') loop
    if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
      or exists(select 1 from jsonb_object_keys(item) k where k not in ('title','text'))
      or jsonb_typeof(item->'title') is distinct from 'string' or length(btrim(item->>'title')) not between 1 and 100
      or jsonb_typeof(item->'text') is distinct from 'string' or length(btrim(item->>'text')) not between 1 and 1800 then
      raise exception 'invalid_sample_editorial_section' using errcode='22023';
    end if;
  end loop;
  if p_patch = state-'revision' then return state||jsonb_build_object('ok',true,'changed',false); end if;
  -- Original sources remain immutable snapshots; subsequent saves never replace them.
  original:=jsonb_build_object('title',a.title,'summary',a.summary,'body',a.body);
  next_metadata:=cover.metadata;
  if not next_metadata ? 'proposal_original_article' then next_metadata:=next_metadata||jsonb_build_object('proposal_original_article',original); end if;
  if m->>'kind' in ('interview','video') then
    if not next_metadata ? 'proposal_original_editorial' then next_metadata:=next_metadata||jsonb_build_object('proposal_original_editorial',e); end if;
    next_metadata:=jsonb_set(next_metadata,'{proposal_editorial,sections}',p_patch->'sections');
    select string_agg((x->>'title')||E'\n'||(x->>'text'),E'\n\n' order by n) into next_body from jsonb_array_elements(p_patch->'sections') with ordinality t(x,n);
  else
    for item in select value from jsonb_array_elements(p_patch->'blocks') loop
      select * into b from public.newsletter_content_blocks where id=(item->>'id')::uuid and article_id=a.id;
      if b.title is distinct from item->>'title' or b.body is distinct from item->>'body' then
        update public.newsletter_content_blocks set title=item->>'title',body=item->>'body',
          metadata=case when metadata ? 'proposal_original_text' then metadata else metadata||jsonb_build_object('proposal_original_text',jsonb_build_object('title',b.title,'body',b.body)) end where id=b.id;
      end if;
    end loop;
    select string_agg(x->>'body',E'\n\n' order by n) into next_body from jsonb_array_elements(p_patch->'blocks') with ordinality t(x,n);
  end if;
  next_metadata:=jsonb_set(next_metadata,'{proposal_sample}',m||jsonb_build_object('headline',p_patch->>'title','summary',p_patch->>'summary','authorEdited',true));
  update public.newsletter_content_blocks set metadata=next_metadata where id=cover.id;
  update public.newsletter_articles set title=p_patch->>'title',summary=p_patch->>'summary',body=coalesce(next_body,a.body) where id=a.id;
  -- Never update audio pointers, voice/request state, assets, links, composition, status or order.
  return public.save_hwaseong_sample_text_atomic(p_project_id,p_article_id)||jsonb_build_object('ok',true,'changed',true);
end $$;
revoke all on function public.save_hwaseong_sample_text_atomic(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_hwaseong_sample_text_atomic(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
