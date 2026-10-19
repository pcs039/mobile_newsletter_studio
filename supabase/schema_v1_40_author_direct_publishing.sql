-- v1.40 Author direct publishing. Definition / isolated SQL validation only.
-- Do not apply remotely without explicit environment rollout approval.
begin;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='newsletter_project_client_reviews' and column_name='feedback') then
  raise exception 'publication_requires_v1_29_and_v1_30';
 end if;
end; $$;
create table public.newsletter_project_publication_events (
 request_key uuid primary key,
 project_id uuid not null references public.newsletter_projects(id),
 actor_id text not null,
 mode text not null check(mode in ('author_direct','client_review','legacy')),
 action text not null check(action in ('publish','unpublish','status')),
 request_hash text not null,
 checked_revision text not null,
 previous_status text not null,
 new_status text not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index newsletter_publication_events_project_idx on public.newsletter_project_publication_events(project_id,created_at desc);
alter table public.newsletter_project_publication_events enable row level security;
revoke all on public.newsletter_project_publication_events from public,anon,authenticated,service_role;
grant select,insert on public.newsletter_project_publication_events to service_role;
create policy "Service role reads and records publications" on public.newsletter_project_publication_events for all to service_role using(true) with check(true);

-- Raw source stays in the database. Optional prior feature tables need not be installed.
create function public.project_publication_state(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 p public.newsletter_projects%rowtype; sources jsonb; part jsonb; t text;
 visible_count integer; total_count integer; pages_count integer:=0; regular_drafts integer;
 warnings jsonb:='[]'; ebook_ready boolean:=false; doc jsonb; history jsonb;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 select * into p from public.newsletter_projects where id=p_project_id and deleted_at is null;
 if not found then raise exception 'publication_not_found' using errcode='P0002'; end if;
 sources:=jsonb_build_object('project',to_jsonb(p));
 foreach t in array array['newsletter_articles','newsletter_content_blocks','newsletter_link_actions','newsletter_assets','newsletter_audio_files','newsletter_pages','newsletter_project_design_assets','newsletter_project_design_kits','newsletter_article_compositions','newsletter_article_composition_assets','newsletter_article_home_metadata','newsletter_project_home_settings','newsletter_page_hotspot_links','newsletter_image_overlays','newsletter_link_areas'] loop
  if to_regclass('public.'||t) is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='project_id') then
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r where project_id=$1',t) into part using p_project_id;
   sources:=sources||jsonb_build_object(t,part);
  end if;
 end loop;
 select count(*),count(*) filter(where btrim(coalesce(a->>'title',''))<>'' and
  (coalesce(a->>'publication_kind','regular')<>'rolling' or
   (a->>'status'='published' and (nullif(a->>'valid_from','') is null or (a->>'valid_from')::timestamptz<=now()) and (nullif(a->>'valid_until','') is null or (a->>'valid_until')::timestamptz>=now())))),
 count(*) filter(where coalesce(a->>'publication_kind','regular')<>'rolling' and a->>'status'<>'published')
 into total_count,visible_count,regular_drafts from jsonb_array_elements(coalesce(sources->'newsletter_articles','[]')) a;
 select count(*) into pages_count from jsonb_array_elements(coalesce(sources->'newsletter_pages','[]')) x where nullif(x->>'image_path','') is not null;
 doc:=to_jsonb(p);
 ebook_ready:=pages_count>0 or (doc->>'ebook_source'='external' and coalesce(doc->>'external_ebook_url','') ~ '^https?://[^[:space:]]+$');
 if regular_drafts>0 then warnings:=warnings||jsonb_build_array('일반 작성 중 기사도 공식 공개 대상에 포함됩니다.'); end if;
 if exists(select 1 from jsonb_array_elements(coalesce(sources->'newsletter_articles','[]')) a where btrim(coalesce(a->>'summary',''))='' or btrim(coalesce(a->>'body',''))='') then warnings:=warnings||jsonb_build_array('요약 또는 본문이 없는 기사가 있습니다. 저장본 미리보기를 확인하세요.'); end if;
 warnings:=warnings||jsonb_build_array('자산별 승인·활성·공개 조건은 유지됩니다. 표시되지 않는 이미지·디자인이 없는지 저장본을 확인하세요.','발행 후 저장한 기사 수정은 공개 화면에 반영됩니다.');
 select coalesce(jsonb_agg(e order by e->>'createdAt' desc),'[]') into history from
  (select jsonb_build_object('requestKey',request_key,'actorId',actor_id,'mode',mode,'action',action,'status',new_status,'createdAt',created_at,'publishedAt',result->'published_at') e from public.newsletter_project_publication_events where project_id=p_project_id order by created_at desc limit 20) h;
 return jsonb_build_object('revision',md5(sources::text),'status',p.status,'publishedAt',p.published_at,'eligibleArticles',visible_count,'excludedArticles',total_count-visible_count,'ebookReady',ebook_ready,'canPublish',p.status<>'archived' and case when doc->>'project_type'='ebook' then ebook_ready else visible_count>0 or ebook_ready end,'canReviewPublish',p.status in ('in_review','published') and coalesce((select r.status='approved' and r.revoked_at is null from public.newsletter_project_client_reviews r where r.project_id=p_project_id order by requested_at desc,created_at desc,id desc limit 1),false),'warnings',warnings,'history',history);
end; $$;

create function public.transition_project_publication_atomic(
 p_project_id uuid,p_actor_id text,p_actor_name text,p_actor_role text,p_expected_assignee text,
 p_request_key uuid,p_action text,p_mode text,p_expected_revision text,p_confirmed boolean,p_target_status text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 p public.newsletter_projects%rowtype; event public.newsletter_project_publication_events%rowtype;
 state jsonb; result jsonb; request_hash text; target public.project_status;
 review public.newsletter_project_client_reviews%rowtype; publication_time timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if p_request_key is null or nullif(btrim(p_actor_id),'') is null or p_actor_role is null or p_actor_role not in ('admin','user') or p_mode is null or p_mode not in ('author_direct','client_review','legacy') or p_action is null or p_action not in ('publish','unpublish','status') or p_confirmed is distinct from true or p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{32}$' then raise exception 'publication_invalid' using errcode='22023'; end if;
 -- Serialize the request key across projects before locking the project.
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,40));
 select * into p from public.newsletter_projects where id=p_project_id and deleted_at is null for update;
 if not found then raise exception 'publication_not_found' using errcode='P0002'; end if;
 if coalesce(nullif(btrim(p.assignee_name),''),'담당자 미지정') is distinct from p_expected_assignee then raise exception 'publication_assignee_conflict' using errcode='PT409'; end if;
 if p_actor_role<>'admin' and (nullif(btrim(p.assignee_name),'') is null or
  regexp_replace(lower(p.assignee_name),'[[:space:]]','','g') not in (regexp_replace(lower(p_actor_id),'[[:space:]]','','g'),regexp_replace(lower(coalesce(p_actor_name,'')),'[[:space:]]','','g'))) then raise exception 'publication_forbidden' using errcode='42501'; end if;
 request_hash:=md5(jsonb_build_array(p_project_id,p_actor_id,p_actor_name,p_actor_role,p_action,p_mode,p_expected_revision,p_target_status)::text);
 select * into event from public.newsletter_project_publication_events where request_key=p_request_key;
 if found then
  if event.project_id<>p_project_id or event.actor_id<>p_actor_id or event.request_hash<>request_hash then raise exception 'publication_key_conflict' using errcode='PT409'; end if;
  -- This is a receipt, not a claim that the project is still public now.
  return event.result||jsonb_build_object('duplicate',true,'current_status',p.status);
 end if;
 if p.status='archived' then raise exception 'publication_archived' using errcode='23514'; end if;
 state:=public.project_publication_state(p_project_id);
 if state->>'revision'<>p_expected_revision then raise exception 'publication_stale' using errcode='PT409'; end if;
 if p_action='publish' then
  if not (state->>'canPublish')::boolean then raise exception 'publication_not_ready' using errcode='23514'; end if;
  if p_mode='client_review' then
   select * into review from public.newsletter_project_client_reviews where project_id=p_project_id order by requested_at desc,created_at desc,id desc limit 1 for update;
   if not found or review.status<>'approved' or review.revoked_at is not null then raise exception 'client_review_approval_required' using errcode='23514'; end if;
   if p.status not in ('in_review','published') then raise exception 'client_review_project_not_ready' using errcode='23514'; end if;
  elsif p_mode<>'author_direct' then raise exception 'publication_invalid' using errcode='22023'; end if;
  target:='published';publication_time:=clock_timestamp();
 elsif p_action='unpublish' then
  if p.status<>'published' then raise exception 'publication_not_published' using errcode='PT409'; end if;
  target:='private';publication_time:=p.published_at;
 else
  -- Legacy status controls cannot publish or silently unpublish.
  if p_mode<>'legacy' or p.status='published' or p_target_status is null or p_target_status not in ('draft','private','in_review','archived') then raise exception 'publication_status_conflict' using errcode='PT409'; end if;
  target:=p_target_status::public.project_status;publication_time:=p.published_at;
 end if;
 update public.newsletter_projects set status=target,published_at=publication_time,updated_at=clock_timestamp() where id=p_project_id;
 result:=jsonb_build_object('ok',true,'project_id',p.id,'slug',p.slug,'title',p.title,'status',target,'current_status',target,'published_at',publication_time,'request_key',p_request_key,'mode',p_mode,'action',p_action,'duplicate',false);
 insert into public.newsletter_project_publication_events(request_key,project_id,actor_id,mode,action,request_hash,checked_revision,previous_status,new_status,result) values(p_request_key,p.id,p_actor_id,p_mode,p_action,request_hash,p_expected_revision,p.status,target,result);
 return result;
end; $$;

-- Keep the deployed approval-only signature. Legacy clients still require approval.
create or replace function public.publish_project_if_client_approved_atomic(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.newsletter_projects%rowtype; state jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 select * into p from public.newsletter_projects where id=p_project_id and deleted_at is null for update;
 if not found then raise exception 'client_review_project_not_found' using errcode='P0002'; end if;
 state:=public.project_publication_state(p.id);
 return public.transition_project_publication_atomic(p.id,'legacy-server','legacy-server','admin',coalesce(nullif(btrim(p.assignee_name),''),'담당자 미지정'),gen_random_uuid(),'publish','client_review',state->>'revision',true);
end; $$;
create or replace function public.request_client_review_atomic(
  p_project_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_requested_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.newsletter_projects%rowtype;
  v_review public.newsletter_project_client_reviews%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_project_id is null
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at is null
    or p_expires_at <= now()
  then
    raise exception 'client_review_invalid_request' using errcode = '22023';
  end if;

  select project.*
  into v_project
  from public.newsletter_projects project
  where project.id = p_project_id
    and project.deleted_at is null
  for update;

  if not found then
    raise exception 'client_review_project_not_found' using errcode = 'P0002';
  end if;

  if v_project.status in ('archived','published') then
    raise exception 'client_review_project_archived' using errcode = '23514';
  end if;

  update public.newsletter_project_client_reviews review
  set
    status = 'revoked',
    revoked_at = clock_timestamp()
  where review.project_id = p_project_id
    and review.status = 'pending';

  insert into public.newsletter_project_client_reviews (
    project_id,
    token_hash,
    status,
    expires_at,
    requested_by,
    requested_at,
    created_at
  )
  values (
    p_project_id,
    p_token_hash,
    'pending',
    p_expires_at,
    nullif(btrim(p_requested_by), ''),
    clock_timestamp(),
    clock_timestamp()
  )
  returning * into v_review;

  update public.newsletter_projects project
  set status = 'in_review'
  where project.id = p_project_id;

  return jsonb_build_object(
    'ok', true,
    'review_id', v_review.id,
    'project_id', v_review.project_id,
    'status', v_review.status,
    'expires_at', v_review.expires_at,
    'requested_at', v_review.requested_at
  );
end;
$$;

create or replace function public.respond_client_review_atomic(
  p_token_hash text,
  p_decision text,
  p_feedback text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_feedback text := nullif(btrim(replace(replace(p_feedback, chr(13) || chr(10), chr(10)), chr(13), chr(10)), E' \t\n\r\f'), '');
  v_project_id uuid;
  v_project public.newsletter_projects%rowtype;
  v_review public.newsletter_project_client_reviews%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_decision is null
    or p_decision not in ('approved', 'changes_requested')
  then
    raise exception 'client_review_invalid_response' using errcode = '22023';
  end if;

  if char_length(v_feedback) > 2000 or (p_decision = 'approved' and v_feedback is not null) then
    raise exception 'client_review_invalid_feedback' using errcode = '22023';
  end if;

  select review.project_id
  into v_project_id
  from public.newsletter_project_client_reviews review
  where review.token_hash = p_token_hash;

  if v_project_id is null then
    raise exception 'client_review_not_found' using errcode = 'P0002';
  end if;

  select project.*
  into v_project
  from public.newsletter_projects project
  where project.id = v_project_id
    and project.deleted_at is null
  for update;

  if not found then
    raise exception 'client_review_project_not_found' using errcode = 'P0002';
  end if;

  select review.*
  into v_review
  from public.newsletter_project_client_reviews review
  where review.token_hash = p_token_hash
  for update;

  if v_review.status = 'revoked' or v_review.revoked_at is not null then
    raise exception 'client_review_revoked' using errcode = '23514';
  end if;

  if v_review.status <> 'pending' then
    raise exception 'client_review_already_responded' using errcode = '23514';
  end if;

  if v_review.expires_at <= now() then
    raise exception 'client_review_expired' using errcode = '22023';
  end if;

  update public.newsletter_project_client_reviews review
  set
    status = p_decision,
    feedback = case when p_decision = 'changes_requested' then v_feedback else null end,
    responded_at = clock_timestamp()
  where review.id = v_review.id
  returning * into v_review;

  update public.newsletter_projects project
  set status = case when p_decision = 'approved' then 'in_review'::project_status else 'draft'::project_status end
  where project.id = v_project_id and project.status <> 'published';

  return jsonb_build_object(
    'ok', true,
    'review_id', v_review.id,
    'project_id', v_review.project_id,
    'status', v_review.status,
    'responded_at', v_review.responded_at,
    'feedback', v_review.feedback
  );
end;
$$;


create or replace function public.respond_client_review_atomic(p_token_hash text,p_decision text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select public.respond_client_review_atomic(p_token_hash,p_decision,null);
$$;
revoke all on function public.project_publication_state(uuid) from public,anon,authenticated;
grant execute on function public.project_publication_state(uuid) to service_role;
revoke all on function public.transition_project_publication_atomic(uuid,text,text,text,text,uuid,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.transition_project_publication_atomic(uuid,text,text,text,text,uuid,text,text,text,boolean,text) to service_role;
revoke all on function public.publish_project_if_client_approved_atomic(uuid) from public,anon,authenticated;
grant execute on function public.publish_project_if_client_approved_atomic(uuid) to service_role;
revoke all on function public.request_client_review_atomic(uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.request_client_review_atomic(uuid,text,timestamptz,text) to service_role;
revoke all on function public.respond_client_review_atomic(text,text) from public,anon,authenticated;
grant execute on function public.respond_client_review_atomic(text,text) to service_role;
revoke all on function public.respond_client_review_atomic(text,text,text) from public,anon,authenticated;
grant execute on function public.respond_client_review_atomic(text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
