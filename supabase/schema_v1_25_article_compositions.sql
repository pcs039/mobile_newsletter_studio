-- Mobile Newsletter Studio v1.25
-- Structured article presentation and production asset placement foundation.

begin;

create table if not exists public.newsletter_article_compositions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.newsletter_projects(id)
    on delete cascade,
  article_id uuid not null
    references public.newsletter_articles(id)
    on delete cascade,
  layout_key text not null default 'standard'
    constraint newsletter_article_compositions_layout_key_check
    check (layout_key in ('standard')),
  status text not null default 'draft'
    constraint newsletter_article_compositions_status_check
    check (status in ('draft', 'ready')),
  settings jsonb not null default '{}'::jsonb
    constraint newsletter_article_compositions_settings_object_check
    check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_article_compositions_article_key unique (article_id)
);

comment on table public.newsletter_article_compositions is
  'Presentation-only article layout metadata. Article text, content blocks, survey, audio, map, and button data remain in their existing source tables.';

comment on column public.newsletter_article_compositions.settings is
  'Presentation metadata only. Never store article content, HTML, raw SVG, secrets, signed URLs, or external provider payloads.';

create table if not exists public.newsletter_article_composition_assets (
  id uuid primary key default gen_random_uuid(),
  composition_id uuid not null
    references public.newsletter_article_compositions(id)
    on delete cascade,
  asset_id uuid not null
    references public.newsletter_project_design_assets(id)
    on delete restrict,
  slot text not null
    constraint newsletter_article_composition_assets_slot_check
    check (
      slot in (
        'hero_background',
        'hero_illustration',
        'title_icon',
        'body_decoration',
        'footer_banner'
      )
    ),
  sort_order integer not null default 0
    constraint newsletter_article_composition_assets_sort_order_check
    check (sort_order >= 0),
  is_visible boolean not null default true,
  settings jsonb not null default '{}'::jsonb
    constraint newsletter_article_composition_assets_settings_object_check
    check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_article_composition_assets_slot_order_key
    unique (composition_id, slot, sort_order)
);

comment on table public.newsletter_article_composition_assets is
  'Controlled semantic-slot placements for project production design assets.';

comment on column public.newsletter_article_composition_assets.settings is
  'Presentation metadata only. Never store signed URLs, article content, HTML, raw SVG, secrets, or provider payloads.';

create index if not exists newsletter_article_compositions_project_updated_idx
  on public.newsletter_article_compositions(project_id, updated_at desc);

create index if not exists newsletter_article_composition_assets_asset_idx
  on public.newsletter_article_composition_assets(asset_id, composition_id);

create or replace function public.is_newsletter_composition_slot_asset_type_compatible(
  p_slot text,
  p_asset_type text
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_slot
    when 'hero_background' then p_asset_type in ('background', 'pattern')
    when 'hero_illustration' then p_asset_type in ('illustration', 'decoration')
    when 'title_icon' then p_asset_type in ('icon', 'illustration')
    when 'body_decoration' then p_asset_type in ('decoration', 'illustration', 'pattern')
    when 'footer_banner' then p_asset_type in ('banner', 'card_frame')
    else false
  end;
$$;

create or replace function public.validate_newsletter_article_composition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.newsletter_articles article
    where article.id = new.article_id
      and article.project_id = new.project_id
  )
  then
    raise exception 'article composition must reference an article in the same project'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_article_compositions_validate_article
  on public.newsletter_article_compositions;

create trigger newsletter_article_compositions_validate_article
before insert or update of project_id, article_id
on public.newsletter_article_compositions
for each row
execute function public.validate_newsletter_article_composition();

create or replace function public.validate_newsletter_article_composition_asset()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_composition_project_id uuid;
  v_asset_project_id uuid;
  v_asset_type text;
begin
  select composition.project_id
  into v_composition_project_id
  from public.newsletter_article_compositions composition
  where composition.id = new.composition_id;

  select design_asset.project_id, design_asset.asset_type
  into v_asset_project_id, v_asset_type
  from public.newsletter_project_design_assets design_asset
  where design_asset.id = new.asset_id;

  if v_composition_project_id is null or v_asset_project_id is null then
    raise exception 'composition placement references a missing composition or design asset'
      using errcode = '23503';
  end if;

  if v_asset_project_id is distinct from v_composition_project_id then
    raise exception 'composition placement asset must belong to the composition project'
      using errcode = '23514';
  end if;

  if not public.is_newsletter_composition_slot_asset_type_compatible(new.slot, v_asset_type) then
    raise exception 'composition slot % is incompatible with asset type %', new.slot, v_asset_type
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_article_composition_assets_validate_asset
  on public.newsletter_article_composition_assets;

create trigger newsletter_article_composition_assets_validate_asset
before insert or update of composition_id, asset_id, slot
on public.newsletter_article_composition_assets
for each row
execute function public.validate_newsletter_article_composition_asset();

create or replace function public.guard_newsletter_composition_asset_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.newsletter_article_composition_assets placement
    join public.newsletter_article_compositions composition
      on composition.id = placement.composition_id
    where placement.asset_id = old.id
      and (
        new.project_id is distinct from composition.project_id
        or not public.is_newsletter_composition_slot_asset_type_compatible(placement.slot, new.asset_type)
      )
  )
  then
    raise exception 'composition asset type or project cannot change while placements depend on it'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_project_design_assets_guard_composition_asset
  on public.newsletter_project_design_assets;

create trigger newsletter_project_design_assets_guard_composition_asset
before update of project_id, asset_type
on public.newsletter_project_design_assets
for each row
execute function public.guard_newsletter_composition_asset_mutation();

create or replace function public.guard_newsletter_composition_article_project_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.project_id is distinct from old.project_id
    and exists (
      select 1
      from public.newsletter_article_compositions composition
      where composition.article_id = old.id
    )
  then
    raise exception 'article project cannot change while an article composition exists'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_articles_guard_composition_project
  on public.newsletter_articles;

create trigger newsletter_articles_guard_composition_project
before update of project_id
on public.newsletter_articles
for each row
execute function public.guard_newsletter_composition_article_project_mutation();

create or replace function public.set_newsletter_article_composition_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_article_compositions_updated_at
  on public.newsletter_article_compositions;

create trigger newsletter_article_compositions_updated_at
before update on public.newsletter_article_compositions
for each row
execute function public.set_newsletter_article_composition_updated_at();

drop trigger if exists newsletter_article_composition_assets_updated_at
  on public.newsletter_article_composition_assets;

create trigger newsletter_article_composition_assets_updated_at
before update on public.newsletter_article_composition_assets
for each row
execute function public.set_newsletter_article_composition_updated_at();

alter table public.newsletter_article_compositions enable row level security;
alter table public.newsletter_article_composition_assets enable row level security;

drop policy if exists "Service role manages article compositions"
  on public.newsletter_article_compositions;

create policy "Service role manages article compositions"
  on public.newsletter_article_compositions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages article composition assets"
  on public.newsletter_article_composition_assets;

create policy "Service role manages article composition assets"
  on public.newsletter_article_composition_assets
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on table public.newsletter_article_compositions from anon, authenticated;
revoke all on table public.newsletter_article_composition_assets from anon, authenticated;
grant all on table public.newsletter_article_compositions to service_role;
grant all on table public.newsletter_article_composition_assets to service_role;

revoke all on function public.is_newsletter_composition_slot_asset_type_compatible(text, text)
  from public, anon, authenticated;
grant execute on function public.is_newsletter_composition_slot_asset_type_compatible(text, text)
  to service_role;

commit;
