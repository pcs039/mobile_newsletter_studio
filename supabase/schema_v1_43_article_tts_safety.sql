-- DRAFT ONLY. Explicitly approved isolated database only; never run by build/deploy.
begin;
do $$ begin
  if current_setting('app.article_tts_schema_target',true) is distinct from 'explicitly-approved' then
    raise exception 'explicit article TTS schema approval required';
  end if;
end $$;

alter table public.newsletter_articles
  add column tts_request_id uuid,
  add column tts_request_fingerprint text,
  add column tts_generation_state text check(tts_generation_state in ('processing','ready','failed','unknown')),
  add column tts_started_at timestamptz,
  add constraint article_tts_job_shape check (
    (tts_request_id is null and tts_request_fingerprint is null and tts_generation_state is null and tts_started_at is null) or
    (tts_request_id is not null and tts_request_fingerprint ~ '^[a-f0-9]{64}$' and tts_request_fingerprint is not null and tts_generation_state is not null and tts_started_at is not null)
  );
-- A request UUID cannot dispatch on two different articles, even before audio metadata exists.
create unique index newsletter_articles_tts_request_id_key on public.newsletter_articles(tts_request_id);

create function public.article_tts_claim(p_project_id uuid,p_article_id uuid,p_request_id uuid,
  p_previous_request_id uuid,p_force boolean,p_voice text,p_model text,p_actor_id text,p_actor_name text,p_actor_role text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  p public.newsletter_projects%rowtype; a public.newsletter_articles%rowtype;
  blocks jsonb; source_hash text; input_hash text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise sqlstate '42501' using message='service_role_required'; end if;
  select * into p from public.newsletter_projects where id=p_project_id and deleted_at is null for share;
  if not found then raise sqlstate 'P0002' using message='tts_not_found'; end if;
  if p.status='archived' or nullif(p_actor_id,'') is null or p_actor_role is null or
     (p_actor_role<>'admin' and (p_actor_role<>'user' or nullif(btrim(p.assignee_name),'') is null or regexp_replace(lower(p.assignee_name),'[[:space:]]','','g') not in
       (regexp_replace(lower(p_actor_id),'[[:space:]]','','g'),regexp_replace(lower(coalesce(p_actor_name,'')),'[[:space:]]','','g')))) then
    raise sqlstate '42501' using message='tts_forbidden';
  end if;
  select * into a from public.newsletter_articles where id=p_article_id and project_id=p.id for update;
  if not found then raise sqlstate 'P0002' using message='tts_not_found'; end if;
  if p_request_id is null or p_force is null or p_voice is null or p_voice not in ('marin','cedar','onyx','coral') or
     p_model is null or p_model !~ '^[A-Za-z0-9._-]{1,80}$' then raise sqlstate '22023' using message='tts_invalid'; end if;
  input_hash:=md5(jsonb_build_array(p_voice,p_model)::text);
  if a.tts_request_id=p_request_id then
    if left(a.tts_request_fingerprint,32) is distinct from input_hash then raise sqlstate 'PT409' using message='tts_key_reused'; end if;
    return jsonb_build_object('won',false,'state',a.tts_generation_state,'requestId',a.tts_request_id,'audioId',a.ai_audio_id);
  end if;
  if a.tts_request_id is distinct from p_previous_request_id then raise sqlstate 'PT409' using message='tts_request_changed'; end if;
  if a.tts_generation_state='processing' and (not p_force or a.tts_started_at>clock_timestamp()-interval '6 minutes') then
    return jsonb_build_object('won',false,'state','processing','requestId',a.tts_request_id);
  end if;
  if a.tts_generation_state in ('unknown','failed') and not p_force then
    return jsonb_build_object('won',false,'state',a.tts_generation_state,'requestId',a.tts_request_id);
  end if;
  if a.audio_source is distinct from 'ai_tts' or p_voice is distinct from coalesce(a.article_tts_voice,p.article_tts_voice,'marin') then
    raise sqlstate 'PT409' using message='tts_settings_changed';
  end if;
  if exists(select 1 from public.newsletter_audio_files where id=p_request_id) then raise sqlstate 'PT409' using message='tts_id_in_use'; end if;
  -- Existing article save locks its parent row before replacing blocks. Keep that lock order.
  perform 1 from public.newsletter_content_blocks where article_id=a.id order by id for share;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'block_type',b.block_type,'title',b.title,'body',b.body,
    'sort_order',b.sort_order,'is_visible',b.is_visible) order by b.sort_order,b.id),'[]'::jsonb)
    into blocks from public.newsletter_content_blocks b where b.article_id=a.id;
  source_hash:=md5(jsonb_build_array(a.title,a.body,a.summary,a.audio_source,a.article_tts_voice,a.ai_audio_id,p.article_tts_voice,blocks)::text);
  update public.newsletter_articles set tts_request_id=p_request_id,tts_request_fingerprint=input_hash||source_hash,
    tts_generation_state='processing',tts_started_at=clock_timestamp() where id=a.id;
  return jsonb_build_object('won',true,'state','processing','requestId',p_request_id,'fingerprint',input_hash||source_hash,
    'article',jsonb_build_object('id',a.id,'project_id',p.id,'title',a.title,'body',a.body),'blocks',blocks);
end $$;

create function public.article_tts_complete(p_project_id uuid,p_article_id uuid,p_request_id uuid,p_fingerprint text,
  p_voice text,p_model text,p_text_hash text,p_segments jsonb,p_actor_id text,p_actor_name text,p_actor_role text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  p public.newsletter_projects%rowtype; a public.newsletter_articles%rowtype; blocks jsonb;
  source_hash text; segment jsonb; paths jsonb:='[]'::jsonb; prefix text; i integer:=0; duration integer:=0;
  old_audio public.newsletter_audio_files%rowtype; cleanup jsonb:='[]'::jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise sqlstate '42501' using message='service_role_required'; end if;
  select * into p from public.newsletter_projects where id=p_project_id and deleted_at is null for share;
  if not found then raise sqlstate 'P0002' using message='tts_not_found'; end if;
  if p.status='archived' or nullif(p_actor_id,'') is null or p_actor_role is null or
     (p_actor_role<>'admin' and (p_actor_role<>'user' or nullif(btrim(p.assignee_name),'') is null or regexp_replace(lower(p.assignee_name),'[[:space:]]','','g') not in
       (regexp_replace(lower(p_actor_id),'[[:space:]]','','g'),regexp_replace(lower(coalesce(p_actor_name,'')),'[[:space:]]','','g')))) then
    raise sqlstate '42501' using message='tts_forbidden';
  end if;
  select * into a from public.newsletter_articles where id=p_article_id and project_id=p.id for update;
  if not found then raise sqlstate 'P0002' using message='tts_not_found'; end if;
  if a.tts_request_id is distinct from p_request_id or a.tts_request_fingerprint is distinct from p_fingerprint or
     left(p_fingerprint,32) is distinct from md5(jsonb_build_array(p_voice,p_model)::text) then
    raise sqlstate 'PT409' using message='tts_request_changed';
  end if;
  if a.tts_generation_state='ready' then
    return jsonb_build_object('ok',a.ai_audio_id=p_request_id,'state',case when a.ai_audio_id=p_request_id then 'ready' else 'unknown' end,'requestId',p_request_id,'audioId',a.ai_audio_id);
  end if;
  if a.tts_generation_state<>'processing' then raise sqlstate 'PT409' using message='tts_not_processing'; end if;
  perform 1 from public.newsletter_content_blocks where article_id=a.id order by id for share;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'block_type',b.block_type,'title',b.title,'body',b.body,
    'sort_order',b.sort_order,'is_visible',b.is_visible) order by b.sort_order,b.id),'[]'::jsonb)
    into blocks from public.newsletter_content_blocks b where b.article_id=a.id;
  source_hash:=md5(jsonb_build_array(a.title,a.body,a.summary,a.audio_source,a.article_tts_voice,a.ai_audio_id,p.article_tts_voice,blocks)::text);
  if right(p_fingerprint,32) is distinct from source_hash then
    update public.newsletter_articles set tts_generation_state='failed' where id=a.id;
    return jsonb_build_object('ok',false,'state','failed','code','source_changed','requestId',p_request_id);
  end if;
  if p_text_hash is null or p_text_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_segments) is distinct from 'array' or
     jsonb_array_length(p_segments) not between 1 and 64 then raise sqlstate '22023' using message='tts_invalid_segments'; end if;
  prefix:='ai-tts-v2/'||p.id||'/'||a.id||'/'||p_request_id||'/';
  for segment in select value from jsonb_array_elements(p_segments) loop
    if segment->>'path' is distinct from prefix||lpad(i::text,3,'0')||'.mp3' or
       coalesce(segment->>'hash','') !~ '^[a-f0-9]{64}$' or coalesce((segment->>'size')::integer,0) not between 100 and 8388608 or
       coalesce((segment->>'duration')::integer,0) not between 1 and 1800 then raise sqlstate '22023' using message='tts_invalid_segments'; end if;
    paths:=paths||jsonb_build_array(segment->>'path'); duration:=duration+(segment->>'duration')::integer; i:=i+1;
  end loop;
  insert into public.newsletter_audio_files(id,project_id,article_id,title,file_path,duration_seconds,script_status,source_type,
    transcript_type,ai_tts_audio_paths,ai_tts_text_hash,ai_tts_voice,ai_tts_model,ai_tts_generated_at)
    values(p_request_id,p.id,null,a.title||' AI 음성',paths->>0,duration,'approved','ai_tts','custom_script',paths,p_text_hash,p_voice,p_model,clock_timestamp());
  update public.newsletter_articles set ai_audio_id=p_request_id,tts_generation_state='ready' where id=a.id;
  -- DB-first retirement, only after the new link succeeds. Unknown reference domains retain old data.
  -- A subtransaction isolates cleanup rejection from the new successful audio/link.
  begin
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname ~ '(publication.*revision|publication.*media|article.*revision|media_ledger)') and
      not exists(select 1 from pg_constraint c where c.contype='f' and c.confrelid='public.newsletter_audio_files'::regclass
        and (c.conrelid<>'public.newsletter_articles'::regclass or exists(select 1 from unnest(c.conkey) k
          join pg_attribute att on att.attrelid=c.conrelid and att.attnum=k where att.attname not in ('audio_id','ai_audio_id')))) then
      select * into old_audio from public.newsletter_audio_files where id=a.ai_audio_id and project_id=p.id for update;
      if found and old_audio.source_type='ai_tts' and old_audio.article_id is null and
        not exists(select 1 from public.newsletter_articles where audio_id=old_audio.id or ai_audio_id=old_audio.id) and
        (old_audio.file_path like 'ai-tts/'||p.id||'/'||a.id||'/%' or old_audio.file_path like 'ai-tts-v2/'||p.id||'/'||a.id||'/%') then
        cleanup:=jsonb_build_array(old_audio.file_path)||coalesce(old_audio.ai_tts_audio_paths,'[]'::jsonb);
        delete from public.newsletter_audio_files where id=old_audio.id;
      end if;
    end if;
  exception when others then cleanup:='[]'::jsonb;
  end;
  return jsonb_build_object('ok',true,'state','ready','requestId',p_request_id,'audioId',p_request_id,'segments',i,'cleanupPaths',cleanup);
end $$;

create function public.article_tts_finish(p_project_id uuid,p_article_id uuid,p_request_id uuid,p_state text,
  p_actor_id text,p_actor_name text,p_actor_role text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.newsletter_projects%rowtype; a public.newsletter_articles%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise sqlstate '42501' using message='service_role_required'; end if;
  select * into p from public.newsletter_projects where id=p_project_id and deleted_at is null for share;
  if not found then raise sqlstate 'P0002' using message='tts_not_found'; end if;
  if nullif(p_actor_id,'') is null or p_actor_role is null or
     (p_actor_role<>'admin' and (p_actor_role<>'user' or nullif(btrim(p.assignee_name),'') is null or regexp_replace(lower(p.assignee_name),'[[:space:]]','','g') not in
       (regexp_replace(lower(p_actor_id),'[[:space:]]','','g'),regexp_replace(lower(coalesce(p_actor_name,'')),'[[:space:]]','','g')))) then raise sqlstate '42501' using message='tts_forbidden'; end if;
  select * into a from public.newsletter_articles where id=p_article_id and project_id=p.id for update;
  if not found then raise sqlstate 'P0002' using message='tts_not_found'; end if;
  if a.tts_request_id is distinct from p_request_id then raise sqlstate 'PT409' using message='tts_request_changed'; end if;
  if p_state is null or p_state not in ('failed','unknown') then raise sqlstate '22023' using message='tts_invalid_state'; end if;
  if a.tts_generation_state='processing' then update public.newsletter_articles set tts_generation_state=p_state where id=a.id; a.tts_generation_state:=p_state; end if;
  return jsonb_build_object('state',a.tts_generation_state,'requestId',p_request_id);
end $$;

revoke all on function public.article_tts_claim(uuid,uuid,uuid,uuid,boolean,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.article_tts_complete(uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.article_tts_finish(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.article_tts_claim(uuid,uuid,uuid,uuid,boolean,text,text,text,text,text) to service_role;
grant execute on function public.article_tts_complete(uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text) to service_role;
grant execute on function public.article_tts_finish(uuid,uuid,uuid,text,text,text,text) to service_role;
commit;
