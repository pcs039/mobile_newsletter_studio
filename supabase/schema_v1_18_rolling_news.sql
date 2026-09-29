-- Mobile Newsletter Studio v1.18
-- Additive publication mode for rolling and urgent articles.

begin;

alter table public.newsletter_articles
  add column if not exists publication_kind text not null default 'regular';

update public.newsletter_articles
set publication_kind = 'regular'
where publication_kind is null
   or publication_kind not in ('regular', 'rolling');

alter table public.newsletter_articles
  alter column publication_kind set default 'regular',
  alter column publication_kind set not null;

alter table public.newsletter_articles
  drop constraint if exists newsletter_articles_publication_kind_check;

alter table public.newsletter_articles
  add constraint newsletter_articles_publication_kind_check
  check (publication_kind in ('regular', 'rolling'));

create index if not exists newsletter_articles_rolling_visibility_idx
  on public.newsletter_articles(project_id, publication_kind, status, valid_from, valid_until);

commit;
