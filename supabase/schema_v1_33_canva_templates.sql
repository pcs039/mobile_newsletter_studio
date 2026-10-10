-- Staging first. Production requires separate controlled approval.
begin;

create table public.newsletter_project_canva_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.newsletter_projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  external_id text not null check (length(btrim(external_id)) between 1 and 200),
  template_type text not null check (template_type in ('brand_template', 'existing_design')),
  production_pattern text not null check (production_pattern in ('event', 'policy', 'interview', 'common')),
  purpose text not null check (purpose in ('card_news', 'event_guide', 'policy_guide', 'stat_card', 'profile', 'cover_section')),
  is_active boolean not null default true,
  field_mappings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(field_mappings) = 'array' and jsonb_array_length(field_mappings) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index newsletter_project_canva_templates_project_idx
  on public.newsletter_project_canva_templates(project_id, is_active, production_pattern);
alter table public.newsletter_project_canva_templates enable row level security;
revoke all on public.newsletter_project_canva_templates from public, anon, authenticated;
grant select, insert, update, delete on public.newsletter_project_canva_templates to service_role;

create function public.set_newsletter_project_canva_templates_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_newsletter_project_canva_templates_updated_at() from public, anon, authenticated;
create trigger newsletter_project_canva_templates_updated_at
before update on public.newsletter_project_canva_templates
for each row execute function public.set_newsletter_project_canva_templates_updated_at();

comment on table public.newsletter_project_canva_templates is
  'Project-private Canva references and allowlisted mappings. No credentials, article content, storage paths or Canva API execution.';
notify pgrst, 'reload schema';
commit;
