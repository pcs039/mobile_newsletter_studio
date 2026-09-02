-- Mobile Newsletter Studio / Supabase schema draft v0.5
-- Purpose: manual-upload-first MVP for PDF originals, page images, mobile assets,
-- external ebook links, audio files, analytics, package tiers, and AI/plugin logs.

create extension if not exists "pgcrypto";

create type project_status as enum (
  'draft',
  'in_review',
  'published',
  'private',
  'archived'
);

create type package_tier as enum (
  'basic',
  'standard',
  'advanced',
  'premium',
  'retainer'
);

create type production_mode as enum (
  'template',
  'hybrid',
  'full_image',
  'external_ebook'
);

create type page_image_status as enum (
  'not_uploaded',
  'uploaded',
  'needs_review',
  'approved',
  'replace_required'
);

create type content_block_type as enum (
  'paragraph',
  'image',
  'video_link',
  'map_link',
  'button_group',
  'audio',
  'overlay_notice'
);

create type link_action_type as enum (
  'url',
  'phone',
  'map',
  'video',
  'internal_page',
  'download'
);

create type link_display_style as enum (
  'button',
  'text_link',
  'thumbnail_card',
  'map_card'
);

create type asset_source_type as enum (
  'institution_original',
  'designer_created',
  'ai_generated',
  'pdf_extracted'
);

create type activity_action_type as enum (
  'created',
  'updated',
  'duplicated',
  'uploaded_pdf_original',
  'uploaded_page_image',
  'linked_external_ebook',
  'linked_external_video',
  'linked_map',
  'updated_overlay',
  'published',
  'unpublished',
  'archived',
  'restored'
);

create table if not exists newsletter_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organization_name text not null,
  assignee_name text,
  issue_label text,
  published_date date,
  slug text not null unique,
  description text,
  primary_color text not null default '#092046',
  status project_status not null default 'draft',
  package_tier package_tier not null default 'standard',
  production_mode production_mode not null default 'hybrid',
  estimated_hours text,
  designer_hours_cap text,
  revision_limit integer not null default 2,
  page_count integer not null default 0,
  pdf_original_path text,
  pdf_original_file_name text,
  pdf_original_uploaded_at timestamptz,
  external_ebook_url text,
  ebook_provider text,
  cloned_from_project_id uuid references newsletter_projects(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table newsletter_projects
  add column if not exists assignee_name text;

create table if not exists newsletter_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  page_number integer not null,
  title text,
  image_path text,
  image_width integer,
  image_height integer,
  image_status page_image_status not null default 'not_uploaded',
  pc_ebook_spread text not null default 'single',
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, page_number)
);

create table if not exists newsletter_articles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  page_id uuid references newsletter_pages(id) on delete set null,
  sort_order integer not null default 0,
  title text not null,
  summary text,
  body text,
  contact_name text,
  contact_phone text,
  status text not null default 'draft',
  representative_asset_id uuid,
  audio_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  source_type asset_source_type not null,
  title text not null,
  file_path text not null,
  mime_type text,
  alt_text text,
  rights_status text,
  quality_status text,
  usage_note text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_articles_representative_asset_fk'
  ) then
    alter table newsletter_articles
      add constraint newsletter_articles_representative_asset_fk
      foreign key (representative_asset_id)
      references newsletter_assets(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists newsletter_audio_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  article_id uuid references newsletter_articles(id) on delete set null,
  title text not null,
  file_path text not null,
  duration_seconds integer,
  script_text text,
  script_status text not null default 'unchecked',
  pronunciation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_articles_audio_fk'
  ) then
    alter table newsletter_articles
      add constraint newsletter_articles_audio_fk
      foreign key (audio_id)
      references newsletter_audio_files(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists newsletter_link_areas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  page_id uuid not null references newsletter_pages(id) on delete cascade,
  label text not null,
  link_type text not null,
  target_value text not null,
  x_percent numeric(6,3) not null,
  y_percent numeric(6,3) not null,
  width_percent numeric(6,3) not null,
  height_percent numeric(6,3) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_link_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  article_id uuid references newsletter_articles(id) on delete cascade,
  label text not null,
  action_type link_action_type not null,
  target_value text not null,
  display_style link_display_style not null default 'button',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_content_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  article_id uuid references newsletter_articles(id) on delete cascade,
  block_type content_block_type not null,
  title text,
  body text,
  asset_id uuid references newsletter_assets(id) on delete set null,
  link_action_id uuid references newsletter_link_actions(id) on delete set null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_image_overlays (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  page_id uuid references newsletter_pages(id) on delete cascade,
  article_id uuid references newsletter_articles(id) on delete cascade,
  image_asset_id uuid references newsletter_assets(id) on delete set null,
  link_action_id uuid references newsletter_link_actions(id) on delete set null,
  label text not null,
  x_percent numeric(6,3) not null,
  y_percent numeric(6,3) not null,
  width_percent numeric(6,3) not null,
  height_percent numeric(6,3) not null,
  z_index integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  package_tier package_tier not null default 'standard',
  production_mode production_mode not null default 'hybrid',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_template_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references newsletter_templates(id) on delete cascade,
  block_type text not null,
  label text not null,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_task_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references newsletter_projects(id) on delete cascade,
  task_type text not null,
  input_summary text,
  output_summary text,
  status text not null default 'queued',
  human_review_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plugin_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  display_name text not null,
  purpose text,
  status text not null default 'planned',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Raw events should be used carefully. Store IP as hash or masked value.
-- Avoid exposing this table directly to ordinary editors.
create table if not exists newsletter_view_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  article_id uuid references newsletter_articles(id) on delete set null,
  page_id uuid references newsletter_pages(id) on delete set null,
  route_path text,
  view_mode text not null default 'reading',
  device_type text,
  browser_name text,
  os_name text,
  referrer_domain text,
  ip_hash text,
  user_agent_hash text,
  occurred_at timestamptz not null default now()
);

create index if not exists newsletter_view_events_project_time_idx
  on newsletter_view_events(project_id, occurred_at desc);

create table if not exists newsletter_daily_stats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  stat_date date not null,
  view_count integer not null default 0,
  mobile_count integer not null default 0,
  pc_count integer not null default 0,
  tablet_count integer not null default 0,
  direct_count integer not null default 0,
  referrer_count integer not null default 0,
  qr_estimated_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, stat_date)
);

create table if not exists project_activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  action activity_action_type not null,
  actor_id uuid,
  actor_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_activity_logs_project_time_idx
  on project_activity_logs(project_id, created_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_projects_set_updated_at on newsletter_projects;
create trigger newsletter_projects_set_updated_at
before update on newsletter_projects
for each row execute function set_updated_at();

drop trigger if exists newsletter_pages_set_updated_at on newsletter_pages;
create trigger newsletter_pages_set_updated_at
before update on newsletter_pages
for each row execute function set_updated_at();

drop trigger if exists newsletter_articles_set_updated_at on newsletter_articles;
create trigger newsletter_articles_set_updated_at
before update on newsletter_articles
for each row execute function set_updated_at();

drop trigger if exists newsletter_assets_set_updated_at on newsletter_assets;
create trigger newsletter_assets_set_updated_at
before update on newsletter_assets
for each row execute function set_updated_at();

drop trigger if exists newsletter_audio_files_set_updated_at on newsletter_audio_files;
create trigger newsletter_audio_files_set_updated_at
before update on newsletter_audio_files
for each row execute function set_updated_at();

drop trigger if exists newsletter_link_areas_set_updated_at on newsletter_link_areas;
create trigger newsletter_link_areas_set_updated_at
before update on newsletter_link_areas
for each row execute function set_updated_at();

drop trigger if exists newsletter_link_actions_set_updated_at on newsletter_link_actions;
create trigger newsletter_link_actions_set_updated_at
before update on newsletter_link_actions
for each row execute function set_updated_at();

drop trigger if exists newsletter_content_blocks_set_updated_at on newsletter_content_blocks;
create trigger newsletter_content_blocks_set_updated_at
before update on newsletter_content_blocks
for each row execute function set_updated_at();

drop trigger if exists newsletter_image_overlays_set_updated_at on newsletter_image_overlays;
create trigger newsletter_image_overlays_set_updated_at
before update on newsletter_image_overlays
for each row execute function set_updated_at();

drop trigger if exists newsletter_templates_set_updated_at on newsletter_templates;
create trigger newsletter_templates_set_updated_at
before update on newsletter_templates
for each row execute function set_updated_at();

drop trigger if exists newsletter_template_blocks_set_updated_at on newsletter_template_blocks;
create trigger newsletter_template_blocks_set_updated_at
before update on newsletter_template_blocks
for each row execute function set_updated_at();

drop trigger if exists ai_task_logs_set_updated_at on ai_task_logs;
create trigger ai_task_logs_set_updated_at
before update on ai_task_logs
for each row execute function set_updated_at();

drop trigger if exists plugin_connections_set_updated_at on plugin_connections;
create trigger plugin_connections_set_updated_at
before update on plugin_connections
for each row execute function set_updated_at();

drop trigger if exists newsletter_daily_stats_set_updated_at on newsletter_daily_stats;
create trigger newsletter_daily_stats_set_updated_at
before update on newsletter_daily_stats
for each row execute function set_updated_at();

-- Storage bucket plan:
-- pdf-originals: uploaded source PDFs for preservation
-- page-images: manually uploaded page images for PC ebook and review
-- mobile-assets: article cards, section backgrounds, banners, and generated/support images
-- audio-files: externally generated MP3 files
-- brand-assets: DataDiction and client logos

-- RLS policy details should be finalized when Supabase Auth roles are decided.
alter table newsletter_projects enable row level security;
alter table newsletter_pages enable row level security;
alter table newsletter_articles enable row level security;
alter table newsletter_assets enable row level security;
alter table newsletter_audio_files enable row level security;
alter table newsletter_link_areas enable row level security;
alter table newsletter_link_actions enable row level security;
alter table newsletter_content_blocks enable row level security;
alter table newsletter_image_overlays enable row level security;
alter table newsletter_templates enable row level security;
alter table newsletter_template_blocks enable row level security;
alter table ai_task_logs enable row level security;
alter table plugin_connections enable row level security;
alter table newsletter_view_events enable row level security;
alter table newsletter_daily_stats enable row level security;
alter table project_activity_logs enable row level security;
