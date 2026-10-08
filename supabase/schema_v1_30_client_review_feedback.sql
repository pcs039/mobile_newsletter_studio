-- v1.30: One optional plain-text correction note per review response.
-- Apply to Staging for validation. Production requires a separate controlled application.
-- Keep the v1.29 two-argument RPC intact for clients deployed before this migration.
begin;

alter table public.newsletter_project_client_reviews
  add column if not exists feedback text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.newsletter_project_client_reviews'::regclass
      and conname = 'newsletter_project_client_reviews_feedback_check'
  ) then
    alter table public.newsletter_project_client_reviews
      add constraint newsletter_project_client_reviews_feedback_check
      check (feedback is null or (status = 'changes_requested' and char_length(feedback) <= 2000));
  end if;
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
  where project.id = v_project_id;

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

revoke execute on function public.respond_client_review_atomic(text, text, text) from public;
revoke execute on function public.respond_client_review_atomic(text, text, text) from anon;
revoke execute on function public.respond_client_review_atomic(text, text, text) from authenticated;
grant execute on function public.respond_client_review_atomic(text, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
