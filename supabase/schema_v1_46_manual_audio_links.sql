-- P2-A DRAFT: apply only after explicit environment/schema approval. No data backfill.
-- One service-only RPC, no new table/column/index. No Storage or AI operations.
begin;
do $$ begin
  if current_setting('app.manual_audio_schema_target',true) is distinct from 'explicitly-approved' then
    raise exception 'explicit manual audio schema approval required';
  end if;
  if exists(select 1 from (values
    ('newsletter_projects','assignee_name'),('newsletter_projects','status'),('newsletter_projects','deleted_at'),
    ('newsletter_articles','project_id'),('newsletter_articles','audio_id'),('newsletter_articles','audio_source'),
    ('newsletter_articles','ai_audio_id'),('newsletter_articles','tts_generation_state'),('newsletter_articles','updated_at'),
    ('newsletter_audio_files','project_id'),('newsletter_audio_files','article_id'),('newsletter_audio_files','source_type'),
    ('newsletter_audio_files','script_text'),('newsletter_audio_files','script_status'),('newsletter_audio_files','pronunciation_note'),
    ('newsletter_audio_files','transcript_type'),('newsletter_audio_files','updated_at')
  ) required(table_name,column_name) where not exists(select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=required.table_name and c.column_name=required.column_name)) then
    raise exception 'manual audio schema prerequisites missing (including v1.43)';
  end if;
end $$;

create function public.manage_newsletter_manual_audio_link(
  p_project_id uuid, p_audio_id uuid, p_article_id uuid, p_expected_revision text, p_changes jsonb,
  p_actor_id text, p_actor_name text, p_actor_role text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  p public.newsletter_projects%rowtype;
  f public.newsletter_audio_files%rowtype;
  target public.newsletter_articles%rowtype;
  snapshot record;
  old_id uuid; revision text; links jsonb; audio_links jsonb;
  script text; review text; note text; kind text; identical boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise sqlstate '42501' using message='service_role_required'; end if;
  -- Read-only GET does not acquire tuple/write locks. Mutations retain the same
  -- project -> articles -> audio lock order as authoring and TTS completion.
  if p_changes is not null then
    perform 1 from public.newsletter_projects where id=p_project_id and deleted_at is null for update;
    if not found then raise sqlstate 'P0002' using message='manual_audio_not_found'; end if;
    perform 1 from public.newsletter_articles where project_id=p_project_id order by id for update;
    perform 1 from public.newsletter_audio_files where project_id=p_project_id order by id for update;
  end if;
  -- One statement / MVCC snapshot for project identity, file, edges, validation
  -- and revision. Separate unlocked SELECTs could combine pre/post-edit data.
  select project as project_row, file as audio_row, previous.old_id,
    (select coalesce(jsonb_agg(jsonb_build_array(id,audio_id,audio_source,ai_audio_id,tts_generation_state,updated_at) order by id),'[]'::jsonb)
      from public.newsletter_articles where project_id=project.id) as links,
    (select coalesce(jsonb_agg(jsonb_build_array(id,article_id,source_type,updated_at) order by id),'[]'::jsonb)
      from public.newsletter_audio_files where project_id=project.id) as audio_links,
    (exists(select 1 from public.newsletter_articles where audio_id=file.id and
        (project_id<>project.id or (file.article_id is not null and id<>file.article_id))) or
      (select count(*) from public.newsletter_articles where audio_id=file.id)>1 or
      (previous.old_id is not null and not exists(select 1 from public.newsletter_articles
        where id=previous.old_id and project_id=project.id and (audio_id is null or audio_id=file.id))) or
      (previous.old_id is not null and exists(select 1 from public.newsletter_audio_files
        where article_id=previous.old_id and id<>file.id))) as invalid_edges
    into snapshot
    from public.newsletter_projects project
    left join public.newsletter_audio_files file on file.id=p_audio_id and file.project_id=project.id
    left join lateral (select coalesce(file.article_id,(select id from public.newsletter_articles
      where project_id=project.id and audio_id=file.id order by id limit 1)) as old_id) previous on true
    where project.id=p_project_id and project.deleted_at is null;
  if not found then raise sqlstate 'P0002' using message='manual_audio_not_found'; end if;
  p:=snapshot.project_row;
  f:=snapshot.audio_row;
  old_id:=snapshot.old_id;
  links:=snapshot.links;
  audio_links:=snapshot.audio_links;
  if p.status='archived' or nullif(btrim(p_actor_id),'') is null or p_actor_role is null or
    (p_actor_role<>'admin' and (p_actor_role<>'user' or nullif(btrim(p.assignee_name),'') is null or
      regexp_replace(lower(p.assignee_name),'[[:space:]]','','g') not in
      (regexp_replace(lower(p_actor_id),'[[:space:]]','','g'),regexp_replace(lower(coalesce(p_actor_name,'')),'[[:space:]]','','g')))) then
    raise sqlstate '42501' using message='manual_audio_forbidden';
  end if;
  if f.id is null then raise sqlstate 'P0002' using message='manual_audio_not_found'; end if;
  if coalesce(f.source_type,'uploaded')<>'uploaded' then raise sqlstate '22023' using message='manual_audio_invalid'; end if;
  -- Conflicting legacy/cross-project edges are not silently repaired or detached.
  if snapshot.invalid_edges then raise sqlstate 'PT409' using message='manual_audio_conflict'; end if;
  revision:=md5(jsonb_build_array(links,audio_links,to_jsonb(f))::text);
  if p_changes is null then
    return jsonb_build_object('ok',true,'state',jsonb_build_object('revision',revision,'articleId',old_id,
      'transcriptText',coalesce(f.script_text,''),'transcriptType',coalesce(f.transcript_type,'custom_script'),
      'transcriptReviewStatus',coalesce(f.script_status,'pending'),'transcriptReviewNote',coalesce(f.pronunciation_note,'')));
  end if;
  if p_expected_revision is null or p_expected_revision !~ '^[a-f0-9]{32}$' or jsonb_typeof(p_changes)<>'object' or
    exists(select 1 from jsonb_each(p_changes) e where e.key not in ('transcriptText','transcriptType','transcriptReviewStatus','transcriptReviewNote') or jsonb_typeof(e.value)<>'string') then
    raise sqlstate '22023' using message='manual_audio_invalid';
  end if;
  script:=case when p_changes ? 'transcriptText' then nullif(btrim(p_changes->>'transcriptText'),'') else f.script_text end;
  note:=case when p_changes ? 'transcriptReviewNote' then nullif(btrim(p_changes->>'transcriptReviewNote'),'') else f.pronunciation_note end;
  kind:=case when p_changes ? 'transcriptType' then p_changes->>'transcriptType' else f.transcript_type end;
  review:=case when p_changes ? 'transcriptReviewStatus' then p_changes->>'transcriptReviewStatus' else f.script_status end;
  if coalesce(length(script),0)>100000 or coalesce(length(note),0)>5000 or
    (kind is not null and kind not in ('article_original','summary_script','custom_script')) or
    (review is not null and review not in ('pending','approved','needs_revision')) then
    raise sqlstate '22023' using message='manual_audio_invalid';
  end if;
  if p_article_id is not null then
    select * into target from public.newsletter_articles where id=p_article_id and project_id=p.id;
    if not found then raise sqlstate 'P0002' using message='manual_audio_not_found'; end if;
    if target.audio_source='ai_tts' then raise sqlstate 'PT409' using message='manual_audio_ai_selected'; end if;
    if target.tts_generation_state='processing' then raise sqlstate 'PT409' using message='manual_audio_conflict'; end if;
    if (select count(*) from public.newsletter_audio_files where article_id=target.id)>1 or
      exists(select 1 from public.newsletter_audio_files where article_id=target.id and
        (project_id<>p.id or coalesce(source_type,'uploaded')<>'uploaded' or (target.audio_id is not null and id<>target.audio_id))) or
      (target.audio_id is not null and not exists(select 1 from public.newsletter_audio_files where id=target.audio_id
        and project_id=p.id and coalesce(source_type,'uploaded')='uploaded' and (article_id is null or article_id=target.id))) then
      raise sqlstate 'PT409' using message='manual_audio_conflict';
    end if;
  end if;
  identical:=f.article_id is not distinct from p_article_id and f.script_text is not distinct from script
    and f.pronunciation_note is not distinct from note and f.transcript_type is not distinct from kind
    and f.script_status is not distinct from review and
    (case when p_article_id is null then not exists(select 1 from public.newsletter_articles where audio_id=f.id)
      else target.audio_id=f.id and target.audio_source='uploaded' end);
  -- State-idempotent replay: exact desired state is a no-op, even after response loss.
  -- A later differing state is never restored by a stale retry. No receipt ledger is added.
  if identical then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if revision<>p_expected_revision then raise sqlstate 'PT409' using message='manual_audio_conflict'; end if;
  if old_id is not null and old_id is distinct from p_article_id then
    update public.newsletter_articles set audio_id=null,
      audio_source=case when audio_source='ai_tts' then audio_source else 'none' end
      where id=old_id and project_id=p.id;
  end if;
  if p_article_id is not null then
    update public.newsletter_audio_files set article_id=null
      where project_id=p.id and article_id=p_article_id and id<>f.id;
  end if;
  update public.newsletter_audio_files set article_id=p_article_id,script_text=script,script_status=review,
    transcript_type=kind,pronunciation_note=note where id=f.id and project_id=p.id;
  if p_article_id is not null then
    update public.newsletter_articles set audio_id=f.id,audio_source='uploaded' where id=p_article_id and project_id=p.id;
  end if;
  -- ai_audio_id and all TTS generation fields, files and other audio metadata stay untouched.
  return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.manage_newsletter_manual_audio_link(uuid,uuid,uuid,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.manage_newsletter_manual_audio_link(uuid,uuid,uuid,text,jsonb,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
