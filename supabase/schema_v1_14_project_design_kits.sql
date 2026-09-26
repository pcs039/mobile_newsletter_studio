begin;

create table if not exists public.newsletter_project_design_kits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique
    references public.newsletter_projects(id)
    on delete cascade,
  logo_url text,
  logo_alt text,
  primary_color text not null default '#092046',
  secondary_color text not null default '#184a88',
  accent_color text not null default '#2f73b7',
  background_color text not null default '#ffffff',
  text_color text not null default '#0f172a',
  heading_font_family text,
  body_font_family text,
  button_radius integer not null default 12,
  card_radius integer not null default 16,
  button_style text not null default 'solid',
  icon_style text not null default 'outline',
  image_style text not null default 'mixed',
  template_notes text,
  design_tokens jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_project_design_kits_button_radius_check
    check (button_radius between 0 and 40),
  constraint newsletter_project_design_kits_card_radius_check
    check (card_radius between 0 and 48),
  constraint newsletter_project_design_kits_button_style_check
    check (button_style in ('solid', 'outline', 'soft')),
  constraint newsletter_project_design_kits_icon_style_check
    check (icon_style in ('outline', 'filled', 'illustration')),
  constraint newsletter_project_design_kits_image_style_check
    check (image_style in ('photo', 'illustration', 'mixed')),
  constraint newsletter_project_design_kits_primary_color_check
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint newsletter_project_design_kits_secondary_color_check
    check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint newsletter_project_design_kits_accent_color_check
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint newsletter_project_design_kits_background_color_check
    check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint newsletter_project_design_kits_text_color_check
    check (text_color ~ '^#[0-9A-Fa-f]{6}$')
);

alter table public.newsletter_project_design_kits
  enable row level security;

create or replace function public.set_newsletter_project_design_kits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_project_design_kits_updated_at
  on public.newsletter_project_design_kits;

create trigger newsletter_project_design_kits_updated_at
before update on public.newsletter_project_design_kits
for each row
execute function public.set_newsletter_project_design_kits_updated_at();

commit;
