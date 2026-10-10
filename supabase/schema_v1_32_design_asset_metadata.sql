-- Staging first. Production requires a separate controlled application.
begin;
alter table public.newsletter_project_design_assets
  add column if not exists metadata jsonb;
comment on column public.newsletter_project_design_assets.metadata is
  'Optional external asset classification. Server allowlist validation; reuseScope does not grant cross-project access.';
notify pgrst, 'reload schema';
commit;
