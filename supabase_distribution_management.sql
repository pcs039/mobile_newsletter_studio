create table if not exists newsletter_recipient_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  name text not null,
  description text,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  channel_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_recipient_groups_project_id_idx
  on newsletter_recipient_groups(project_id);

create table if not exists newsletter_send_campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  channel text not null default 'kakao'
    check (channel in ('kakao', 'sms', 'email', 'qr', 'manual')),
  campaign_type text not null default 'first_notice'
    check (campaign_type in ('first_notice', 'second_notice', 'reminder', 'fallback_sms', 'qr_share', 'test', 'other')),
  target_group_id uuid references newsletter_recipient_groups(id) on delete set null,
  target_group_name text,
  message_title text not null,
  public_url text,
  status text not null default 'ready'
    check (status in ('draft', 'ready', 'sent', 'failed')),
  sent_at timestamptz,
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table newsletter_send_campaigns
  add column if not exists campaign_type text not null default 'first_notice';

alter table newsletter_send_campaigns
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_send_campaigns_campaign_type_check'
  ) then
    alter table newsletter_send_campaigns
      add constraint newsletter_send_campaigns_campaign_type_check
      check (campaign_type in ('first_notice', 'second_notice', 'reminder', 'fallback_sms', 'qr_share', 'test', 'other'));
  end if;
end;
$$;

create index if not exists newsletter_send_campaigns_project_id_idx
  on newsletter_send_campaigns(project_id);

create index if not exists newsletter_send_campaigns_active_project_id_idx
  on newsletter_send_campaigns(project_id)
  where deleted_at is null;

create index if not exists newsletter_send_campaigns_target_group_id_idx
  on newsletter_send_campaigns(target_group_id);

with ranked_groups as (
  select
    id,
    first_value(id) over (
      partition by project_id, lower(btrim(name))
      order by updated_at desc, created_at desc, id desc
    ) as keep_id,
    row_number() over (
      partition by project_id, lower(btrim(name))
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from newsletter_recipient_groups
)
update newsletter_send_campaigns
set
  target_group_id = ranked_groups.keep_id,
  updated_at = now()
from ranked_groups
where newsletter_send_campaigns.target_group_id = ranked_groups.id
  and ranked_groups.duplicate_rank > 1;

with ranked_groups as (
  select
    id,
    row_number() over (
      partition by project_id, lower(btrim(name))
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from newsletter_recipient_groups
)
delete from newsletter_recipient_groups
using ranked_groups
where newsletter_recipient_groups.id = ranked_groups.id
  and ranked_groups.duplicate_rank > 1;

create unique index if not exists newsletter_recipient_groups_project_name_uidx
  on newsletter_recipient_groups(project_id, lower(btrim(name)));

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_recipient_groups_set_updated_at on newsletter_recipient_groups;
create trigger newsletter_recipient_groups_set_updated_at
before update on newsletter_recipient_groups
for each row execute function set_updated_at();

drop trigger if exists newsletter_send_campaigns_set_updated_at on newsletter_send_campaigns;
create trigger newsletter_send_campaigns_set_updated_at
before update on newsletter_send_campaigns
for each row execute function set_updated_at();

alter table newsletter_recipient_groups enable row level security;
alter table newsletter_send_campaigns enable row level security;
