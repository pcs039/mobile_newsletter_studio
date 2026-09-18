-- Add per-article-section and per-content-block text alignment.
-- newsletter_articles.text_alignment remains as the fallback alignment value.

alter table public.newsletter_articles
  add column if not exists title_alignment text,
  add column if not exists summary_alignment text,
  add column if not exists body_alignment text;

update public.newsletter_articles
set
  title_alignment = 'left'
where title_alignment is null
   or title_alignment not in ('left', 'center', 'right', 'justify');

update public.newsletter_articles
set
  summary_alignment = case
    when text_alignment in ('left', 'center', 'right', 'justify') then text_alignment
    else 'left'
  end
where summary_alignment is null
   or summary_alignment not in ('left', 'center', 'right', 'justify');

update public.newsletter_articles
set
  body_alignment = case
    when text_alignment in ('left', 'center', 'right', 'justify') then text_alignment
    else 'left'
  end
where body_alignment is null
   or body_alignment not in ('left', 'center', 'right', 'justify');

alter table public.newsletter_content_blocks
  add column if not exists text_alignment text;

update public.newsletter_content_blocks block
set text_alignment = case
  when article.text_alignment in ('left', 'center', 'right', 'justify') then article.text_alignment
  else 'left'
end
from public.newsletter_articles article
where block.article_id = article.id
  and (block.text_alignment is null or block.text_alignment not in ('left', 'center', 'right', 'justify'));

update public.newsletter_content_blocks
set text_alignment = 'left'
where text_alignment is null
   or text_alignment not in ('left', 'center', 'right', 'justify');

alter table public.newsletter_articles
  alter column title_alignment set default 'left',
  alter column summary_alignment set default 'left',
  alter column body_alignment set default 'left';

alter table public.newsletter_content_blocks
  alter column text_alignment set default 'left';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_articles_title_alignment_check'
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_title_alignment_check
      check (title_alignment in ('left', 'center', 'right', 'justify'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_articles_summary_alignment_check'
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_summary_alignment_check
      check (summary_alignment in ('left', 'center', 'right', 'justify'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_articles_body_alignment_check'
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_body_alignment_check
      check (body_alignment in ('left', 'center', 'right', 'justify'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_content_blocks_text_alignment_check'
  ) then
    alter table public.newsletter_content_blocks
      add constraint newsletter_content_blocks_text_alignment_check
      check (text_alignment in ('left', 'center', 'right', 'justify'));
  end if;
end;
$$;
