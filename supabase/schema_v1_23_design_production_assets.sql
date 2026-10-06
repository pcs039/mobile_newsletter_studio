begin;

alter table public.newsletter_project_design_assets
  add column if not exists parent_source_asset_id uuid,
  add column if not exists usage_role text not null default 'general',
  add column if not exists approval_status text not null default 'draft';

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_parent_source_asset_id_fkey;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_parent_source_asset_id_fkey
  foreign key (parent_source_asset_id)
  references public.newsletter_project_design_assets(id)
  on delete set null;

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_asset_type_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_asset_type_check
  check (
    asset_type in (
      'logo',
      'source_design',
      'reference',
      'background',
      'illustration',
      'icon',
      'card_frame',
      'banner',
      'pattern',
      'decoration'
    )
  );

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_storage_bucket_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_storage_bucket_check
  check (storage_bucket in ('brand-assets', 'design-intake-assets', 'design-production-assets'));

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_intake_storage_check;

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_storage_contract_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_storage_contract_check
  check (
    asset_type = 'logo'
    or (
      asset_type in ('source_design', 'reference')
      and storage_bucket = 'design-intake-assets'
      and storage_path is not null
    )
    or (
      asset_type in ('background', 'illustration', 'icon', 'card_frame', 'banner', 'pattern', 'decoration')
      and storage_bucket = 'design-production-assets'
      and storage_path is not null
    )
  );

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_usage_role_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_usage_role_check
  check (usage_role in ('header', 'section', 'card', 'article', 'footer', 'general'));

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_approval_status_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_approval_status_check
  check (approval_status in ('draft', 'approved', 'archived'));

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_parent_type_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_parent_type_check
  check (
    parent_source_asset_id is null
    or asset_type in ('background', 'illustration', 'icon', 'card_frame', 'banner', 'pattern', 'decoration')
  );

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_parent_not_self_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_parent_not_self_check
  check (parent_source_asset_id is null or parent_source_asset_id <> id);

alter table public.newsletter_project_design_assets
  drop constraint if exists newsletter_project_design_assets_primary_logo_only_check;

alter table public.newsletter_project_design_assets
  add constraint newsletter_project_design_assets_primary_logo_only_check
  check (asset_type = 'logo' or is_primary = false);

create or replace function public.validate_newsletter_project_design_asset_parent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
    and old.asset_type = 'source_design'
    and (
      new.asset_type <> 'source_design'
      or new.project_id is distinct from old.project_id
    )
    and exists (
      select 1
      from public.newsletter_project_design_assets child_asset
      where child_asset.parent_source_asset_id = old.id
    )
  then
    raise exception 'referenced source design asset type or project cannot be changed'
      using errcode = '23514';
  end if;

  if new.parent_source_asset_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.newsletter_project_design_assets source_asset
    where source_asset.id = new.parent_source_asset_id
      and source_asset.project_id = new.project_id
      and source_asset.asset_type = 'source_design'
  ) then
    raise exception 'parent source asset must be a source_design asset in the same project'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_project_design_assets_validate_parent
  on public.newsletter_project_design_assets;

create trigger newsletter_project_design_assets_validate_parent
before insert or update of parent_source_asset_id, project_id, asset_type
on public.newsletter_project_design_assets
for each row
execute function public.validate_newsletter_project_design_asset_parent();

create index if not exists newsletter_project_design_assets_parent_source_idx
  on public.newsletter_project_design_assets(project_id, parent_source_asset_id)
  where parent_source_asset_id is not null;

create index if not exists newsletter_project_design_assets_production_library_idx
  on public.newsletter_project_design_assets(project_id, approval_status, asset_type, usage_role, created_at desc)
  where asset_type in ('background', 'illustration', 'icon', 'card_frame', 'banner', 'pattern', 'decoration');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'design-production-assets',
  'design-production-assets',
  false,
  10485760,
  array[
    'image/svg+xml',
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
