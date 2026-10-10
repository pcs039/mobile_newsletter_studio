-- Staging only until separately approved. No article/design/storage changes.
begin;
create table public.newsletter_project_canva_connections (
  project_id uuid not null references public.newsletter_projects(id) on delete cascade,
  user_id text not null check (length(user_id) between 1 and 200),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  oauth_state_hash text,
  oauth_verifier text,
  oauth_expires_at timestamptz,
  lock_id uuid,
  lock_until timestamptz,
  -- Last execution only: no content, token, or history. Prevent ambiguous POST retries.
  execution jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id),
  check (execution is null or jsonb_typeof(execution) = 'object')
);
alter table public.newsletter_project_canva_connections enable row level security;
revoke all on public.newsletter_project_canva_connections from public, anon, authenticated;
grant select, insert, update, delete on public.newsletter_project_canva_connections to service_role;
comment on table public.newsletter_project_canva_connections is
  'Server-only per-project/admin OAuth credentials, single-use PKCE state and last execution guard. Never select into client/public DTOs.';
notify pgrst, 'reload schema';
commit;
