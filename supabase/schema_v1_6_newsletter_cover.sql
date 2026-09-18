alter table public.newsletter_projects
  add column if not exists cover_enabled boolean not null default false,
  add column if not exists cover_layout text null default 'image',
  add column if not exists cover_image_url text null,
  add column if not exists cover_image_path text null,
  add column if not exists cover_title text null,
  add column if not exists cover_subtitle text null,
  add column if not exists cover_issue_text text null,
  add column if not exists cover_fit text null default 'contain';

update public.newsletter_projects
set cover_layout = 'image'
where cover_layout is null
  or cover_layout not in ('image', 'image_info', 'image_overlay');

update public.newsletter_projects
set cover_fit = 'contain'
where cover_fit is null
  or cover_fit not in ('contain', 'cover');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_projects_cover_layout_check'
  ) then
    alter table public.newsletter_projects
      add constraint newsletter_projects_cover_layout_check
      check (cover_layout in ('image', 'image_info', 'image_overlay'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_projects_cover_fit_check'
  ) then
    alter table public.newsletter_projects
      add constraint newsletter_projects_cover_fit_check
      check (cover_fit in ('contain', 'cover'));
  end if;
end $$;
