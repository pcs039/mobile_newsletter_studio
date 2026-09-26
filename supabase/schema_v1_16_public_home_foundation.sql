-- Mobile Newsletter Studio v1.16
-- Municipality public home foundation.
-- This migration is intentionally additive and idempotent.

begin;

create table if not exists public.newsletter_project_home_settings (
  project_id uuid primary key references public.newsletter_projects(id) on delete cascade,
  is_enabled boolean not null default false,
  regions text[] not null default '{}'::text[],
  section_settings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_article_home_metadata (
  article_id uuid primary key references public.newsletter_articles(id) on delete cascade,
  project_id uuid not null references public.newsletter_projects(id) on delete cascade,
  target_regions text[] not null default '{}'::text[],
  section_override text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_article_home_metadata_section_override_check
    check (
      section_override is null
      or section_override in ('must_know', 'support', 'local', 'life', 'event')
    )
);

alter table public.newsletter_project_home_settings
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.newsletter_article_home_metadata
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists newsletter_article_home_metadata_project_id_idx
  on public.newsletter_article_home_metadata(project_id);

alter table public.newsletter_project_home_settings enable row level security;
alter table public.newsletter_article_home_metadata enable row level security;

create or replace function public.set_newsletter_project_home_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_project_home_settings_updated_at
  on public.newsletter_project_home_settings;

create trigger newsletter_project_home_settings_updated_at
before update on public.newsletter_project_home_settings
for each row
execute function public.set_newsletter_project_home_settings_updated_at();

create or replace function public.set_newsletter_article_home_metadata_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_article_home_metadata_updated_at
  on public.newsletter_article_home_metadata;

create trigger newsletter_article_home_metadata_updated_at
before update on public.newsletter_article_home_metadata
for each row
execute function public.set_newsletter_article_home_metadata_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_project_home_settings'
      and policyname = 'Service role manages project home settings'
  ) then
    create policy "Service role manages project home settings"
      on public.newsletter_project_home_settings
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_article_home_metadata'
      and policyname = 'Service role manages article home metadata'
  ) then
    create policy "Service role manages article home metadata"
      on public.newsletter_article_home_metadata
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

commit;
