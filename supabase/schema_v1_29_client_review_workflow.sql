-- Mobile Newsletter Studio v1.29
-- Atomic client review requests, responses, and approval-gated publishing.

begin;

create table if not exists public.newsletter_project_client_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.newsletter_projects(id)
    on delete cascade,
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  requested_by text null,
  requested_at timestamptz not null default now(),
  responded_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_project_client_reviews_token_hash_format_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint newsletter_project_client_reviews_status_check
    check (status in ('pending', 'approved', 'changes_requested', 'revoked')),
  constraint newsletter_project_client_reviews_status_timestamps_check
    check (
      (status = 'pending' and responded_at is null and revoked_at is null)
      or (status in ('approved', 'changes_requested') and responded_at is not null and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    )
);

create unique index if not exists newsletter_project_client_reviews_token_hash_key
  on public.newsletter_project_client_reviews(token_hash);

create unique index if not exists newsletter_project_client_reviews_one_pending_idx
  on public.newsletter_project_client_reviews(project_id)
  where status = 'pending';

create index if not exists newsletter_project_client_reviews_project_requested_idx
  on public.newsletter_project_client_reviews(project_id, requested_at desc, id desc);

drop trigger if exists newsletter_project_client_reviews_set_updated_at
  on public.newsletter_project_client_reviews;
create trigger newsletter_project_client_reviews_set_updated_at
before update on public.newsletter_project_client_reviews
for each row execute function public.set_updated_at();

alter table public.newsletter_project_client_reviews enable row level security;

revoke all on table public.newsletter_project_client_reviews from public;
revoke all on table public.newsletter_project_client_reviews from anon;
revoke all on table public.newsletter_project_client_reviews from authenticated;
grant select, insert, update, delete on table public.newsletter_project_client_reviews to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_project_client_reviews'
      and policyname = 'Service role manages client reviews'
  ) then
    create policy "Service role manages client reviews"
      on public.newsletter_project_client_reviews
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

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

  if v_project.status = 'archived' then
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
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
  v_project public.newsletter_projects%rowtype;
  v_review public.newsletter_project_client_reviews%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_decision not in ('approved', 'changes_requested')
  then
    raise exception 'client_review_invalid_response' using errcode = '22023';
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
    responded_at = clock_timestamp()
  where review.id = v_review.id
  returning * into v_review;

  update public.newsletter_projects project
  set status = case when p_decision = 'approved' then 'in_review'::project_status else 'draft'::project_status end
  where project.id = v_project_id;

  return jsonb_build_object(
    'ok', true,
    'review_id', v_review.id,
    'project_id', v_review.project_id,
    'status', v_review.status,
    'responded_at', v_review.responded_at
  );
end;
$$;

create or replace function public.revoke_client_review_atomic(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_project_id is null then
    raise exception 'client_review_project_required' using errcode = '22023';
  end if;

  perform 1
  from public.newsletter_projects project
  where project.id = p_project_id
    and project.deleted_at is null
  for update;

  if not found then
    raise exception 'client_review_project_not_found' using errcode = 'P0002';
  end if;

  update public.newsletter_project_client_reviews review
  set
    status = 'revoked',
    revoked_at = clock_timestamp()
  where review.project_id = p_project_id
    and review.status = 'pending';

  get diagnostics v_review_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'project_id', p_project_id,
    'revoked_count', v_review_count
  );
end;
$$;

create or replace function public.publish_project_if_client_approved_atomic(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.newsletter_projects%rowtype;
  v_review public.newsletter_project_client_reviews%rowtype;
  v_published_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_project_id is null then
    raise exception 'client_review_project_required' using errcode = '22023';
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

  select review.*
  into v_review
  from public.newsletter_project_client_reviews review
  where review.project_id = p_project_id
  order by review.requested_at desc, review.created_at desc, review.id desc
  limit 1
  for update;

  if not found or v_review.status <> 'approved' or v_review.revoked_at is not null then
    raise exception 'client_review_approval_required' using errcode = '23514';
  end if;

  if v_project.status not in ('in_review', 'published') then
    raise exception 'client_review_project_not_ready' using errcode = '23514';
  end if;

  v_published_at := clock_timestamp();

  update public.newsletter_projects project
  set
    status = 'published',
    published_at = v_published_at
  where project.id = p_project_id
  returning * into v_project;

  return jsonb_build_object(
    'ok', true,
    'project_id', v_project.id,
    'slug', v_project.slug,
    'title', v_project.title,
    'status', v_project.status,
    'published_at', v_project.published_at
  );
end;
$$;

revoke execute on function public.request_client_review_atomic(uuid, text, timestamptz, text) from public;
revoke execute on function public.request_client_review_atomic(uuid, text, timestamptz, text) from anon;
revoke execute on function public.request_client_review_atomic(uuid, text, timestamptz, text) from authenticated;
grant execute on function public.request_client_review_atomic(uuid, text, timestamptz, text) to service_role;

revoke execute on function public.respond_client_review_atomic(text, text) from public;
revoke execute on function public.respond_client_review_atomic(text, text) from anon;
revoke execute on function public.respond_client_review_atomic(text, text) from authenticated;
grant execute on function public.respond_client_review_atomic(text, text) to service_role;

revoke execute on function public.revoke_client_review_atomic(uuid) from public;
revoke execute on function public.revoke_client_review_atomic(uuid) from anon;
revoke execute on function public.revoke_client_review_atomic(uuid) from authenticated;
grant execute on function public.revoke_client_review_atomic(uuid) to service_role;

revoke execute on function public.publish_project_if_client_approved_atomic(uuid) from public;
revoke execute on function public.publish_project_if_client_approved_atomic(uuid) from anon;
revoke execute on function public.publish_project_if_client_approved_atomic(uuid) from authenticated;
grant execute on function public.publish_project_if_client_approved_atomic(uuid) to service_role;

commit;
