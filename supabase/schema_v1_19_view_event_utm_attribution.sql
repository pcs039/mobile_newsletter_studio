begin;

alter table public.newsletter_view_events
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

commit;
