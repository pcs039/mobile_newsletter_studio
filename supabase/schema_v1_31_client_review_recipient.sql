-- Staging first. Production requires a separate controlled application.
begin;
alter table public.newsletter_projects
  add column if not exists client_review_recipient_email text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.newsletter_projects'::regclass
    and conname = 'newsletter_projects_client_review_recipient_email_check') then
    alter table public.newsletter_projects add constraint newsletter_projects_client_review_recipient_email_check
      check (client_review_recipient_email is null or (
        char_length(client_review_recipient_email) between 3 and 254
        and client_review_recipient_email = btrim(client_review_recipient_email)
      ));
  end if;
end;
$$;
comment on column public.newsletter_projects.client_review_recipient_email is
  'Private institutional review recipient. Read/write through authorized project API only; omit from public/review payloads.';
notify pgrst, 'reload schema';
commit;
