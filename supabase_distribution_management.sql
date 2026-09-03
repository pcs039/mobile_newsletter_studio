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
  target_group_id uuid references newsletter_recipient_groups(id) on delete set null,
  target_group_name text,
  message_title text not null,
  public_url text,
  status text not null default 'ready'
    check (status in ('draft', 'ready', 'sent', 'failed')),
  sent_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_send_campaigns_project_id_idx
  on newsletter_send_campaigns(project_id);

create index if not exists newsletter_send_campaigns_target_group_id_idx
  on newsletter_send_campaigns(target_group_id);
