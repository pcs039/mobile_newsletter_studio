begin;

-- article_view: first actual article exposure per temporary browser session.
-- audio_play: first actual audio playback per article and temporary session.
-- Click events record each deliberate phone, map, CTA, or linked survey action.
create table if not exists public.newsletter_article_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.newsletter_projects(id)
    on delete cascade,
  article_id uuid not null
    references public.newsletter_articles(id)
    on delete cascade,
  link_action_id uuid null
    references public.newsletter_link_actions(id)
    on delete set null,
  survey_id uuid null
    references public.newsletter_surveys(id)
    on delete set null,
  event_type text not null
    check (
      event_type in (
        'article_view',
        'phone_click',
        'map_click',
        'cta_click',
        'survey_click',
        'audio_play'
      )
    ),
  session_hash text null,
  route_path text null,
  device_type text null
    check (device_type is null or device_type in ('mobile', 'tablet', 'pc')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists newsletter_article_events_project_time_idx
  on public.newsletter_article_events(project_id, occurred_at desc);

create index if not exists newsletter_article_events_project_article_type_idx
  on public.newsletter_article_events(project_id, article_id, event_type);

create unique index if not exists newsletter_article_events_session_once_idx
  on public.newsletter_article_events(article_id, event_type, session_hash)
  where session_hash is not null
    and event_type in ('article_view', 'audio_play');

alter table public.newsletter_article_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'newsletter_article_events'
      and policyname = 'Service role manages article events'
  ) then
    create policy "Service role manages article events"
      on public.newsletter_article_events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

commit;
