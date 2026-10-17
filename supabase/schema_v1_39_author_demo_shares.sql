-- Author-created, read-only sales demos; independent from client review/publishing.
-- Definition only. Apply requires separate environment-specific approval.
begin;
create table public.newsletter_project_demo_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.newsletter_projects(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  article_ids uuid[] not null check (cardinality(article_ids) between 1 and 100),
  source_snapshot text not null check (source_snapshot ~ '^[a-f0-9]{64}$'),
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at),
  revoked_at timestamptz null
);
create index newsletter_project_demo_shares_project_idx
  on public.newsletter_project_demo_shares(project_id, created_at desc);
alter table public.newsletter_project_demo_shares enable row level security;
revoke all on public.newsletter_project_demo_shares from public, anon, authenticated;
grant select, insert, update on public.newsletter_project_demo_shares to service_role;
create policy "Service role manages demo shares" on public.newsletter_project_demo_shares
  for all to service_role using (true) with check (true);
-- No article/project/review/Storage mutation and no changes to existing functions.
commit;
