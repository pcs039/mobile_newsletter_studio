-- Staging only. Existing links and content rows are unchanged.
-- Execute only against confirmed project ref mvrkpmffuhcqwisqvpqi.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
do $$ begin
  if not exists(select 1 from public.newsletter_projects where id='4cd5297e-a0fd-434c-84d4-fa4d3baf9389' and slug='hwaseong-2026-10-samples') then
    raise exception 'Expected Staging sample project is absent';
  end if;
end $$;
alter table public.newsletter_project_demo_shares alter column expires_at drop not null;
alter table public.newsletter_project_demo_shares add constraint newsletter_demo_no_expiry_sample_only
  check (expires_at is not null or project_id='4cd5297e-a0fd-434c-84d4-fa4d3baf9389');
commit;
-- Rollback after confirming there are no active no-expiry links: restore their
-- expiry explicitly, then DROP CONSTRAINT and SET NOT NULL. Never delete source.
