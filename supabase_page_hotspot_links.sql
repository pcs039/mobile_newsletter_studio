create table if not exists newsletter_page_hotspot_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  page_id uuid not null references newsletter_pages(id) on delete cascade,
  label text not null,
  link_type text not null default 'url'
    check (link_type in ('url', 'phone', 'map', 'video')),
  target_value text not null,
  x_percent numeric(6, 2) not null default 10 check (x_percent >= 0 and x_percent <= 100),
  y_percent numeric(6, 2) not null default 10 check (y_percent >= 0 and y_percent <= 100),
  width_percent numeric(6, 2) not null default 30 check (width_percent >= 0 and width_percent <= 100),
  height_percent numeric(6, 2) not null default 10 check (height_percent >= 0 and height_percent <= 100),
  sort_order integer not null default 10 check (sort_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_page_hotspot_links_bounds_check
    check (x_percent + width_percent <= 100 and y_percent + height_percent <= 100)
);

create index if not exists newsletter_page_hotspot_links_project_id_idx
  on newsletter_page_hotspot_links(project_id);

create index if not exists newsletter_page_hotspot_links_page_id_idx
  on newsletter_page_hotspot_links(page_id);

create index if not exists newsletter_page_hotspot_links_visible_page_order_idx
  on newsletter_page_hotspot_links(page_id, sort_order)
  where is_visible = true;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletter_page_hotspot_links_set_updated_at on newsletter_page_hotspot_links;
create trigger newsletter_page_hotspot_links_set_updated_at
before update on newsletter_page_hotspot_links
for each row execute function set_updated_at();

alter table newsletter_page_hotspot_links enable row level security;
