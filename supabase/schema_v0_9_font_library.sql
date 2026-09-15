-- Font library and per-project/article font selection.
-- Run this once in the Supabase SQL editor before using the font manager UI.

create table if not exists public.font_assets (
  id uuid primary key default gen_random_uuid(),
  font_name text not null,
  font_family text not null,
  font_file_path text not null unique,
  font_file_format text not null check (font_file_format in ('woff2', 'woff', 'ttf', 'otf')),
  font_weight text default '400',
  font_style text default 'normal',
  font_type text not null default 'uploaded',
  license_type text,
  license_note text,
  license_url text,
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

create index if not exists font_assets_active_idx
  on public.font_assets (is_active, webfont_allowed, font_name);

create index if not exists font_assets_name_idx
  on public.font_assets (font_name);

alter table public.newsletter_projects
  add column if not exists title_font_asset_id uuid references public.font_assets(id) on delete set null,
  add column if not exists body_font_asset_id uuid references public.font_assets(id) on delete set null;

alter table public.newsletter_articles
  add column if not exists title_font_asset_id uuid references public.font_assets(id) on delete set null,
  add column if not exists body_font_asset_id uuid references public.font_assets(id) on delete set null,
  add column if not exists caption_font_asset_id uuid references public.font_assets(id) on delete set null,
  add column if not exists button_font_asset_id uuid references public.font_assets(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fonts',
  'fonts',
  true,
  5242880,
  array['font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'application/font-woff', 'application/x-font-ttf', 'application/x-font-otf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_font_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_font_assets_updated_at on public.font_assets;

create trigger set_font_assets_updated_at
before update on public.font_assets
for each row
execute function public.set_font_assets_updated_at();
