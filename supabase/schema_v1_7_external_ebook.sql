alter table public.newsletter_projects
  add column if not exists ebook_source text not null default 'internal',
  add column if not exists external_ebook_url text;

update public.newsletter_projects
set ebook_source = 'internal'
where ebook_source is null
  or ebook_source not in ('internal', 'external');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_projects_ebook_source_check'
  ) then
    alter table public.newsletter_projects
      add constraint newsletter_projects_ebook_source_check
      check (ebook_source in ('internal', 'external'));
  end if;
end $$;
