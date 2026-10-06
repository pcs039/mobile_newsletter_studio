begin;

alter table public.newsletter_project_design_kits
  add column if not exists source_mode text;

alter table public.newsletter_project_design_kits
  drop constraint if exists newsletter_project_design_kits_source_mode_check;

alter table public.newsletter_project_design_kits
  add constraint newsletter_project_design_kits_source_mode_check
  check (source_mode is null or source_mode in ('source_available', 'reference_only'));

alter table public.newsletter_project_design_assets
  add column if not exists storage_bucket text not null default 'brand-assets',
  add column if not exists original_file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint;

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_asset_type_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_asset_type_check
  check (asset_type in ('logo', 'source_design', 'reference'));

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_storage_bucket_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_storage_bucket_check
  check (storage_bucket in ('brand-assets', 'design-intake-assets'));

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_file_size_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_file_size_check
  check (file_size_bytes is null or file_size_bytes > 0);

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_intake_storage_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_intake_storage_check
  check (
    asset_type = 'logo'
    or (
      asset_type in ('source_design', 'reference')
      and storage_bucket = 'design-intake-assets'
      and storage_path is not null
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'design-intake-assets',
  'design-intake-assets',
  false,
  52428800,
  array[
    'application/pdf',
    'application/postscript',
    'application/octet-stream',
    'image/svg+xml',
    'image/vnd.adobe.photoshop',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit),
  allowed_mime_types = excluded.allowed_mime_types;

commit;
