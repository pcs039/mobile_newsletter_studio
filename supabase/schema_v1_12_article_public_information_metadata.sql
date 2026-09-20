-- Mobile Newsletter Studio / schema v1.12
-- Purpose: add public-information metadata fields to existing newsletter articles.
-- This migration is additive only. It does not rewrite article order, status, audio, or survey links.

begin;

alter table public.newsletter_articles
  add column if not exists interest_tags text[] not null default '{}'::text[],
  add column if not exists article_type text not null default 'general',
  add column if not exists institution_priority smallint not null default 3,
  add column if not exists urgency text not null default 'normal',
  add column if not exists valid_from timestamptz null,
  add column if not exists valid_until timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_articles_article_type_check'
      and conrelid = 'public.newsletter_articles'::regclass
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_article_type_check
      check (
        article_type in (
          'general',
          'welfare_health',
          'application_recruitment',
          'event_festival',
          'tourism_place',
          'life_civil',
          'government_major',
          'local_news',
          'emergency'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_articles_institution_priority_check'
      and conrelid = 'public.newsletter_articles'::regclass
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_institution_priority_check
      check (
        institution_priority between 1 and 5
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_articles_urgency_check'
      and conrelid = 'public.newsletter_articles'::regclass
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_urgency_check
      check (
        urgency in ('normal', 'time_sensitive', 'urgent')
      );
  end if;
end
$$;

commit;
