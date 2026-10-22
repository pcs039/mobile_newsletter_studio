-- A2 isolated development only. No remote deployment, Storage or public API.
begin;
do $$begin
 if current_database() !~ '^mns_a1_[a-z0-9_]+$' or inet_server_addr() is null
 or not(inet_server_addr()<<=inet '127.0.0.0/8' or inet_server_addr()=inet '::1') then
 raise exception 'article_publication_isolated_database_required' using errcode='42501';end if;
end$$;

create function public.article_publication_canonical_a2(v jsonb, depth integer default 0) returns text
language plpgsql immutable strict set search_path=pg_catalog,public,pg_temp as $$
declare kind text:=jsonb_typeof(v); n numeric; result text;
begin
 if depth>32 then raise exception 'snapshot_depth' using errcode='22023';end if;
 if kind='number' then
  n:=v::text::numeric;
  if abs(n)>1000000000000 or n<>round(n,6) then raise exception 'snapshot_number' using errcode='22023';end if;
  if n=0 then return '0';end if;
  result:=n::text;if position('.' in result)>0 then result:=rtrim(rtrim(result,'0'),'.');end if;return result;
 elsif kind='array' then
  select '['||coalesce(string_agg(public.article_publication_canonical_a2(value,depth+1),',' order by ord),'')||']' into result from jsonb_array_elements(v) with ordinality e(value,ord);return result;
 elsif kind='object' then
  select '{'||coalesce(string_agg(to_json(key)::text||':'||public.article_publication_canonical_a2(value,depth+1),',' order by key collate "C"),'')||'}' into result from jsonb_each(v);return result;
 else return v::text;end if;
end$$;
create function public.article_publication_hash_a2(v jsonb) returns text
language plpgsql immutable strict set search_path=pg_catalog,public,pg_temp as $$
declare s text:=public.article_publication_canonical_a2(v);
begin if octet_length(s)>1048576 then raise exception 'snapshot_size' using errcode='22023';end if;
return encode(sha256(convert_to(s,'UTF8')),'hex');end$$;
create function public.article_publication_pick_a2(v jsonb, keys text[]) returns jsonb
language sql immutable set search_path=pg_catalog as $$select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(v) where key=any(keys)$$;

-- File IDs are private identity, not a visual change. Hash rendered content
-- against verified byte descriptors so identical replacement remains a no-op.
create function public.article_publication_render_payload_a2(v jsonb,manifest jsonb,depth integer default 0) returns jsonb
language plpgsql immutable set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;entry record;descriptor jsonb;
begin
 if depth>32 then raise exception 'snapshot_depth' using errcode='22023';end if;
 if jsonb_typeof(v)='array' then
  select coalesce(jsonb_agg(public.article_publication_render_payload_a2(value,manifest,depth+1) order by n),'[]') into result from jsonb_array_elements(v) with ordinality e(value,n);return result;
 elsif jsonb_typeof(v)='object' then
  result:='{}';
  for entry in select * from jsonb_each(v) loop
   if depth=0 and entry.key in('provenance','mediaManifest') then continue;end if;
   if entry.key='fileId' then
    select value-array['fileId','role'] into descriptor from jsonb_array_elements(manifest) where value->'fileId'=entry.value;
    if descriptor is null then raise exception 'a2_manifest_membership' using errcode='22023';end if;
    result:=result||jsonb_build_object(entry.key,descriptor);
   else result:=result||jsonb_build_object(entry.key,public.article_publication_render_payload_a2(entry.value,manifest,depth+1));end if;
  end loop;return result;
 end if;return v;
end$$;

create function public.article_publication_authorize_a2(c jsonb, inactive boolean default false) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 perform public.article_publication_lock_authorize((c->>'projectId')::uuid,(c->>'articleId')::uuid,c->>'actorId',c->>'actorName',c->>'actorRole',c->>'assignee',inactive);
end$$;

-- One statement, no REST joins. Retain only allowlisted dependency fields.
create function public.article_publication_capture_a2(p uuid,a uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,pg_temp set timezone='UTC' as $$
with ar as(select * from public.newsletter_articles where id=a and project_id=p),
co as(select * from public.newsletter_article_compositions where article_id=a),
pl as(select x.* from public.newsletter_article_composition_assets x join co on co.id=x.composition_id),
photo_ids as(select asset_id id from public.newsletter_content_blocks where article_id=a and block_type::text='image'),
 design_ids as(select asset_id id from pl),
fi as(select nullif(value,'null')::uuid id from ar, jsonb_each_text(public.article_publication_pick_a2(to_jsonb(ar),array['title_font_asset_id','body_font_asset_id','caption_font_asset_id','button_font_asset_id']))
 union select nullif(value,'null')::uuid from public.newsletter_projects pr,jsonb_each_text(public.article_publication_pick_a2(to_jsonb(pr),array['title_font_asset_id','body_font_asset_id'])) where pr.id=p),
fo as(select f.* from public.font_assets f where f.id in(select id from fi) or f.family_id in(select f2.family_id from public.font_assets f2 where f2.id in(select id from fi)))
select jsonb_build_object(
 'project',(select public.article_publication_pick_a2(to_jsonb(pr),array['id','title','primary_color','title_font_asset_id','body_font_asset_id','article_tts_voice']) from public.newsletter_projects pr where id=p),
 'article',(select public.article_publication_pick_a2(to_jsonb(ar),array['id','project_id','title','display_title','summary','body','text_alignment','title_alignment','summary_alignment','body_alignment','article_type','publication_kind','urgency','motion_preset','motion_speed','contact_name','contact_phone','title_motion_effect','title_motion_speed','text_box_motion_effect','text_box_motion_speed','image_motion_effect','image_motion_speed','link_motion_effect','link_motion_speed','public_info','survey_id','page_id','title_font_asset_id','body_font_asset_id','caption_font_asset_id','button_font_asset_id','audio_source','article_tts_voice','audio_id','ai_audio_id','updated_at']) from ar),
 'blocks',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(b),array['id','project_id','article_id','block_type','title','body','text_alignment','asset_id','link_action_id','sort_order','is_visible','metadata']) order by sort_order,id) from public.newsletter_content_blocks b where article_id=a),'[]'),
 'links',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(l),array['id','project_id','article_id','label','action_type','target_value','display_style','sort_order','is_visible']) order by sort_order,id) from public.newsletter_link_actions l where article_id=a),'[]'),
 'compositions',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(co),array['id','project_id','article_id','status','settings','updated_at']) order by id) from co),'[]'),
 'placements',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(pl),array['id','composition_id','asset_id','slot','settings','sort_order','is_visible']) order by sort_order,id) from pl),'[]'),
 'assets',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(d),array['id','project_id','asset_type','storage_bucket','storage_path','mime_type','is_active','approval_status','updated_at']) order by id) from public.newsletter_project_design_assets d where project_id=p and id in(select id from design_ids)),'[]'),
 'photos',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(ph),array['id','project_id','file_path','mime_type','is_approved','rights_status','quality_status','updated_at'])||jsonb_build_object('storage_bucket',coalesce(to_jsonb(ph)->>'storage_bucket','mobile-assets')) order by id) from public.newsletter_assets ph where project_id=p and id in(select id from photo_ids)),'[]'),
 'fonts',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(fo),array['id','family_id','font_family','font_file_path','font_file_format','font_weight','font_style','detected_weight','detected_style','is_active','webfont_allowed','updated_at'])||jsonb_build_object('storage_bucket',coalesce(to_jsonb(fo)->>'storage_bucket','fonts'),'mime_type','font/'||fo.font_file_format,'css_family_name',coalesce(nullif(fa.css_family_name,''),'DD_Font_'||replace(fo.id::text,'-','_')),'family_active',coalesce(fa.is_active,true),'family_webfont_allowed',coalesce(fa.webfont_allowed,true)) order by fo.id) from fo left join public.font_families fa on fa.id=fo.family_id),'[]'),
 'audio',coalesce((select jsonb_agg(public.article_publication_pick_a2(to_jsonb(au),array['id','project_id','article_id','file_path','script_text','source_type','script_status','ai_tts_audio_paths','ai_tts_text_hash','ai_tts_voice','updated_at'])||jsonb_build_object('storage_bucket',coalesce(to_jsonb(au)->>'storage_bucket','audio-files'),'mime_type',coalesce(to_jsonb(au)->>'mime_type','audio/mpeg')) order by id) from public.newsletter_audio_files au where project_id=p and id in(select audio_id from ar union select ai_audio_id from ar)),'[]')
) from ar
$$;

do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.newsletter_article_publication_revisions'::regclass and contype='c' and pg_get_constraintdef(oid) ~ '(snapshot_schema_version|renderer_version|expected_media_manifest)' loop
 execute format('alter table public.newsletter_article_publication_revisions drop constraint %I',c.conname);end loop;
end$$;
alter table public.newsletter_article_publication_revisions add check(
 (snapshot_schema_version='a1-text-v1' and renderer_version='a1-no-reader' and expected_media_manifest='[]') or
 (snapshot_schema_version='a2-content-v1' and renderer_version='a2-reader-contract-v1' and jsonb_typeof(expected_media_manifest)='array' and jsonb_array_length(expected_media_manifest)<=200));
alter table public.newsletter_article_publication_preparations add column a2_candidate jsonb,add column a2_requirements jsonb;
alter table public.newsletter_article_publication_media drop constraint newsletter_article_publication_media_status_check;
alter table public.newsletter_article_publication_media add check(status in('pending','verified','pinned','deleting','deleted')),
 add column destination_path text unique,add column sha256 text check(sha256 is null or sha256~'^[a-f0-9]{64}$'),
 add column byte_size integer check(byte_size>0 and byte_size<=16777216),add column mime text,
 add column facts jsonb,add column lease_token uuid,add column lease_until timestamptz,
 add column cleanup_confirmed boolean not null default false,
 add column origin_revoked boolean not null default false;
alter table public.newsletter_article_publication_media add check(status='pending' or
 (sha256 is not null and byte_size is not null and destination_path is not null and jsonb_typeof(facts)='object' and mime in('image/png','image/jpeg','image/webp','audio/wav','audio/mpeg','font/ttf','font/otf','font/woff','font/woff2')));

-- Frozen descriptors and orphan ledger lifecycle; no general write grant.
drop trigger article_publication_owned on public.newsletter_article_publication_media;
create function public.article_publication_media_guard_a2() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if tg_op='INSERT' then
  if not exists(select 1 from public.newsletter_article_publication_preparations p where p.id=new.preparation_id and p.article_id=new.article_id and p.project_id=new.project_id) then raise exception 'media_ownership' using errcode='23514';end if;
 elsif (to_jsonb(new)-array['status','preparation_id','frozen_revision_id','lease_token','lease_until','cleanup_confirmed','origin_revoked']) is distinct from (to_jsonb(old)-array['status','preparation_id','frozen_revision_id','lease_token','lease_until','cleanup_confirmed','origin_revoked']) then
  raise exception 'media_immutable' using errcode='23514';
 end if;
 if tg_op='UPDATE' then if old.origin_revoked and not new.origin_revoked then raise exception 'media_revocation_immutable' using errcode='23514';end if;end if;
 if new.frozen_revision_id is not null and new.status<>'pinned' then raise exception 'media_pin_required' using errcode='23514';end if;
 return new;
end$$;
create trigger article_publication_media_guard_a2 before insert or update on public.newsletter_article_publication_media for each row execute function public.article_publication_media_guard_a2();

-- Durable safety tombstones without changing source update/delete outcomes.
-- No historical copy is re-enabled by deleting an inactive source later.
create function public.article_publication_origin_guard_a2() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare doc jsonb;kind text;bad boolean;
begin
 if tg_op='DELETE' then doc:=to_jsonb(old);else doc:=to_jsonb(new);end if;
 kind:=case tg_table_name when 'newsletter_project_design_assets' then 'asset' when 'newsletter_assets' then 'photo' when 'newsletter_audio_files' then 'audio' else 'font' end;
 bad:=case kind when 'asset' then coalesce(doc->>'is_active','false')<>'true' or doc->>'approval_status' is distinct from 'approved'
 when 'photo' then coalesce(doc->>'is_approved','false')<>'true'
 when 'font' then coalesce(doc->>'is_active','false')<>'true' or coalesce(doc->>'webfont_allowed','false')<>'true'
 else doc->>'script_status' is distinct from 'approved' end;
 if tg_op='UPDATE' then
  bad:=bad or new.id is distinct from old.id;
  if kind<>'font' then bad:=bad or to_jsonb(new)->>'project_id' is distinct from to_jsonb(old)->>'project_id';
  elsif tg_table_name='font_assets' then bad:=bad or to_jsonb(new)->>'family_id' is distinct from to_jsonb(old)->>'family_id';end if;
 end if;
 if tg_table_name='font_families' then
  if bad or tg_op='DELETE' then update public.newsletter_article_publication_media m set origin_revoked=true where m.source_descriptor->>'sourceKind'='font' and (m.source_descriptor->>'familyId'=old.id::text or exists(select 1 from public.font_assets f where f.family_id=old.id and f.id::text=m.source_descriptor->>'sourceId'));end if;
 elsif bad or tg_op='DELETE' then
  update public.newsletter_article_publication_media m set origin_revoked=origin_revoked or bad or not cleanup_confirmed
   where m.source_descriptor->>'sourceKind'=kind and m.source_descriptor->>'sourceId'=old.id::text;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end$$;
do $$declare t text;begin foreach t in array array['newsletter_project_design_assets','newsletter_assets','font_assets','font_families','newsletter_audio_files'] loop
 execute format('create trigger article_publication_origin_guard_a2 before update or delete on public.%I for each row execute function public.article_publication_origin_guard_a2()',t);
end loop;end$$;

create function public.prepare_article_publication_a2(c jsonb,k uuid,intent text,historical uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.newsletter_article_publication_preparations;s public.newsletter_article_publications;cap jsonb;h text;
begin
 perform public.article_publication_a1_guard();
 if k is null or intent is null or intent not in('publish','replace','republish') or (historical is not null and intent<>'republish') then raise exception 'a2_invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('a2-prep:'||k::text,0));perform public.article_publication_authorize_a2(c);
 h:=public.article_publication_hash_a2(jsonb_build_array(c,intent,historical));
 select * into p from public.newsletter_article_publication_preparations where preparation_key=k for update;
 if found then
  if p.request_hash<>h then raise exception 'a2_key_conflict' using errcode='PT409';end if;
  if p.expires_at<=clock_timestamp() then raise exception 'a2_expired' using errcode='PT409';end if;
 else
  insert into public.newsletter_article_publications(article_id,project_id) values((c->>'articleId')::uuid,(c->>'projectId')::uuid) on conflict do nothing;
  select * into s from public.newsletter_article_publications where article_id=(c->>'articleId')::uuid for update;
  if not((intent='publish' and s.status='never_published')or(intent='replace' and s.status='published')or(intent='republish' and s.status='withdrawn')) then raise exception 'a2_state_conflict' using errcode='PT409';end if;
  -- Reject opaque metadata before storing a private preparation capture.
  if exists(select 1 from public.newsletter_content_blocks b where b.article_id=s.article_id and
   (jsonb_typeof(coalesce(b.metadata,'{}'))<>'object' or exists(select 1 from jsonb_object_keys(coalesce(b.metadata,'{}')) key where key not in('presentation_mode','show_public_title','body_design'))
    or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(b.metadata->'body_design')='object' then b.metadata->'body_design' else '{}' end) key where key not in('kind','tone','source','enabled'))))
   or exists(select 1 from public.newsletter_article_compositions co where co.article_id=s.article_id and exists(select 1 from jsonb_object_keys(co.settings) key where key<>'textDesign')) then raise exception 'snapshot_unsupported_metadata' using errcode='22023';end if;
  cap:=public.article_publication_capture_a2((c->>'projectId')::uuid,(c->>'articleId')::uuid);
  if historical is not null and not exists(select 1 from public.newsletter_article_publication_events e join public.newsletter_article_publication_revisions r on r.id=e.revision_id where e.revision_id=historical and e.article_id=s.article_id and e.project_id=s.project_id and e.action<>'withdraw' and r.snapshot_schema_version='a2-content-v1') then raise exception 'a2_history_conflict' using errcode='PT409';end if;
  insert into public.newsletter_article_publication_preparations(preparation_key,request_hash,article_id,project_id,actor_id,intent,selection,expected_state_version,source_hash,source_capture,blockers,revision_id,status)
  values(k,h,s.article_id,s.project_id,c->>'actorId',intent,case when historical is null then 'current_draft' else 'historical' end,s.state_version,public.article_publication_hash_a2(cap),cap,'[]',historical,case when historical is null then 'pending' else 'ready' end) returning * into p;
 end if;
 return jsonb_build_object('id',p.id,'capture',p.source_capture,'sourceHash',p.source_hash,'version',p.expected_state_version,'revisionId',p.revision_id,'status',p.status);
end$$;

create function public.stage_article_publication_a2(c jsonb,prep uuid,candidate jsonb,requirements jsonb,source_hash text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.newsletter_article_publication_preparations;r jsonb;source jsonb;table_key text;
begin
 perform public.article_publication_authorize_a2(c);
 select * into p from public.newsletter_article_publication_preparations where id=prep and article_id=(c->>'articleId')::uuid and project_id=(c->>'projectId')::uuid and actor_id=c->>'actorId' for update;
 if not found then raise exception 'a2_not_found' using errcode='PT404';end if;
 if p.status<>'pending' or p.expires_at<=clock_timestamp() then raise exception 'a2_expired' using errcode='PT409';end if;
 if p.source_hash<>source_hash or public.article_publication_hash_a2(public.article_publication_capture_a2(p.project_id,p.article_id))<>source_hash then raise exception 'a2_source_stale' using errcode='PT409';end if;
 if candidate->>'snapshotSchemaVersion' is distinct from 'a2-content-v1' or candidate->>'rendererVersion' is distinct from 'a2-reader-contract-v1' or candidate->>'canonicalVersion' is distinct from 'a2-canonical-v1'
 or candidate->>'articleId' is distinct from p.article_id::text or candidate->>'projectId' is distinct from p.project_id::text
 or jsonb_typeof(requirements) is distinct from 'array' or jsonb_array_length(requirements)>200 or jsonb_typeof(candidate->'mediaRefs') is distinct from 'array' or jsonb_array_length(requirements)<>jsonb_array_length(candidate->'mediaRefs') then raise exception 'a2_candidate_invalid' using errcode='22023';end if;
 perform public.article_publication_hash_a2(candidate);
 if p.a2_candidate is not null then
  if p.a2_candidate<>candidate or p.a2_requirements<>requirements then raise exception 'a2_candidate_conflict' using errcode='PT409';end if;return;
 end if;
 if (select count(distinct value->>'fileId') from jsonb_array_elements(requirements))<>jsonb_array_length(requirements) then raise exception 'a2_duplicate_file' using errcode='22023';end if;
 for r in select value from jsonb_array_elements(requirements) loop
  table_key:=case r->>'sourceKind' when 'asset' then 'assets' when 'photo' then 'photos' when 'font' then 'fonts' when 'audio' then 'audio' end;
  select value into source from jsonb_array_elements(p.source_capture->table_key) where value->>'id'=r->>'sourceId';
  if source is null or (r->>'sourceKind'='font' and source->>'family_id' is distinct from r->>'familyId') or r->>'bucket' is distinct from 'a2-isolated-source' or source->>'storage_bucket' is distinct from r->>'bucket'
   or r->>'mime' is distinct from source->>'mime_type' or r->>'path' not like 'projects/'||p.project_id::text||'/%' or r->>'path'~'(^|/)[.]{1,2}(/|$)|[%\\?#:]'
   or not coalesce((source->>'storage_path'=r->>'path' or source->>'font_file_path'=r->>'path' or source->>'file_path'=r->>'path' or (source->'ai_tts_audio_paths') ? (r->>'path')),false)
   or not exists(select 1 from jsonb_array_elements(candidate->'mediaRefs') m where m->>'fileId'=r->>'fileId' and m->>'role'=r->>'role') then raise exception 'a2_media_source_invalid' using errcode='22023';end if;
 end loop;
 update public.newsletter_article_publication_preparations set a2_candidate=candidate,a2_requirements=requirements where id=prep;
end$$;

create function public.reserve_article_media_a2(c jsonb,prep uuid,file_id uuid,hash text,bytes integer,mime_type text,details jsonb,lease uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.newsletter_article_publication_preparations;r jsonb;m public.newsletter_article_publication_media;path text;
begin
 perform public.article_publication_authorize_a2(c);
 select * into p from public.newsletter_article_publication_preparations where id=prep and article_id=(c->>'articleId')::uuid and project_id=(c->>'projectId')::uuid and actor_id=c->>'actorId' for update;
 if not found or p.status<>'pending' or p.expires_at<=clock_timestamp() or lease is null then raise exception 'a2_preparation_conflict' using errcode='PT409';end if;
 select value into r from jsonb_array_elements(p.a2_requirements) where value->>'fileId'=file_id::text;
 if r is null or hash!~'^[a-f0-9]{64}$' or hash is null or bytes is null or bytes<1 or bytes>16777216 or mime_type is null or mime_type not in('image/png','image/jpeg','image/webp','audio/wav','audio/mpeg','font/ttf','font/otf','font/woff','font/woff2') or r->>'mime' is distinct from mime_type or jsonb_typeof(details) is distinct from 'object' then raise exception 'a2_media_invalid' using errcode='22023';end if;
 path:='projects/'||p.project_id||'/articles/'||p.article_id||'/preparations/'||prep||'/'||file_id||'/'||hash;
 select * into m from public.newsletter_article_publication_media where id=file_id for update;
 if found then
  if m.preparation_id is distinct from prep or m.sha256<>hash or m.byte_size<>bytes or m.mime<>mime_type or m.facts<>details or m.status in('deleting','deleted') then raise exception 'a2_media_conflict' using errcode='PT409';end if;
  if m.lease_until>clock_timestamp() and m.lease_token<>lease then raise exception 'a2_media_busy' using errcode='PT409';end if;
  update public.newsletter_article_publication_media set lease_token=lease,lease_until=clock_timestamp()+interval '1 minute' where id=file_id;
 else
  insert into public.newsletter_article_publication_media(id,preparation_id,article_id,project_id,role,source_descriptor,destination_path,sha256,byte_size,mime,facts,lease_token,lease_until)
  values(file_id,prep,p.article_id,p.project_id,r->>'role',r,path,hash,bytes,mime_type,details,lease,clock_timestamp()+interval '1 minute');
 end if;
 return jsonb_build_object('path',path,'status',coalesce(m.status,'pending'));
end$$;

create function public.verify_article_media_a2(c jsonb,prep uuid,file_id uuid,lease uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 perform public.article_publication_authorize_a2(c);
 if not exists(select 1 from public.newsletter_article_publication_preparations where id=prep and actor_id=c->>'actorId' and status='pending' and expires_at>clock_timestamp()) then raise exception 'a2_preparation_conflict' using errcode='PT409';end if;
 update public.newsletter_article_publication_media set status='verified' where id=file_id and preparation_id=prep and project_id=(c->>'projectId')::uuid and article_id=(c->>'articleId')::uuid and lease_token=lease and lease_until>clock_timestamp() and status in('pending','verified');
 if not found then raise exception 'a2_media_lease_conflict' using errcode='PT409';end if;
end$$;

create function public.article_media_policy_a2(m public.newsletter_article_publication_media) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare source jsonb;kind text:=m.source_descriptor->>'sourceKind';
begin
 if m.origin_revoked then return false;end if;
 if kind='asset' then select to_jsonb(a) into source from public.newsletter_project_design_assets a where a.id=(m.source_descriptor->>'sourceId')::uuid and a.project_id=m.project_id;
  if found then return source->>'is_active'='true' and source->>'approval_status'='approved';end if;
 elsif kind='photo' then select to_jsonb(a) into source from public.newsletter_assets a where a.id=(m.source_descriptor->>'sourceId')::uuid and a.project_id=m.project_id;
  if found then return source->>'is_approved'='true';end if;
 elsif kind='font' then select to_jsonb(f)||jsonb_build_object('family_active',coalesce(fa.is_active,true),'family_webfont_allowed',coalesce(fa.webfont_allowed,true)) into source from public.font_assets f left join public.font_families fa on fa.id=f.family_id where f.id=(m.source_descriptor->>'sourceId')::uuid;
  if found then return source->>'is_active'='true' and source->>'webfont_allowed'='true' and source->>'family_active'='true' and source->>'family_webfont_allowed'='true';end if;
 elsif kind='audio' then select to_jsonb(a) into source from public.newsletter_audio_files a where a.id=(m.source_descriptor->>'sourceId')::uuid and a.project_id=m.project_id;
  if found then return source->>'script_status'='approved';end if;
 end if;
 return m.cleanup_confirmed;
end$$;

create function public.finalize_article_publication_a2(c jsonb,prep uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.newsletter_article_publication_preparations;s public.newsletter_article_publications;manifest jsonb;r uuid;v_snapshot jsonb;
begin
 perform public.article_publication_authorize_a2(c);
 select * into s from public.newsletter_article_publications where article_id=(c->>'articleId')::uuid for update;
 select * into p from public.newsletter_article_publication_preparations where id=prep and article_id=s.article_id and project_id=s.project_id and actor_id=c->>'actorId' for update;
 if not found or p.expires_at<=clock_timestamp() or p.expected_state_version<>s.state_version then raise exception 'a2_preparation_conflict' using errcode='PT409';end if;
 if p.status in('ready','committed') then return jsonb_build_object('revisionId',p.revision_id,'duplicate',true);end if;
 if p.a2_candidate is null or public.article_publication_hash_a2(public.article_publication_capture_a2(p.project_id,p.article_id))<>p.source_hash then raise exception 'a2_source_stale' using errcode='PT409';end if;
 perform 1 from public.newsletter_article_publication_media where preparation_id=prep order by id for update;
 if (select count(*) from public.newsletter_article_publication_media where preparation_id=prep)<>jsonb_array_length(p.a2_requirements)
 or exists(select 1 from public.newsletter_article_publication_media m where preparation_id=prep and (status<>'verified' or not coalesce(public.article_media_policy_a2(m),false))) then raise exception 'a2_media_not_ready' using errcode='PT409';end if;
 select coalesce(jsonb_agg(jsonb_build_object('fileId',id,'role',role,'sha256',sha256,'bytes',byte_size,'mime',mime,'facts',facts) order by role collate "C",id),'[]') into manifest from public.newsletter_article_publication_media where preparation_id=prep;
 v_snapshot:=p.a2_candidate||jsonb_build_object('mediaManifest',manifest);
 insert into public.newsletter_article_publication_revisions(project_id,article_id,revision_no,snapshot_schema_version,renderer_version,source_hash,payload_hash,snapshot,expected_media_manifest,created_by)
 select p.project_id,p.article_id,coalesce(max(revision_no),0)+1,'a2-content-v1','a2-reader-contract-v1',p.source_hash,public.article_publication_hash_a2(public.article_publication_render_payload_a2(v_snapshot,manifest)),v_snapshot,manifest,p.actor_id from public.newsletter_article_publication_revisions where article_id=p.article_id returning id into r;
 update public.newsletter_article_publication_preparations set revision_id=r,status='ready' where id=prep;
 return jsonb_build_object('revisionId',r,'duplicate',false);
end$$;

create function public.transition_article_publication_a2(c jsonb,k uuid,action text,version bigint,prep uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.newsletter_article_publication_preparations;s public.newsletter_article_publications;r public.newsletter_article_publication_revisions;e public.newsletter_article_publication_events;
 h text;result jsonb;target text;changed_time timestamptz:=clock_timestamp();
begin
 perform public.article_publication_a1_guard();
 if k is null or action is null or action not in('publish','replace','withdraw','republish') or version is null or (action='withdraw')<>(prep is null) then raise exception 'a2_invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('a2-transition:'||k,0));perform public.article_publication_authorize_a2(c,action='withdraw');
 select * into s from public.newsletter_article_publications where article_id=(c->>'articleId')::uuid for update;
 if not found then raise exception 'a2_state_conflict' using errcode='PT409';end if;
 h:=public.article_publication_hash_a2(jsonb_build_array(c,action,version,prep));
 select * into e from public.newsletter_article_publication_events where request_key=k;
 if found then if e.request_hash<>h then raise exception 'a2_key_conflict' using errcode='PT409';end if;return e.result||jsonb_build_object('duplicate',true,'currentStatus',s.status,'currentVersion',s.state_version);end if;
 if s.state_version<>version or not((action='publish' and s.status='never_published')or(action in('replace','withdraw') and s.status='published')or(action='republish' and s.status='withdrawn')) then raise exception 'a2_state_conflict' using errcode='PT409';end if;
 if action<>'withdraw' then
  select * into p from public.newsletter_article_publication_preparations where id=prep and article_id=s.article_id and project_id=s.project_id and actor_id=c->>'actorId' for update;
  if not found or p.status<>'ready' or p.intent<>action or p.expected_state_version<>version or p.expires_at<=clock_timestamp() then raise exception 'a2_preparation_conflict' using errcode='PT409';end if;
  if p.selection='current_draft' and public.article_publication_hash_a2(public.article_publication_capture_a2(s.project_id,s.article_id))<>p.source_hash then raise exception 'a2_source_stale' using errcode='PT409';end if;
  select * into r from public.newsletter_article_publication_revisions where id=p.revision_id and article_id=s.article_id and project_id=s.project_id and snapshot_schema_version='a2-content-v1';
  if not found then raise exception 'a2_revision_invalid' using errcode='PT409';end if;
  perform 1 from public.newsletter_article_publication_media m where m.id in(select (x->>'fileId')::uuid from jsonb_array_elements(r.expected_media_manifest) x) order by id for update;
  if exists(select 1 from jsonb_array_elements(r.expected_media_manifest) x left join public.newsletter_article_publication_media m on m.id=(x->>'fileId')::uuid where m.id is null or m.project_id<>s.project_id or m.article_id<>s.article_id or m.status not in('verified','pinned') or (m.status='pinned' and m.frozen_revision_id<>r.id) or not coalesce(public.article_media_policy_a2(m),false)) then raise exception 'a2_media_not_ready' using errcode='PT409';end if;
  if action='replace' and r.payload_hash=(select payload_hash from public.newsletter_article_publication_revisions where id=s.active_revision_id) then
   return jsonb_build_object('unchanged',true,'currentStatus',s.status,'currentVersion',s.state_version,'duplicate',false);
  end if;
  update public.newsletter_article_publication_media m set status='pinned',frozen_revision_id=r.id,lease_until=null where m.id in(select (x->>'fileId')::uuid from jsonb_array_elements(r.expected_media_manifest) x);
 else select * into r from public.newsletter_article_publication_revisions where id=s.active_revision_id;end if;
 target:=case when action='withdraw' then 'withdrawn' else 'published' end;
 update public.newsletter_article_publications set status=target,state_version=version+1,active_revision_id=case when target='published' then r.id else null end,last_published_revision_id=r.id,first_published_at=coalesce(first_published_at,changed_time),last_published_at=case when target='published' then changed_time else last_published_at end,withdrawn_at=case when target='withdrawn' then changed_time else null end,updated_at=changed_time where article_id=s.article_id;
 result:=jsonb_build_object('status',target,'revisionId',r.id,'version',version+1,'executedAt',changed_time,'duplicate',false);
 insert into public.newsletter_article_publication_events(request_key,project_id,article_id,actor_id,action,request_hash,previous_status,new_status,previous_version,new_version,revision_id,result) values(k,s.project_id,s.article_id,c->>'actorId',action,h,s.status,target,version,version+1,r.id,result);
 if prep is not null then update public.newsletter_article_publication_preparations set status='committed' where id=prep;end if;
 return result||jsonb_build_object('currentStatus',target,'currentVersion',version+1);
end$$;

-- Internal decision only. Not an HTTP API and not an authentication bypass.
create function public.article_publication_file_access_a2(project uuid,article uuid,revision uuid,file_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare m public.newsletter_article_publication_media;
begin
 perform public.article_publication_a1_guard();
 if not exists(select 1 from public.newsletter_article_publications s join public.newsletter_projects p on p.id=s.project_id join public.newsletter_articles a on a.id=s.article_id and a.project_id=s.project_id join public.newsletter_article_publication_revisions r on r.id=s.active_revision_id
  where s.article_id=article and s.project_id=project and s.status='published' and s.active_revision_id=revision and p.deleted_at is null and p.status::text<>'archived' and coalesce(a.status,'')<>'archived' and to_jsonb(a)->>'deleted_at' is null and r.snapshot_schema_version='a2-content-v1' and r.renderer_version='a2-reader-contract-v1' and exists(select 1 from jsonb_array_elements(r.expected_media_manifest) x where x->>'fileId'=file_id::text)) then return jsonb_build_object('allowed',false);end if;
 select * into m from public.newsletter_article_publication_media where id=file_id and project_id=project and article_id=article and frozen_revision_id=revision and status='pinned';
 if not found or not coalesce(public.article_media_policy_a2(m),false) then return jsonb_build_object('allowed',false);end if;
 return jsonb_build_object('allowed',true,'path',m.destination_path,'sha256',m.sha256,'bytes',m.byte_size,'mime',m.mime);
end$$;

create function public.article_publication_gc_a2(file_id uuid,token uuid,finish boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare m public.newsletter_article_publication_media;p public.newsletter_article_publication_preparations;
begin
 perform public.article_publication_a1_guard();select * into m from public.newsletter_article_publication_media where id=file_id for update;
 if not found or token is null then raise exception 'a2_not_found' using errcode='PT404';end if;
 if m.frozen_revision_id is not null or m.status='pinned' or exists(select 1 from public.newsletter_article_publication_revisions r where exists(select 1 from public.newsletter_article_publication_events e where e.revision_id=r.id) and r.expected_media_manifest @> jsonb_build_array(jsonb_build_object('fileId',file_id))) then raise exception 'a2_gc_pinned' using errcode='PT409';end if;
 if m.status='deleted' then return jsonb_build_object('path',m.destination_path,'status','deleted');end if;
 if finish then
  if m.status<>'deleting' or m.lease_token<>token then raise exception 'a2_gc_lease' using errcode='PT409';end if;
  update public.newsletter_article_publication_media set status='deleted',lease_until=null where id=file_id;
 else
  select * into p from public.newsletter_article_publication_preparations where id=m.preparation_id;
  -- One-day grace is isolated-test policy only. No remote retention policy approved.
  if (p.id is not null and p.expires_at>clock_timestamp()-interval '1 day') or (p.id is null and m.created_at>clock_timestamp()-interval '1 day') or (m.lease_until>clock_timestamp() and m.lease_token<>token) then raise exception 'a2_gc_not_eligible' using errcode='PT409';end if;
  update public.newsletter_article_publication_media set status='deleting',lease_token=token,lease_until=clock_timestamp()+interval '1 minute' where id=file_id;
 end if;
 return jsonb_build_object('path',m.destination_path,'status',case when finish then 'deleted' else 'deleting' end);
end$$;

create function public.confirm_article_source_cleanup_a2(c jsonb,file_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 perform public.article_publication_authorize_a2(c,true);
 update public.newsletter_article_publication_media set cleanup_confirmed=true where id=file_id and project_id=(c->>'projectId')::uuid and article_id=(c->>'articleId')::uuid and status='pinned';
 if not found then raise exception 'a2_cleanup_not_pinned' using errcode='PT409';end if;
end$$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%_a2' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname in('prepare_article_publication_a2','stage_article_publication_a2','reserve_article_media_a2','verify_article_media_a2','finalize_article_publication_a2','transition_article_publication_a2','article_publication_file_access_a2','article_publication_gc_a2','confirm_article_source_cleanup_a2') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end$$;
commit;
