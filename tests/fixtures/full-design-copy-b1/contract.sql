-- ISOLATED CONTRACT PROTOTYPE, NOT A REMOTE MIGRATION.
-- No public-schema RPC, HTTP route, runtime import or deployment hook.
begin;
do $$begin
 if current_database() !~ '^mns_b1_[a-z0-9_]+$'
    or current_setting('newsletter.b1_isolated',true) is distinct from 'on'
    or inet_server_addr() is null or not (inet_server_addr() <<= inet '127.0.0.0/8' or inet_server_addr()=inet '::1') then
  raise exception 'b1_isolated_database_required' using errcode='42501';
 end if;
end$$;
create schema b1_isolated;
revoke all on schema b1_isolated from public,anon,authenticated;
grant usage on schema b1_isolated to service_role;

create table b1_isolated.receipts (
 project_id uuid not null, actor_id text not null, request_key uuid not null,
 request_hash text not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(project_id,actor_id,request_key)
);
alter table b1_isolated.receipts enable row level security;
revoke all on b1_isolated.receipts from public,anon,authenticated,service_role;
-- Receipts are accessed only by the SECURITY DEFINER entry point, not table CRUD.

create function b1_isolated.guard() returns void language plpgsql
set search_path=pg_catalog,public,pg_temp as $$begin
 if current_database() !~ '^mns_b1_[a-z0-9_]+$'
    or current_setting('newsletter.b1_isolated',true) is distinct from 'on'
    or coalesce(auth.role(),'') <> 'service_role'
    or inet_server_addr() is null or not (inet_server_addr() <<= inet '127.0.0.0/8' or inet_server_addr()=inet '::1') then
  raise exception 'b1_isolated_service_role_required' using errcode='42501';
 end if;
end$$;

-- p_actor is supplied ONLY by a future trusted server after HMAC session,
-- same-origin, project password/unlock checks. This is not a browser credential.
create function b1_isolated.authorize(p_project uuid,p_actor jsonb) returns void
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
declare p public.newsletter_projects%rowtype; assignee text;
begin
 perform b1_isolated.guard();
 select * into p from public.newsletter_projects where id=p_project;
 if not found then raise exception 'project_not_found' using errcode='PT404'; end if;
 if jsonb_typeof(p_actor) is distinct from 'object' or coalesce(p_actor->>'id','')=''
    or coalesce(p_actor->>'name','')='' or coalesce(p_actor->>'role','') not in ('admin','user') then
  raise exception 'actor_required' using errcode='42501';
 end if;
 assignee:=regexp_replace(lower(coalesce(p.assignee_name,'')),'[[:space:]]','','g');
 if p_actor->>'role' <> 'admin' and (assignee='' or assignee not in (
  regexp_replace(lower(p_actor->>'id'),'[[:space:]]','','g'),
  regexp_replace(lower(p_actor->>'name'),'[[:space:]]','','g'))) then
  raise exception 'project_forbidden' using errcode='42501';
 end if;
 if p.deleted_at is not null or p.archived_at is not null then
  raise exception 'project_unavailable' using errcode='PT409';
 end if;
end$$;

create function b1_isolated.fingerprint(p_project uuid,p_article uuid) returns text
language sql stable set search_path=pg_catalog,public,pg_temp set timezone='UTC' as $$
 select encode(sha256(convert_to(jsonb_build_object(
  'article',(select to_jsonb(a) from public.newsletter_articles a where a.id=p_article and a.project_id=p_project),
  'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.newsletter_content_blocks b where b.article_id=p_article),
  'links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.newsletter_link_actions l where l.article_id=p_article),
  'project',(select to_jsonb(p) from public.newsletter_projects p where p.id=p_project),
  'composition',(select to_jsonb(c) from public.newsletter_article_compositions c where c.article_id=p_article),
  'placements',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.newsletter_article_composition_assets x
    join public.newsletter_article_compositions c on c.id=x.composition_id where c.article_id=p_article),
  'assets',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.newsletter_project_design_assets d where d.id in (
    select x.asset_id from public.newsletter_article_composition_assets x join public.newsletter_article_compositions c on c.id=x.composition_id where c.article_id=p_article)),
  'fonts',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') from public.font_assets f where f.id in (
    select unnest(array[a.title_font_asset_id,a.body_font_asset_id,a.caption_font_asset_id,a.button_font_asset_id,p.title_font_asset_id,p.body_font_asset_id])
    from public.newsletter_articles a join public.newsletter_projects p on p.id=a.project_id where a.id=p_article)),
  'families',(select coalesce(jsonb_agg(to_jsonb(fm) order by fm.id),'[]') from public.font_families fm where fm.id in (
    select f.family_id from public.font_assets f where f.id in (
      select unnest(array[a.title_font_asset_id,a.body_font_asset_id,a.caption_font_asset_id,a.button_font_asset_id,p.title_font_asset_id,p.body_font_asset_id])
      from public.newsletter_articles a join public.newsletter_projects p on p.id=a.project_id where a.id=p_article)))
 )::text,'UTF8')),'hex');
$$;

-- Lock order: project -> article IDs -> composition article IDs -> placement IDs
-- -> referenced design asset IDs -> font asset IDs -> family IDs.
-- Locks block parent-FK inserts and direct placement mutations as well as RPC edits.
create function b1_isolated.lock_pair(p_project uuid,p_source uuid,p_target uuid) returns void
language plpgsql set search_path=pg_catalog,public,pg_temp as $$begin
 perform 1 from public.newsletter_projects where id=p_project for update;
 begin
  perform 1 from public.newsletter_articles where id in (p_source,p_target) order by id for update nowait;
 exception when lock_not_available then
  raise exception 'design_copy_busy' using errcode='PT409';
 end;
 if p_source is null or p_target is null or p_source=p_target or
   (select count(*) from public.newsletter_articles where id in(p_source,p_target) and project_id=p_project)<>2 then
  raise exception 'article_project_mismatch' using errcode='PT409';
 end if;
 perform 1 from public.newsletter_article_compositions where article_id in(p_source,p_target) order by article_id for update;
 perform 1 from public.newsletter_article_composition_assets where composition_id in(
  select id from public.newsletter_article_compositions where article_id in(p_source,p_target)) order by id for update;
 perform 1 from public.newsletter_project_design_assets where id in (
  select x.asset_id from public.newsletter_article_composition_assets x join public.newsletter_article_compositions c on c.id=x.composition_id
  where c.article_id in(p_source,p_target)) order by id for share;
 perform 1 from public.font_assets where id in (
  select unnest(array[a.title_font_asset_id,a.body_font_asset_id,a.caption_font_asset_id,a.button_font_asset_id,p.title_font_asset_id,p.body_font_asset_id])
  from public.newsletter_articles a join public.newsletter_projects p on p.id=a.project_id where a.id in(p_source,p_target)) order by id for share;
 perform 1 from public.font_families where id in (
  select f.family_id from public.font_assets f where f.id in (
   select unnest(array[a.title_font_asset_id,a.body_font_asset_id,a.caption_font_asset_id,a.button_font_asset_id,p.title_font_asset_id,p.body_font_asset_id])
   from public.newsletter_articles a join public.newsletter_projects p on p.id=a.project_id where a.id in(p_source,p_target))) order by id for share;
end$$;

-- Match JavaScript String.length for astral Unicode, not SQL code point length.
create function b1_isolated.utf16_length(p_text text) returns bigint language sql immutable
set search_path=pg_catalog,pg_temp as $$
 select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0)
 from regexp_split_to_table(p_text,'') as t(ch);
$$;

create function b1_isolated.validate_text(p_value jsonb) returns void language plpgsql
set search_path=pg_catalog,public,pg_temp as $$
declare k text; v jsonb;
begin
 if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'text_design_invalid' using errcode='22023'; end if;
 for k,v in select * from jsonb_each(p_value) loop
  if k in ('captionStyled','subtitleEnabled','numberEnabled','labelEnabled') then
   if jsonb_typeof(v)<>'boolean' then raise exception 'text_boolean_invalid' using errcode='22023'; end if;
  elsif k in ('subtitle','number','label') then
   if jsonb_typeof(v)<>'string' or b1_isolated.utf16_length(v#>>'{}')>(case k when 'subtitle' then 300 when 'number' then 3 else 80 end)
    or (k='number' and btrim(v#>>'{}')<>'' and btrim(v#>>'{}') !~ '^[0-9]{1,3}$') then
    raise exception 'text_content_invalid' using errcode='22023';
   end if;
  elsif k='bodyEmphasis' then
   if v#>>'{}' not in ('none','info','quote') or jsonb_typeof(v)<>'string' then raise exception 'text_emphasis_invalid' using errcode='22023'; end if;
  elsif k='numberShape' then
   if v#>>'{}' not in ('circle','rounded','square') or jsonb_typeof(v)<>'string' then raise exception 'text_shape_invalid' using errcode='22023'; end if;
  else raise exception 'text_key_invalid' using errcode='22023'; end if;
 end loop;
end$$;

create function b1_isolated.validate_placement(p_value jsonb,p_slot text) returns void language plpgsql
set search_path=pg_catalog,public,pg_temp as $$
declare k text; v jsonb; n numeric; lo numeric; hi numeric;
begin
 if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'placement_invalid' using errcode='22023'; end if;
 for k,v in select * from jsonb_each(p_value) loop
  if k in ('titleColor','bodyColor','accentColor','renderMode','surfaceColor','borderColor','borderWidth','borderRadius') and p_slot<>'hero_background' then
   raise exception 'frame_slot_invalid' using errcode='22023'; end if;
  if k in ('titleColor','bodyColor','accentColor','surfaceColor','borderColor') then
   if jsonb_typeof(v)<>'string' or v#>>'{}' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'color_invalid' using errcode='22023'; end if;
  elsif k='renderMode' then
   if jsonb_typeof(v)<>'string' or v#>>'{}' not in ('image','fluid_frame') then raise exception 'render_mode_invalid' using errcode='22023'; end if;
  elsif k='anchor' then
   if jsonb_typeof(v)<>'string' or v#>>'{}' not in ('center','top','bottom','left','right','top_left','top_right','bottom_left','bottom_right') then raise exception 'anchor_invalid' using errcode='22023'; end if;
  elsif k='fit' then
   if jsonb_typeof(v)<>'string' or v#>>'{}' not in ('cover','contain') then raise exception 'fit_invalid' using errcode='22023'; end if;
  elsif k in ('offsetX','offsetY','rotation','opacity','scale','zIndex','borderWidth','borderRadius') then
   if jsonb_typeof(v)<>'number' then raise exception 'number_invalid' using errcode='22023'; end if;
   n:=(v#>>'{}')::numeric;
   lo:=case k when 'offsetX' then -200 when 'offsetY' then -200 when 'rotation' then -180 when 'scale' then 0.25 else 0 end;
   hi:=case k when 'offsetX' then 200 when 'offsetY' then 200 when 'rotation' then 180 when 'opacity' then 1 when 'scale' then 3 when 'zIndex' then 20 when 'borderWidth' then 8 else 48 end;
   if n<lo or n>hi or (k in ('borderWidth','borderRadius') and trunc(n)<>n) then raise exception 'range_invalid' using errcode='22023'; end if;
  else raise exception 'placement_key_invalid' using errcode='22023'; end if;
 end loop;
end$$;

create function b1_isolated.plan(p_project uuid,p_source uuid,p_target uuid) returns jsonb
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
declare p public.newsletter_projects%rowtype; c public.newsletter_article_compositions%rowtype;
 a public.newsletter_articles%rowtype; t public.newsletter_article_compositions%rowtype;
 x record; f record; has_history boolean; src jsonb; dst jsonb; styles jsonb; k text; count_placements int;
begin
 select * into p from public.newsletter_projects where id=p_project;
 -- Fail closed: only never-published draft projects. Private/in_review are not
 -- assumed safe. Existing/future independent-publication integration is separate.
 if p.status::text is distinct from 'draft' or p.published_at is not null then
  raise exception 'unpublished_draft_project_required' using errcode='PT409'; end if;
 if to_regclass('public.newsletter_article_publications') is not null then
  raise exception 'independent_publication_integration_required' using errcode='PT409';
 end if;
 if to_regclass('public.newsletter_project_publication_events') is not null then
  execute 'select exists(select 1 from public.newsletter_project_publication_events where project_id=$1)' into has_history using p_project;
  if has_history then raise exception 'publication_history_not_supported' using errcode='PT409'; end if;
 end if;
 select * into a from public.newsletter_articles where id=p_source;
 select * into c from public.newsletter_article_compositions where article_id=p_source;
 select * into t from public.newsletter_article_compositions where article_id=p_target;
 if c.id is null or c.project_id<>p_project or c.layout_key<>'standard' or (t.id is not null and t.project_id<>p_project) then
  raise exception 'composition_invalid' using errcode='PT409'; end if;
 select count(*) into count_placements from public.newsletter_article_composition_assets where composition_id=c.id;
 if count_placements=0 then raise exception 'source_empty' using errcode='PT409'; end if;
 if count_placements>100 then raise exception 'source_too_large' using errcode='22023'; end if;
 if exists(select 1 from public.newsletter_article_composition_assets where composition_id=c.id
    and slot in('hero_background','hero_illustration','title_icon','footer_banner') group by slot having count(*)>1) then
  raise exception 'single_slot_duplicate' using errcode='22023'; end if;
 for x in select pl.*,d.project_id,d.asset_type,d.is_active,d.approval_status,d.storage_bucket,d.storage_path,d.mime_type
  from public.newsletter_article_composition_assets pl left join public.newsletter_project_design_assets d on d.id=pl.asset_id where pl.composition_id=c.id loop
  if x.project_id is distinct from p_project or x.is_active is distinct from true or coalesce(x.approval_status,'') not in ('draft','approved')
    or x.storage_bucket is distinct from 'design-production-assets' or coalesce(x.storage_path,'')='' or x.storage_path ~ '(^/|\.\.|%|\\|://)'
    or coalesce(x.mime_type,'') not in ('image/png','image/jpeg','image/webp','image/svg+xml')
    or not public.is_newsletter_composition_slot_asset_type_compatible(x.slot,x.asset_type) then
   raise exception 'asset_invalid' using errcode='PT409'; end if;
  perform b1_isolated.validate_placement(x.settings,x.slot);
 end loop;
 for f in select fa.*,fm.is_active family_active,fm.webfont_allowed family_webfont
  from public.font_assets fa left join public.font_families fm on fm.id=fa.family_id where fa.id in (
    a.title_font_asset_id,a.body_font_asset_id,a.caption_font_asset_id,a.button_font_asset_id,p.title_font_asset_id,p.body_font_asset_id) loop
  if not f.is_active or not f.webfont_allowed or coalesce(f.font_file_path,'')='' or f.font_file_path ~ '(^/|\.\.|%|\\|://)'
    or f.font_file_format not in ('ttf','otf','woff','woff2')
    or (f.family_id is not null and (f.family_active is distinct from true or f.family_webfont is distinct from true)) then
   raise exception 'font_invalid' using errcode='PT409'; end if;
 end loop;
 if exists(select 1 from unnest(array[a.title_font_asset_id,a.body_font_asset_id,a.caption_font_asset_id,a.button_font_asset_id,p.title_font_asset_id,p.body_font_asset_id]) as n(font_id)
   where n.font_id is not null and not exists(select 1 from public.font_assets fa where fa.id=n.font_id)) then
  raise exception 'font_missing' using errcode='PT409'; end if;
 if a.text_alignment is not null and a.text_alignment not in ('left','center','right','justify') or
    a.title_alignment is not null and a.title_alignment not in ('left','center','right','justify') or
    a.summary_alignment is not null and a.summary_alignment not in ('left','center','right','justify') or
    a.body_alignment is not null and a.body_alignment not in ('left','center','right','justify') then
  raise exception 'alignment_invalid' using errcode='22023'; end if;
 src:=coalesce(c.settings->'textDesign','{}'); dst:=coalesce(t.settings->'textDesign','{}');
 perform b1_isolated.validate_text(src); perform b1_isolated.validate_text(dst);
 styles:=src-'subtitle'-'number'-'label';
 for k in select unnest(array['subtitle','number','label']) loop
  if dst ? k then styles:=styles||jsonb_build_object(k,dst->k); end if;
  if coalesce(btrim(dst->>k),'')='' and styles->(k||'Enabled')='true'::jsonb then
   styles:=styles||jsonb_build_object(k||'Enabled',false);
  end if;
 end loop;
 if c.settings ? 'productionPattern' and (jsonb_typeof(c.settings->'productionPattern')<>'string' or c.settings->>'productionPattern' not in ('manual','event','policy','interview')) then
  raise exception 'pattern_invalid' using errcode='22023'; end if;
 return jsonb_build_object('textDesign',styles,'productionPattern',coalesce(c.settings->'productionPattern','"manual"'::jsonb),
 'layoutKey',c.layout_key,'placementCount',count_placements);
end$$;

-- One entry point: prepare / execute / result. No route calls this function.
create function b1_isolated.copy_contract(p_action text,p_project uuid,p_source uuid,p_target uuid,
 p_actor jsonb,p_request_key uuid default null,p_expected_source text default null,p_expected_target text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare plan jsonb; source_revision text; target_revision text; request_hash text; receipt b1_isolated.receipts%rowtype;
 c public.newsletter_article_compositions%rowtype; a public.newsletter_articles%rowtype; target_composition uuid; result jsonb;
begin
 perform b1_isolated.guard();
 if p_action is null or p_action not in ('prepare','execute','result') then raise exception 'action_invalid' using errcode='22023'; end if;
 -- Serialize same actor/project/key, before the project-first data lock graph.
 if p_action in ('execute','result') then
  if p_request_key is null then raise exception 'request_key_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project::text||':'||(p_actor->>'id')||':'||p_request_key::text,253));
 end if;
 perform 1 from public.newsletter_projects where id=p_project for update;
 perform b1_isolated.authorize(p_project,p_actor);
 request_hash:=encode(sha256(convert_to(jsonb_build_array(p_source,p_target,p_expected_source,p_expected_target,'full-design-b1-v1')::text,'UTF8')),'hex');
 if p_action in ('execute','result') then
  select * into receipt from b1_isolated.receipts where project_id=p_project and actor_id=p_actor->>'id' and request_key=p_request_key;
  if found then
   if receipt.request_hash<>request_hash then raise exception 'request_key_conflict' using errcode='PT409'; end if;
   return jsonb_build_object('outcome','success','replayed',true,'result',receipt.result);
  elsif p_action='result' then
   return jsonb_build_object('outcome','unknown','reason','no_committed_receipt');
  end if;
 end if;
 perform b1_isolated.lock_pair(p_project,p_source,p_target);
 plan:=b1_isolated.plan(p_project,p_source,p_target);
 source_revision:=b1_isolated.fingerprint(p_project,p_source); target_revision:=b1_isolated.fingerprint(p_project,p_target);
 if p_action='prepare' then return jsonb_build_object('outcome','prepared','sourceRevision',source_revision,'targetRevision',target_revision,'plan',plan); end if;
 if p_expected_source is distinct from source_revision or p_expected_target is distinct from target_revision then
  raise exception 'design_copy_stale' using errcode='PT409'; end if;
 select * into c from public.newsletter_article_compositions where article_id=p_source;
 select * into a from public.newsletter_articles where id=p_source;
 update public.newsletter_articles set title_font_asset_id=a.title_font_asset_id,body_font_asset_id=a.body_font_asset_id,
  caption_font_asset_id=a.caption_font_asset_id,button_font_asset_id=a.button_font_asset_id,text_alignment=a.text_alignment,
  title_alignment=a.title_alignment,summary_alignment=a.summary_alignment,body_alignment=a.body_alignment,updated_at=clock_timestamp()
 where id=p_target;
 insert into public.newsletter_article_compositions(project_id,article_id,layout_key,status,settings)
 values(p_project,p_target,plan->>'layoutKey','draft',jsonb_build_object('textDesign',plan->'textDesign','productionPattern',plan->'productionPattern'))
 on conflict(article_id) do update set layout_key=excluded.layout_key,status='draft',updated_at=clock_timestamp(),
 settings=public.newsletter_article_compositions.settings||excluded.settings
 returning id into target_composition;
 delete from public.newsletter_article_composition_assets where composition_id=target_composition;
 insert into public.newsletter_article_composition_assets(composition_id,asset_id,slot,sort_order,is_visible,settings)
 select target_composition,asset_id,slot,sort_order,is_visible,settings from public.newsletter_article_composition_assets
 where composition_id=c.id order by slot,sort_order,id;
 result:=jsonb_build_object('projectId',p_project,'sourceArticleId',p_source,'targetArticleId',p_target,
  'compositionId',target_composition,'placementCount',plan->'placementCount','status','draft',
  'targetRevision',b1_isolated.fingerprint(p_project,p_target));
 insert into b1_isolated.receipts(project_id,actor_id,request_key,request_hash,result) values(p_project,p_actor->>'id',p_request_key,request_hash,result);
 return jsonb_build_object('outcome','success','replayed',false,'result',result);
end$$;
revoke all on all functions in schema b1_isolated from public,anon,authenticated,service_role;
grant execute on function b1_isolated.copy_contract(text,uuid,uuid,uuid,jsonb,uuid,text,text) to service_role;
commit;
