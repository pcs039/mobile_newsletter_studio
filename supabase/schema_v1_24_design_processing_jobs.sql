-- Mobile Newsletter Studio v1.24
-- Provider-neutral design processing job and output history foundation.

begin;

create table if not exists public.newsletter_design_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.newsletter_projects(id)
    on delete cascade,
  input_asset_id uuid null
    references public.newsletter_project_design_assets(id)
    on delete set null,
  provider text not null
    check (provider in ('adobe_illustrator', 'adobe_photoshop', 'adobe_express', 'canva', 'ai')),
  operation text not null
    check (
      operation in (
        'adobe_illustrator_rendition',
        'adobe_illustrator_trace',
        'adobe_photoshop_rendition',
        'adobe_photoshop_remove_background',
        'adobe_express_edit',
        'canva_design',
        'canva_export',
        'ai_generate_asset'
      )
    ),
  constraint newsletter_design_processing_jobs_provider_operation_check
    check (
      (provider = 'adobe_illustrator' and operation in ('adobe_illustrator_rendition', 'adobe_illustrator_trace'))
      or (provider = 'adobe_photoshop' and operation in ('adobe_photoshop_rendition', 'adobe_photoshop_remove_background'))
      or (provider = 'adobe_express' and operation = 'adobe_express_edit')
      or (provider = 'canva' and operation in ('canva_design', 'canva_export'))
      or (provider = 'ai' and operation = 'ai_generate_asset')
    ),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
  external_job_id text null
    check (external_job_id is null or char_length(external_job_id) <= 255),
  status_url text null
    check (
      status_url is null
      or (
        char_length(status_url) <= 2048
        and status_url ~ '^https://'
        and position('?' in status_url) = 0
        and position('#' in status_url) = 0
      )
    ),
  request_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_payload) = 'object'),
  result_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result_payload) = 'object'),
  error_code text null
    check (error_code is null or char_length(error_code) <= 100),
  error_message text null
    check (error_message is null or char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

comment on column public.newsletter_design_processing_jobs.input_asset_id is
  'Current foundation accepts a same-project source_design asset. The neutral name leaves room for explicitly supported reference inputs later.';

comment on column public.newsletter_design_processing_jobs.request_payload is
  'Normalized, non-secret request metadata only. Never store credentials, authorization headers, tokens, or signed URLs.';

comment on column public.newsletter_design_processing_jobs.result_payload is
  'Normalized result metadata only. Do not persist raw provider responses, credentials, tokens, or signed URLs.';

comment on column public.newsletter_design_processing_jobs.status_url is
  'Optional stable HTTPS status endpoint only. Never store query strings, fragments, signed temporary URLs, or credentials.';

comment on column public.newsletter_design_processing_jobs.started_at is
  'Set by the future processing service when a queued job begins processing; remains null before processing starts.';

comment on column public.newsletter_design_processing_jobs.completed_at is
  'Set by the future processing service when a job reaches succeeded, failed, or cancelled.';

create table if not exists public.newsletter_design_processing_job_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null
    references public.newsletter_design_processing_jobs(id)
    on delete cascade,
  asset_id uuid null
    references public.newsletter_project_design_assets(id)
    on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists newsletter_design_processing_job_outputs_job_asset_key
  on public.newsletter_design_processing_job_outputs(job_id, asset_id)
  where asset_id is not null;

create index if not exists newsletter_design_processing_jobs_project_created_idx
  on public.newsletter_design_processing_jobs(project_id, created_at desc);

create index if not exists newsletter_design_processing_jobs_project_status_idx
  on public.newsletter_design_processing_jobs(project_id, status, updated_at desc);

create index if not exists newsletter_design_processing_jobs_input_asset_idx
  on public.newsletter_design_processing_jobs(project_id, input_asset_id)
  where input_asset_id is not null;

create index if not exists newsletter_design_processing_job_outputs_job_idx
  on public.newsletter_design_processing_job_outputs(job_id, created_at asc);

create or replace function public.validate_newsletter_design_processing_job_input()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.input_asset_id is not null
    and not exists (
      select 1
      from public.newsletter_project_design_assets input_asset
      where input_asset.id = new.input_asset_id
        and input_asset.project_id = new.project_id
        and input_asset.asset_type = 'source_design'
    )
  then
    raise exception 'design processing input must be a source_design asset in the same project'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and new.project_id is distinct from old.project_id
    and exists (
      select 1
      from public.newsletter_design_processing_job_outputs output_relation
      where output_relation.job_id = old.id
    )
  then
    raise exception 'design processing job project cannot change while outputs exist'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_design_processing_jobs_validate_input
  on public.newsletter_design_processing_jobs;

create trigger newsletter_design_processing_jobs_validate_input
before insert or update of project_id, input_asset_id
on public.newsletter_design_processing_jobs
for each row
execute function public.validate_newsletter_design_processing_job_input();

create or replace function public.validate_newsletter_design_processing_job_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status = 'queued' and new.status in ('processing', 'failed', 'cancelled'))
    or (old.status = 'processing' and new.status in ('succeeded', 'failed', 'cancelled'))
  then
    return new;
  end if;

  raise exception 'invalid design processing job status transition: % to %', old.status, new.status
    using errcode = '23514';
end;
$$;

drop trigger if exists newsletter_design_processing_jobs_validate_status_transition
  on public.newsletter_design_processing_jobs;

create trigger newsletter_design_processing_jobs_validate_status_transition
before update of status
on public.newsletter_design_processing_jobs
for each row
execute function public.validate_newsletter_design_processing_job_status_transition();

create or replace function public.validate_newsletter_design_processing_job_output()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.asset_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.newsletter_design_processing_jobs processing_job
    join public.newsletter_project_design_assets output_asset
      on output_asset.id = new.asset_id
     and output_asset.project_id = processing_job.project_id
     and output_asset.asset_type in (
       'background',
       'illustration',
       'icon',
       'card_frame',
       'banner',
       'pattern',
       'decoration'
     )
    where processing_job.id = new.job_id
  )
  then
    raise exception 'design processing output must be a production asset in the job project'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_design_processing_job_outputs_validate_asset
  on public.newsletter_design_processing_job_outputs;

create trigger newsletter_design_processing_job_outputs_validate_asset
before insert or update of job_id, asset_id
on public.newsletter_design_processing_job_outputs
for each row
execute function public.validate_newsletter_design_processing_job_output();

create or replace function public.guard_newsletter_design_processing_input_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.asset_type = 'source_design'
    and (
      new.asset_type <> 'source_design'
      or new.project_id is distinct from old.project_id
    )
    and exists (
      select 1
      from public.newsletter_design_processing_jobs processing_job
      where processing_job.input_asset_id = old.id
    )
  then
    raise exception 'design processing input asset type or project cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_project_design_assets_guard_processing_input
  on public.newsletter_project_design_assets;

create trigger newsletter_project_design_assets_guard_processing_input
before update of project_id, asset_type
on public.newsletter_project_design_assets
for each row
execute function public.guard_newsletter_design_processing_input_mutation();

create or replace function public.guard_newsletter_design_processing_output_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.newsletter_design_processing_job_outputs output_relation
    join public.newsletter_design_processing_jobs processing_job
      on processing_job.id = output_relation.job_id
    where output_relation.asset_id = old.id
      and (
        new.project_id is distinct from processing_job.project_id
        or new.asset_type not in (
          'background',
          'illustration',
          'icon',
          'card_frame',
          'banner',
          'pattern',
          'decoration'
        )
      )
  )
  then
    raise exception 'design processing output asset type or project cannot be changed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_project_design_assets_guard_processing_output
  on public.newsletter_project_design_assets;

create trigger newsletter_project_design_assets_guard_processing_output
before update of project_id, asset_type
on public.newsletter_project_design_assets
for each row
execute function public.guard_newsletter_design_processing_output_mutation();

create or replace function public.set_newsletter_design_processing_jobs_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_design_processing_jobs_updated_at
  on public.newsletter_design_processing_jobs;

create trigger newsletter_design_processing_jobs_updated_at
before update on public.newsletter_design_processing_jobs
for each row
execute function public.set_newsletter_design_processing_jobs_updated_at();

alter table public.newsletter_design_processing_jobs enable row level security;
alter table public.newsletter_design_processing_job_outputs enable row level security;

drop policy if exists "Service role manages design processing jobs"
  on public.newsletter_design_processing_jobs;

create policy "Service role manages design processing jobs"
  on public.newsletter_design_processing_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages design processing job outputs"
  on public.newsletter_design_processing_job_outputs;

create policy "Service role manages design processing job outputs"
  on public.newsletter_design_processing_job_outputs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on table public.newsletter_design_processing_jobs from anon, authenticated;
revoke all on table public.newsletter_design_processing_job_outputs from anon, authenticated;
grant all on table public.newsletter_design_processing_jobs to service_role;
grant all on table public.newsletter_design_processing_job_outputs to service_role;

commit;
