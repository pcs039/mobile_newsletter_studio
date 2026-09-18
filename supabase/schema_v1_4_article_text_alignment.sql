-- Add per-article mobile text alignment.
-- Existing articles fall back to left alignment.

alter table public.newsletter_articles
  add column if not exists text_alignment text default 'left';

update public.newsletter_articles
set text_alignment = 'left'
where text_alignment is null
   or text_alignment not in ('left', 'center', 'right', 'justify');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_articles_text_alignment_check'
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_text_alignment_check
      check (text_alignment in ('left', 'center', 'right', 'justify'));
  end if;
end;
$$;
