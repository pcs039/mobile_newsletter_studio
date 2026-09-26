begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit),
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.newsletter_project_design_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.newsletter_projects(id)
    on delete cascade,
  asset_type text not null default 'logo',
  name text not null,
  language text not null default 'ko',
  variant text not null default 'primary',
  background_mode text not null default 'any',
  storage_path text,
  external_url text,
  alt_text text,
  usage_note text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_project_design_assets_asset_type_check
    check (asset_type in ('logo')),
  constraint newsletter_project_design_assets_language_check
    check (language in ('ko', 'en', 'mixed', 'other')),
  constraint newsletter_project_design_assets_variant_check
    check (variant in ('primary', 'compact', 'inverse', 'symbol', 'other')),
  constraint newsletter_project_design_assets_background_mode_check
    check (background_mode in ('light', 'dark', 'any')),
  constraint newsletter_project_design_assets_source_check
    check (storage_path is not null or external_url is not null)
);

create unique index if not exists newsletter_project_design_assets_primary_logo_idx
  on public.newsletter_project_design_assets(project_id)
  where asset_type = 'logo' and is_primary = true;

create index if not exists newsletter_project_design_assets_project_sort_idx
  on public.newsletter_project_design_assets(project_id, asset_type, is_active desc, sort_order asc, created_at asc);

alter table public.newsletter_project_design_assets
  enable row level security;

create or replace function public.set_newsletter_project_design_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_project_design_assets_updated_at
  on public.newsletter_project_design_assets;

create trigger newsletter_project_design_assets_updated_at
before update on public.newsletter_project_design_assets
for each row
execute function public.set_newsletter_project_design_assets_updated_at();

commit;
