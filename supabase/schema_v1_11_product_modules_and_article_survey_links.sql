-- Product module structure and article engagement links.
-- Run this in Supabase SQL Editor before deploying code that reads these columns.

alter table public.newsletter_projects
  add column if not exists project_type text null default 'integrated';

alter table public.newsletter_projects
  drop constraint if exists newsletter_projects_project_type_check;

alter table public.newsletter_projects
  add constraint newsletter_projects_project_type_check
  check (project_type is null or project_type in ('newsletter', 'ebook', 'engagement', 'integrated'));

update public.newsletter_projects
set project_type = 'integrated'
where project_type is null;

alter table public.newsletter_articles
  add column if not exists survey_id uuid null;

alter table public.newsletter_articles
  drop constraint if exists newsletter_articles_survey_id_fkey;

alter table public.newsletter_articles
  add constraint newsletter_articles_survey_id_fkey
  foreign key (survey_id)
  references public.newsletter_surveys(id)
  on delete set null;

create index if not exists newsletter_articles_survey_id_idx
  on public.newsletter_articles(survey_id);
