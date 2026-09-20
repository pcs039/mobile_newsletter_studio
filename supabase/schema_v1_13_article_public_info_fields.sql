-- Mobile Newsletter Studio / schema v1.13
-- Purpose: add optional structured public-information fields for newsletter articles.
-- This migration is additive only. It does not rewrite existing rows or article ordering.

begin;

alter table public.newsletter_articles
  add column if not exists public_info jsonb not null default '{}'::jsonb;

commit;
