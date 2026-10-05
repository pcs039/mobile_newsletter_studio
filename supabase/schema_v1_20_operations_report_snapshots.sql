-- Mobile Newsletter Studio v1.20
-- Immutable, project-scoped operations report snapshots.

begin;

create table if not exists public.newsletter_operations_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.newsletter_projects(id)
    on delete cascade,
  period text not null
    check (period in ('7d', '30d', 'all')),
  period_label text not null,
  period_start_date date null,
  period_end_date date not null,
  snapshot_title text null,
  snapshot_payload jsonb not null,
  ai_commentary jsonb null,
  evidence_catalog jsonb null,
  created_by text not null,
  created_at timestamptz not null default now(),
  schema_version integer not null default 1
    check (schema_version > 0)
);

create index if not exists newsletter_operations_report_snapshots_project_created_idx
  on public.newsletter_operations_report_snapshots(project_id, created_at desc);

create index if not exists newsletter_operations_report_snapshots_project_period_idx
  on public.newsletter_operations_report_snapshots(project_id, period, created_at desc);

alter table public.newsletter_operations_report_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_operations_report_snapshots'
      and policyname = 'Service role manages operations report snapshots'
  ) then
    create policy "Service role manages operations report snapshots"
      on public.newsletter_operations_report_snapshots
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

commit;
