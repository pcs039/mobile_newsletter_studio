-- Font family package upload support.
-- Run after schema_v0_9_font_library.sql.

create table if not exists public.font_families (
  id uuid primary key default gen_random_uuid(),
  family_name text not null,
  display_name text not null,
  css_family_name text not null unique,
  font_type text not null default 'public_free'
    check (font_type in ('local_government', 'public_free', 'purchased', 'internal', 'uploaded')),
  license_type text,
  license_note text,
  license_url text,
  license_file_paths jsonb not null default '[]'::jsonb,
  webfont_allowed boolean not null default false,
  commercial_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  attribution_required boolean not null default false,
  attribution_text text,
  is_active boolean not null default false,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists font_families_active_idx
  on public.font_families (is_active, webfont_allowed, display_name);

create index if not exists font_families_display_name_idx
  on public.font_families (display_name);

alter table public.font_assets
  add column if not exists family_id uuid references public.font_families(id) on delete set null,
  add column if not exists source_file_name text,
  add column if not exists detected_weight text,
  add column if not exists detected_style text,
  add column if not exists package_source text not null default 'single';

create index if not exists font_assets_family_id_idx
  on public.font_assets (family_id);

create index if not exists font_assets_family_weight_style_idx
  on public.font_assets (family_id, detected_weight, detected_style);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fonts',
  'fonts',
  true,
  83886080,
  array['font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'application/zip', 'application/x-zip-compressed']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit),
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_font_families_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_font_families_updated_at on public.font_families;

create trigger set_font_families_updated_at
before update on public.font_families
for each row
execute function public.set_font_families_updated_at();
