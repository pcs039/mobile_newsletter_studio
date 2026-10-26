-- Staging sample only. No build/deploy migration runner; apply explicitly to the verified ref.
begin;
do $$ begin
  if current_setting('app.sample_participation_target',true) is distinct from 'mvrkpmffuhcqwisqvpqi' then
    raise exception 'verified Staging target required';
  end if;
end $$;

create table public.newsletter_sample_participation_settings (
  project_id uuid primary key references public.newsletter_projects(id) on delete cascade,
  comments_enabled boolean not null default false,
  survey_id uuid references public.newsletter_surveys(id) on delete restrict,
  survey_snapshot jsonb,
  updated_at timestamptz not null default now(),
  check ((survey_id is null) = (survey_snapshot is null))
);
create table public.newsletter_sample_participation (
  id uuid primary key,
  project_id uuid not null references public.newsletter_projects(id) on delete cascade,
  article_id uuid not null references public.newsletter_articles(id) on delete cascade,
  actor_key text not null check(actor_key ~ '^[a-f0-9]{64}$'),
  kind text not null check(kind in ('private','comment','survey')),
  body text,
  answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=12000),
  survey_id uuid references public.newsletter_surveys(id) on delete restrict,
  state text not null check(state in ('private','pending','approved','rejected','recorded')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  reviewed_at timestamptz,
  reviewer_key text check(reviewer_key ~ '^[a-f0-9]{64}$'),
  constraint sample_participation_shape check (
    (kind='private' and state='private' and char_length(body) between 1 and 1000 and body is not null and survey_id is null and answers='{}'::jsonb) or
    (kind='comment' and state in ('pending','approved','rejected') and char_length(body) between 1 and 300 and body is not null and survey_id is null and answers='{}'::jsonb) or
    (kind='survey' and state='recorded' and body is null and survey_id is not null)
  )
);
create index sample_participation_article_idx on public.newsletter_sample_participation(project_id,article_id,created_at desc);
create index sample_participation_actor_idx on public.newsletter_sample_participation(project_id,actor_key,created_at desc);

alter table public.newsletter_sample_participation_settings enable row level security;
alter table public.newsletter_sample_participation enable row level security;
revoke all on public.newsletter_sample_participation_settings,public.newsletter_sample_participation from public,anon,authenticated;
grant select on public.newsletter_sample_participation_settings,public.newsletter_sample_participation to service_role;
create policy sample_settings_service on public.newsletter_sample_participation_settings to service_role using(true) with check(true);
create policy sample_entries_service on public.newsletter_sample_participation to service_role using(true) with check(true);

-- All writes pass the scoped RPCs. No caller-supplied publication/moderation state.
create function public.sample_participation_submit(p_id uuid,p_project_id uuid,p_article_id uuid,p_actor_key text,p_kind text,p_body text,p_answers jsonb,p_survey_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare old public.newsletter_sample_participation%rowtype; cfg public.newsletter_sample_participation_settings%rowtype; result_state text; q record; answer jsonb; question_count integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise sqlstate '42501' using message='server_required'; end if;
  if p_project_id is distinct from '4cd5297e-a0fd-434c-84d4-fa4d3baf9389'::uuid or p_id is null or p_actor_key is null or p_actor_key !~ '^[a-f0-9]{64}$' or p_kind is null or p_kind not in ('private','comment','survey') then raise sqlstate '22023' using message='invalid_participation'; end if;
  perform 1 from public.newsletter_projects where id=p_project_id and slug='hwaseong-2026-10-samples' and status<>'archived' and deleted_at is null for key share;
  if not found then raise sqlstate 'P0002' using message='project_not_found'; end if;
  perform 1 from public.newsletter_articles where id=p_article_id and project_id=p_project_id for key share;
  if not found then raise sqlstate 'P0002' using message='article_not_found'; end if;
  select * into cfg from public.newsletter_sample_participation_settings where project_id=p_project_id for share;
  if not found then raise sqlstate 'P0002' using message='settings_not_found'; end if;
  -- A durable actor lock serializes duplicate requests and rate checks across server instances.
  perform pg_advisory_xact_lock(hashtextextended('sample-participation:'||p_project_id::text||p_actor_key,0));
  select * into old from public.newsletter_sample_participation where id=p_id;
  if found then
    if old.project_id<>p_project_id or old.article_id<>p_article_id or old.actor_key<>p_actor_key or old.kind<>p_kind or old.body is distinct from p_body or old.answers is distinct from p_answers or old.survey_id is distinct from p_survey_id then raise sqlstate 'PT409' using message='request_key_reused'; end if;
    return jsonb_build_object('id',old.id,'state',old.state);
  end if;
  if (select count(*) from public.newsletter_sample_participation where project_id=p_project_id and actor_key=p_actor_key and created_at>now()-interval '1 minute')>=15 or
     (select count(*) from public.newsletter_sample_participation where project_id=p_project_id and article_id=p_article_id and actor_key=p_actor_key and created_at>now()-interval '1 minute')>=5 then raise sqlstate 'PT429' using message='rate_limited'; end if;
  if p_kind='comment' and not cfg.comments_enabled then raise sqlstate '42501' using message='comments_disabled'; end if;
  if p_kind='survey' then
    if p_survey_id is null or cfg.survey_id is distinct from p_survey_id then raise sqlstate 'PT409' using message='survey_changed'; end if;
    if cfg.survey_snapshot->>'status' is distinct from 'open' or (cfg.survey_snapshot->>'start_at')::timestamptz>now() or (cfg.survey_snapshot->>'end_at')::timestamptz<now() then raise sqlstate '22023' using message='survey_closed'; end if;
    if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>12000 then raise sqlstate '22023' using message='invalid_answers'; end if;
    if exists(select 1 from jsonb_object_keys(p_answers) k where not exists(select 1 from jsonb_array_elements(cfg.survey_snapshot->'questions') item where item->>'id'=k)) then raise sqlstate '22023' using message='unknown_question'; end if;
    for q in select * from jsonb_to_recordset(cfg.survey_snapshot->'questions') as x(id uuid,title text,question_type text,options text[],is_required boolean) loop
      question_count:=question_count+1; answer:=p_answers->q.id::text;
      if q.is_required and (answer is null or answer='null'::jsonb or answer='""'::jsonb or answer='[]'::jsonb) then raise sqlstate '22023' using message='required_answer'; end if;
      if answer is null or answer='""'::jsonb or answer='[]'::jsonb then continue; end if;
      if q.question_type='multiple_choice' then
        if jsonb_typeof(answer)<>'array' then raise sqlstate '22023' using message='invalid_choice'; end if;
        if exists(select 1 from jsonb_array_elements(answer) v where jsonb_typeof(v)<>'string' or not (v#>>'{}'=any(q.options))) then raise sqlstate '22023' using message='invalid_choice'; end if;
      else
        if jsonb_typeof(answer)<>'string' or char_length(answer#>>'{}')>500 then raise sqlstate '22023' using message='invalid_answer'; end if;
        if q.question_type='single_choice' and not (answer#>>'{}'=any(q.options)) then raise sqlstate '22023' using message='invalid_choice'; end if;
        if q.question_type='scale' and answer#>>'{}' not in ('1','2','3','4','5') then raise sqlstate '22023' using message='invalid_scale'; end if;
      end if;
    end loop;
    if question_count=0 then raise sqlstate '22023' using message='empty_survey'; end if;
  end if;
  result_state:=case p_kind when 'private' then 'private' when 'comment' then 'pending' else 'recorded' end;
  -- Only this feature's expired demo responses are eligible. No content/assets are touched.
  delete from public.newsletter_sample_participation where project_id=p_project_id and expires_at<now();
  insert into public.newsletter_sample_participation(id,project_id,article_id,actor_key,kind,body,answers,survey_id,state)
    values(p_id,p_project_id,p_article_id,p_actor_key,p_kind,p_body,p_answers,p_survey_id,result_state);
  return jsonb_build_object('id',p_id,'state',result_state);
end $$;

create function public.sample_participation_manage(p_project_id uuid,p_action text,p_id uuid,p_enabled boolean,p_survey_id uuid,p_reviewer_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare snapshot jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise sqlstate '42501' using message='server_required'; end if;
  if p_project_id is distinct from '4cd5297e-a0fd-434c-84d4-fa4d3baf9389'::uuid or p_reviewer_key is null or p_reviewer_key !~ '^[a-f0-9]{64}$' then raise sqlstate '42501' using message='scope_required'; end if;
  perform 1 from public.newsletter_projects where id=p_project_id and deleted_at is null and status<>'archived' for key share;
  if not found then raise sqlstate 'P0002' using message='project_not_found'; end if;
  perform 1 from public.newsletter_sample_participation_settings where project_id=p_project_id for update;
  if p_action='settings' then
    if p_enabled is null then raise sqlstate '22023' using message='enabled_required'; end if;
    if p_survey_id is not null then
      perform 1 from public.newsletter_surveys where id=p_survey_id and project_id=p_project_id for share;
      if not found then raise sqlstate '22023' using message='survey_scope'; end if;
      perform 1 from public.newsletter_survey_questions where survey_id=p_survey_id and project_id=p_project_id order by id for share;
      select jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'status',s.status,'start_at',s.start_at,'end_at',s.end_at,
        'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'question_type',q.question_type,'options',q.options,'is_required',q.is_required) order by q.question_order,q.id),'[]'::jsonb) from public.newsletter_survey_questions q where q.survey_id=s.id and q.project_id=p_project_id)) into snapshot from public.newsletter_surveys s where s.id=p_survey_id and s.project_id=p_project_id;
      if jsonb_array_length(snapshot->'questions') not between 1 and 10 or octet_length(snapshot::text)>20000 then raise sqlstate '22023' using message='survey_limit'; end if;
    end if;
    update public.newsletter_sample_participation_settings set comments_enabled=p_enabled,survey_id=p_survey_id,survey_snapshot=snapshot,updated_at=now() where project_id=p_project_id;
  elsif p_action in ('approve','reject') then
    update public.newsletter_sample_participation set state=case p_action when 'approve' then 'approved' else 'rejected' end,reviewer_key=p_reviewer_key,reviewed_at=now() where id=p_id and project_id=p_project_id and kind='comment' and expires_at>now();
    if not found then raise sqlstate 'P0002' using message='comment_not_found'; end if;
  else raise sqlstate '22023' using message='invalid_action'; end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.sample_participation_submit(uuid,uuid,uuid,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.sample_participation_manage(uuid,text,uuid,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.sample_participation_submit(uuid,uuid,uuid,text,text,text,jsonb,uuid) to service_role;
grant execute on function public.sample_participation_manage(uuid,text,uuid,boolean,uuid,text) to service_role;
commit;
