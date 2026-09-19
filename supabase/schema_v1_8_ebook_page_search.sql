-- Mobile Newsletter Studio / schema v1.8
-- Purpose: store per-page PDF text for internal e-book search.

alter table public.newsletter_pages
  add column if not exists search_text text,
  add column if not exists search_text_updated_at timestamptz;

