-- A1 ISOLATED DEVELOPMENT ONLY. Not approved for Production or remote Staging.
-- No HTTP reader, media worker, Storage write, or existing publication RPC changes.
begin;
do $$
begin
  if current_database() !~ '^mns_a1_[a-z0-9_]+$'
    or inet_server_addr() is null
    or not (inet_server_addr() <<= inet '127.0.0.0/8' or inet_server_addr() = inet '::1') then
    raise exception 'article_publication_isolated_database_required' using errcode = '42501';
  end if;
end $$;

create table public.newsletter_article_publication_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  article_id uuid not null,
  revision_no bigint not null check (revision_no > 0),
  snapshot_schema_version text not null check (snapshot_schema_version = 'a1-text-v1'),
  renderer_version text not null check (renderer_version = 'a1-no-reader'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 1048576),
  expected_media_manifest jsonb not null default '[]' check (expected_media_manifest = '[]'::jsonb),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (article_id, revision_no),
  unique (id, article_id, project_id)
);

create table public.newsletter_article_publications (
  article_id uuid primary key references public.newsletter_articles(id) on delete cascade,
  project_id uuid not null references public.newsletter_projects(id) on delete cascade,
  status text not null default 'never_published' check (status in ('never_published', 'published', 'withdrawn')),
  state_version bigint not null default 0 check (state_version >= 0),
  active_revision_id uuid,
  last_published_revision_id uuid,
  first_published_at timestamptz,
  last_published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, project_id),
  foreign key (active_revision_id, article_id, project_id)
    references public.newsletter_article_publication_revisions(id, article_id, project_id) on delete restrict,
  foreign key (last_published_revision_id, article_id, project_id)
    references public.newsletter_article_publication_revisions(id, article_id, project_id) on delete restrict,
  check ((status = 'published') = (active_revision_id is not null)),
  check ((status = 'never_published' and state_version = 0 and last_published_revision_id is null
    and first_published_at is null and last_published_at is null and withdrawn_at is null)
    or (status <> 'never_published' and state_version > 0 and last_published_revision_id is not null
    and first_published_at is not null and last_published_at is not null)),
  check (status <> 'withdrawn' or withdrawn_at is not null)
);

create table public.newsletter_article_publication_preparations (
  id uuid primary key default gen_random_uuid(),
  preparation_key uuid not null unique,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  article_id uuid not null references public.newsletter_articles(id) on delete cascade,
  project_id uuid not null references public.newsletter_projects(id) on delete cascade,
  actor_id text not null,
  intent text not null check (intent in ('publish', 'replace', 'republish')),
  selection text not null check (selection in ('current_draft', 'historical')),
  expected_state_version bigint not null check (expected_state_version >= 0),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  source_capture jsonb not null check (jsonb_typeof(source_capture) = 'object' and octet_length(source_capture::text) <= 1048576),
  blockers jsonb not null check (jsonb_typeof(blockers) = 'array'),
  revision_id uuid,
  status text not null check (status in ('pending', 'ready', 'committed')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  unique (id, article_id, project_id),
  foreign key (revision_id, article_id, project_id)
    references public.newsletter_article_publication_revisions(id, article_id, project_id) on delete restrict,
  check ((status = 'pending' and revision_id is null) or (status <> 'pending' and revision_id is not null)),
  check (selection <> 'historical' or status <> 'pending')
);

create table public.newsletter_article_publication_events (
  request_key uuid primary key,
  project_id uuid not null references public.newsletter_projects(id) on delete restrict,
  article_id uuid not null references public.newsletter_articles(id) on delete restrict,
  actor_id text not null,
  action text not null check (action in ('publish', 'replace', 'withdraw', 'republish')),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  previous_status text not null check (previous_status in ('never_published', 'published', 'withdrawn')),
  new_status text not null check (new_status in ('published', 'withdrawn')),
  previous_version bigint not null check (previous_version >= 0),
  new_version bigint not null check (new_version = previous_version + 1),
  revision_id uuid not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (revision_id, article_id, project_id)
    references public.newsletter_article_publication_revisions(id, article_id, project_id) on delete restrict,
  unique (article_id, new_version),
  check ((action = 'publish' and previous_status = 'never_published' and new_status = 'published')
    or (action = 'replace' and previous_status = 'published' and new_status = 'published')
    or (action = 'withdraw' and previous_status = 'published' and new_status = 'withdrawn')
    or (action = 'republish' and previous_status = 'withdrawn' and new_status = 'published'))
);

-- Reserved ledger; no worker, verification, pinning or GC is enabled in A1.
-- Deliberately impossible to mark ready/pinned through an RPC in this slice.
create table public.newsletter_article_publication_media (
  id uuid primary key default gen_random_uuid(),
  preparation_id uuid references public.newsletter_article_publication_preparations(id) on delete set null,
  article_id uuid not null,
  project_id uuid not null,
  frozen_revision_id uuid,
  role text not null,
  source_descriptor jsonb not null check (jsonb_typeof(source_descriptor) = 'object'),
  status text not null default 'pending' check (status = 'pending'),
  created_at timestamptz not null default now(),
  foreign key (frozen_revision_id, article_id, project_id)
    references public.newsletter_article_publication_revisions(id, article_id, project_id) on delete restrict
);
create index article_publication_events_project on public.newsletter_article_publication_events(project_id, article_id);
create index article_publication_preparations_article on public.newsletter_article_publication_preparations(article_id);
create index article_publication_media_preparation on public.newsletter_article_publication_media(preparation_id);

create function public.article_publication_a1_guard() returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if current_database() !~ '^mns_a1_[a-z0-9_]+$'
    or inet_server_addr() is null
    or not (inet_server_addr() <<= inet '127.0.0.0/8' or inet_server_addr() = inet '::1')
    or current_setting('newsletter.a1_isolated_test', true) is distinct from 'on' then
    raise exception 'article_publication_disabled' using errcode = '42501';
  end if;
end $$;

create function public.article_publication_hash(p_value jsonb) returns text
language sql immutable strict set search_path = pg_catalog as $$
  select encode(sha256(convert_to(p_value::text, 'UTF8')), 'hex')
$$;

create function public.article_publication_owned_row() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare actual_project uuid;
begin
  if tg_op = 'UPDATE' and (new.article_id is distinct from old.article_id or new.project_id is distinct from old.project_id) then
    raise exception 'article_publication_identity_immutable' using errcode = '23514';
  end if;
  if tg_table_name = 'newsletter_article_publication_media' then
    -- FK SET NULL during deletion of a preparation-only article preserves the
    -- ledger's provenance even after the live parent disappears.
    if tg_op = 'UPDATE' then
      if old.preparation_id is not null and new.preparation_id is null
        and (to_jsonb(new) - 'preparation_id') = (to_jsonb(old) - 'preparation_id') then
        return new;
      end if;
    end if;
    if new.preparation_id is not null and not exists (
      select 1 from public.newsletter_article_publication_preparations p
        where p.id = new.preparation_id and p.article_id = new.article_id and p.project_id = new.project_id) then
      raise exception 'article_publication_ownership_mismatch' using errcode = '23514';
    end if;
  end if;
  -- KEY SHARE also makes direct INSERT race safely with article delete/move.
  select project_id into actual_project from public.newsletter_articles where id = new.article_id for key share;
  if actual_project is distinct from new.project_id then
    raise exception 'article_publication_ownership_mismatch' using errcode = '23514';
  end if;
  return new;
end $$;

create function public.article_publication_immutable_row() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  -- No cleanup/delete escape hatch in A1. Unpublished orphan candidates remain.
  raise exception 'article_publication_history_immutable' using errcode = '23514';
end $$;

create function public.article_publication_source_guard() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.newsletter_article_publication_events where article_id = old.id) then
      raise exception 'article_publication_history_protected' using errcode = 'PT409';
    end if;
    return old;
  end if;
  if new.project_id is distinct from old.project_id and (
    exists (select 1 from public.newsletter_article_publications where article_id = old.id)
    or exists (select 1 from public.newsletter_article_publication_preparations where article_id = old.id)
    or exists (select 1 from public.newsletter_article_publication_revisions where article_id = old.id)
    or exists (select 1 from public.newsletter_article_publication_events where article_id = old.id)
    or exists (select 1 from public.newsletter_article_publication_media where article_id = old.id)) then
    raise exception 'article_publication_project_move_protected' using errcode = 'PT409';
  end if;
  return new;
end $$;

create trigger article_publication_source_guard before delete or update of project_id on public.newsletter_articles
  for each row execute function public.article_publication_source_guard();

do $$
declare t text;
begin
  foreach t in array array['newsletter_article_publications', 'newsletter_article_publication_preparations',
    'newsletter_article_publication_revisions', 'newsletter_article_publication_events', 'newsletter_article_publication_media'] loop
    execute format('create trigger article_publication_owned before insert or update on public.%I for each row execute function public.article_publication_owned_row()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to service_role', t);
  end loop;
end $$;
create trigger article_publication_revision_immutable before update or delete on public.newsletter_article_publication_revisions
  for each row execute function public.article_publication_immutable_row();
create trigger article_publication_event_immutable before update or delete on public.newsletter_article_publication_events
  for each row execute function public.article_publication_immutable_row();

-- All RPCs lock project -> article before state/preparation. Actor is supplied
-- only by a future trusted server; this does not authenticate an HTTP session.
create function public.article_publication_lock_authorize(
  p_project uuid, p_article uuid, p_actor text, p_name text, p_role text, p_assignee text,
  p_allow_inactive boolean default false
) returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare p public.newsletter_projects; a public.newsletter_articles;
begin
  perform public.article_publication_a1_guard();
  if nullif(btrim(p_actor), '') is null or p_role is null or p_role not in ('admin', 'user') then
    raise exception 'article_publication_invalid_actor' using errcode = '22023';
  end if;
  select * into p from public.newsletter_projects where id = p_project for update;
  if not found then raise exception 'article_publication_not_found' using errcode = 'PT404'; end if;
  select * into a from public.newsletter_articles where id = p_article and project_id = p_project for update;
  if not found then raise exception 'article_publication_not_found' using errcode = 'PT404'; end if;
  if coalesce(nullif(btrim(p.assignee_name), ''), '담당자 미지정') is distinct from p_assignee then
    raise exception 'article_publication_assignee_conflict' using errcode = 'PT409';
  end if;
  if p_role <> 'admin' and (nullif(btrim(p.assignee_name), '') is null or
    regexp_replace(lower(p.assignee_name), '[[:space:]]', '', 'g') not in (
      regexp_replace(lower(p_actor), '[[:space:]]', '', 'g'),
      regexp_replace(lower(coalesce(p_name, '')), '[[:space:]]', '', 'g'))) then
    raise exception 'article_publication_forbidden' using errcode = '42501';
  end if;
  if not p_allow_inactive and (p.deleted_at is not null or p.status::text = 'archived'
    or to_jsonb(a)->>'status' = 'archived' or to_jsonb(a)->>'deleted_at' is not null) then
    raise exception 'article_publication_inactive' using errcode = 'PT409';
  end if;
end $$;

-- One STABLE SQL statement: one MVCC snapshot, including child dependencies
-- that do not update article.updated_at. Raw dependency hashes are private;
-- only allowlisted text is retained. No signed/provider/auth payload is copied.
create function public.article_publication_capture(p_project uuid, p_article uuid) returns jsonb
language sql stable security definer set search_path = pg_catalog, public set timezone = 'UTC' as $$
with source as (
  select to_jsonb(a) article,
    (select jsonb_object_agg(key, value) from jsonb_each(to_jsonb(p))
      where key = any(array['id','title','slug','organization_name','issue','published_date',
        'primary_color','default_title_font_asset_id','default_body_font_asset_id',
        'title_font_asset_id','body_font_asset_id','caption_font_asset_id','button_font_asset_id'])) project,
    coalesce((select jsonb_agg(to_jsonb(b) order by b.sort_order, b.id)
      from public.newsletter_content_blocks b where b.article_id = a.id), '[]') blocks,
    coalesce((select jsonb_agg(to_jsonb(l) order by l.sort_order, l.id)
      from public.newsletter_link_actions l where l.article_id = a.id), '[]') links,
    coalesce((select jsonb_agg(to_jsonb(c) order by c.id)
      from public.newsletter_article_compositions c where c.article_id = a.id), '[]') compositions,
    coalesce((select jsonb_agg(to_jsonb(x) order by x.id)
      from public.newsletter_article_composition_assets x
      join public.newsletter_article_compositions c on c.id = x.composition_id where c.article_id = a.id), '[]') placements,
    coalesce((select jsonb_agg(to_jsonb(k) order by k.id)
      from public.newsletter_project_design_kits k where k.project_id = p.id), '[]') design_kits
  from public.newsletter_articles a join public.newsletter_projects p on p.id = a.project_id
  where a.id = p_article and p.id = p_project
), document as (
  select *, jsonb_build_object(
    'article', (select jsonb_object_agg(key,value) from jsonb_each(article)
      where key = any(array['title','display_title','summary','body','text_alignment','title_alignment',
        'summary_alignment','body_alignment','article_type','public_info','title_font_asset_id',
        'body_font_asset_id','caption_font_asset_id','button_font_asset_id'])),
    'project', project - 'id',
    'blocks', coalesce((select jsonb_agg(b - array['id','project_id','article_id','created_at','updated_at'] order by n)
      from jsonb_array_elements(blocks) with ordinality e(b,n)), '[]'),
    'links', coalesce((select jsonb_agg(l - array['id','project_id','article_id','created_at','updated_at'] order by n)
      from jsonb_array_elements(links) with ordinality e(l,n)), '[]')
  ) payload from source
), classified as (
  select *, (
    compositions <> '[]' or placements <> '[]' or design_kits <> '[]'
    or nullif(btrim(coalesce(article->>'title','')), '') is null
    or article->>'survey_id' is not null or article->>'page_id' is not null
    or (article->'public_info' is not null and article->'public_info' <> 'null'
      and jsonb_typeof(article->'public_info') <> 'object')
    or exists(select 1 from (select * from jsonb_each(article)
      union all select * from jsonb_each(coalesce(project, '{}'))) e
      where (e.key like '%asset_id' or e.key like '%audio%' or e.key like '%image%' or e.key like '%tts%')
        and e.value <> 'null'::jsonb and e.value <> '""'::jsonb and e.value <> '"none"'::jsonb)
    or exists(select 1 from jsonb_array_elements(blocks) b where b->>'block_type' is distinct from 'paragraph'
      or b->>'asset_id' is not null or coalesce(b->'metadata','{}') not in ('{}','null'))
    -- A1 cannot sanitize/render HTML or validate media/CTA membership yet.
    or payload::text ~* '(<|https?://|data:|url\s*\(|javascript:|blob:|\\u0000)'
    or links <> '[]' or octet_length(payload::text) > 524288
  ) blocked from document
)
select jsonb_build_object(
  'sourceHash', public.article_publication_hash(jsonb_build_object('article',article,'project',project,
    'blocks',blocks,'links',links,'compositions',compositions,'placements',placements,'designKits',design_kits)),
  'payloadHash', case when not blocked then public.article_publication_hash(payload) else null end,
  'snapshot', case when not blocked then payload else '{}'::jsonb end,
  'blockers', case when blocked then '["media_or_render_contract_not_ready"]'::jsonb else '[]'::jsonb end
) from classified
$$;

create function public.prepare_article_publication(
  p_project uuid, p_article uuid, p_actor text, p_name text, p_role text, p_assignee text,
  p_intent text, p_preparation_key uuid, p_historical_revision uuid default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare s public.newsletter_article_publications; prep public.newsletter_article_publication_preparations;
  capture jsonb; request_hash text; selection text;
begin
  perform public.article_publication_a1_guard();
  if p_preparation_key is null or p_intent is null or p_intent not in ('publish','replace','republish')
    or (p_historical_revision is not null and p_intent <> 'republish') then
    raise exception 'article_publication_invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('a1-prepare:' || p_preparation_key::text, 0));
  perform public.article_publication_lock_authorize(p_project,p_article,p_actor,p_name,p_role,p_assignee);
  selection := case when p_historical_revision is null then 'current_draft' else 'historical' end;
  request_hash := public.article_publication_hash(jsonb_build_array(p_project,p_article,p_actor,p_name,p_role,p_assignee,p_intent,p_historical_revision));
  select * into prep from public.newsletter_article_publication_preparations where preparation_key = p_preparation_key for update;
  if found then
    if prep.request_hash <> request_hash then raise exception 'article_publication_key_conflict' using errcode = 'PT409'; end if;
    if prep.expires_at <= now() or prep.status = 'committed' then raise exception 'article_publication_preparation_expired' using errcode = 'PT409'; end if;
    return jsonb_build_object('preparationId',prep.id,'sourceHash',prep.source_hash,'revisionId',prep.revision_id,
      'expectedStateVersion',prep.expected_state_version,'status',prep.status,'blockers',prep.blockers,'duplicate',true);
  end if;
  insert into public.newsletter_article_publications(article_id,project_id) values(p_article,p_project) on conflict do nothing;
  select * into s from public.newsletter_article_publications where article_id = p_article for update;
  if not ((p_intent = 'publish' and s.status = 'never_published') or (p_intent = 'replace' and s.status = 'published')
    or (p_intent = 'republish' and s.status = 'withdrawn')) then
    raise exception 'article_publication_state_conflict' using errcode = 'PT409';
  end if;
  capture := public.article_publication_capture(p_project,p_article);
  if p_historical_revision is not null and not exists (
    select 1 from public.newsletter_article_publication_events where article_id = p_article
      and project_id = p_project and revision_id = p_historical_revision and action <> 'withdraw') then
    raise exception 'article_publication_revision_not_published' using errcode = 'PT409';
  end if;
  insert into public.newsletter_article_publication_preparations(preparation_key,request_hash,article_id,project_id,actor_id,
    intent,selection,expected_state_version,source_hash,source_capture,blockers,revision_id,status)
  values(p_preparation_key,request_hash,p_article,p_project,p_actor,p_intent,selection,s.state_version,
    capture->>'sourceHash',capture,case when selection = 'historical' then '[]'::jsonb else capture->'blockers' end,
    p_historical_revision,case when selection = 'historical' then 'ready' else 'pending' end) returning * into prep;
  return jsonb_build_object('preparationId',prep.id,'sourceHash',prep.source_hash,'revisionId',prep.revision_id,
    'expectedStateVersion',prep.expected_state_version,'status',prep.status,'blockers',prep.blockers,'duplicate',false);
end $$;

create function public.finalize_article_publication_preparation(
  p_project uuid, p_article uuid, p_actor text, p_name text, p_role text, p_assignee text, p_preparation uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare prep public.newsletter_article_publication_preparations; capture jsonb; revision uuid; version bigint;
begin
  perform public.article_publication_lock_authorize(p_project,p_article,p_actor,p_name,p_role,p_assignee);
  select state_version into version from public.newsletter_article_publications where article_id = p_article for update;
  select * into prep from public.newsletter_article_publication_preparations
    where id = p_preparation and article_id = p_article and project_id = p_project and actor_id = p_actor for update;
  if not found then raise exception 'article_publication_not_found' using errcode = 'PT404'; end if;
  if prep.expires_at <= now() or prep.status = 'committed' then raise exception 'article_publication_preparation_expired' using errcode = 'PT409'; end if;
  if prep.expected_state_version <> version then raise exception 'article_publication_stale' using errcode = 'PT409'; end if;
  capture := public.article_publication_capture(p_project,p_article);
  if prep.selection = 'current_draft' and capture->>'sourceHash' <> prep.source_hash then
    raise exception 'article_publication_source_stale' using errcode = 'PT409';
  end if;
  if prep.blockers <> '[]' or (prep.selection = 'current_draft' and capture->'blockers' <> '[]') then
    raise exception 'article_publication_media_not_ready' using errcode = 'PT409';
  end if;
  if exists (select 1 from public.newsletter_article_publication_media
    where preparation_id = prep.id or frozen_revision_id = prep.revision_id) then
    raise exception 'article_publication_media_not_ready' using errcode = 'PT409';
  end if;
  if prep.status = 'ready' then return jsonb_build_object('revisionId',prep.revision_id,'duplicate',true); end if;
  insert into public.newsletter_article_publication_revisions(project_id,article_id,revision_no,snapshot_schema_version,
    renderer_version,source_hash,payload_hash,snapshot,created_by)
  select p_project,p_article,coalesce(max(revision_no),0)+1,'a1-text-v1','a1-no-reader',prep.source_hash,
    capture->>'payloadHash',capture->'snapshot',p_actor from public.newsletter_article_publication_revisions where article_id = p_article
  returning id into revision;
  update public.newsletter_article_publication_preparations set revision_id = revision,status = 'ready' where id = prep.id;
  return jsonb_build_object('revisionId',revision,'duplicate',false);
end $$;

create function public.transition_article_publication_atomic(
  p_project uuid, p_article uuid, p_actor text, p_name text, p_role text, p_assignee text,
  p_request_key uuid, p_action text, p_expected_version bigint, p_preparation uuid,
  p_expected_source_hash text, p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare s public.newsletter_article_publications; prep public.newsletter_article_publication_preparations;
  event public.newsletter_article_publication_events; r public.newsletter_article_publication_revisions;
  request_hash text; capture jsonb; result jsonb; new_status text;
begin
  perform public.article_publication_a1_guard();
  if p_request_key is null or p_action is null or p_action not in ('publish','replace','withdraw','republish')
    or p_expected_version is null or p_expected_version < 0 or p_confirmed is distinct from true
    or (p_action <> 'withdraw' and (p_preparation is null or p_expected_source_hash is null))
    or (p_action = 'withdraw' and (p_preparation is not null or p_expected_source_hash is not null)) then
    raise exception 'article_publication_invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('a1-transition:' || p_request_key::text, 0));
  perform public.article_publication_lock_authorize(p_project,p_article,p_actor,p_name,p_role,p_assignee,p_action = 'withdraw');
  select * into s from public.newsletter_article_publications where article_id = p_article for update;
  if not found then raise exception 'article_publication_state_conflict' using errcode = 'PT409'; end if;
  request_hash := public.article_publication_hash(jsonb_build_array(p_project,p_article,p_actor,p_name,p_role,p_assignee,
    p_action,p_expected_version,p_preparation,p_expected_source_hash,p_confirmed));
  select * into event from public.newsletter_article_publication_events where request_key = p_request_key;
  if found then
    if event.request_hash <> request_hash then raise exception 'article_publication_key_conflict' using errcode = 'PT409'; end if;
    return event.result || jsonb_build_object('duplicate',true,'currentStatus',s.status,'currentVersion',s.state_version);
  end if;
  if s.state_version <> p_expected_version then raise exception 'article_publication_stale' using errcode = 'PT409'; end if;
  if not ((p_action = 'publish' and s.status = 'never_published') or (p_action in ('replace','withdraw') and s.status = 'published')
    or (p_action = 'republish' and s.status = 'withdrawn')) then
    raise exception 'article_publication_state_conflict' using errcode = 'PT409';
  end if;
  if p_action <> 'withdraw' then
    select * into prep from public.newsletter_article_publication_preparations
      where id = p_preparation and article_id = p_article and project_id = p_project and actor_id = p_actor for update;
    if not found then raise exception 'article_publication_not_found' using errcode = 'PT404'; end if;
    if prep.status <> 'ready' or prep.expires_at <= now() or prep.intent <> p_action
      or prep.expected_state_version <> s.state_version or prep.source_hash <> p_expected_source_hash then
      raise exception 'article_publication_preparation_conflict' using errcode = 'PT409';
    end if;
    if prep.selection = 'current_draft' then
      capture := public.article_publication_capture(p_project,p_article);
      if capture->>'sourceHash' <> prep.source_hash then raise exception 'article_publication_source_stale' using errcode = 'PT409'; end if;
      if capture->'blockers' <> '[]' or prep.blockers <> '[]' then
        raise exception 'article_publication_media_not_ready' using errcode = 'PT409';
      end if;
    elsif not exists (select 1 from public.newsletter_article_publication_events where article_id = p_article
      and project_id = p_project and revision_id = prep.revision_id and action <> 'withdraw') then
      raise exception 'article_publication_revision_not_published' using errcode = 'PT409';
    end if;
    select * into r from public.newsletter_article_publication_revisions
      where id = prep.revision_id and article_id = p_article and project_id = p_project;
    if not found or r.expected_media_manifest <> '[]' or exists (
      select 1 from public.newsletter_article_publication_media where preparation_id = prep.id or frozen_revision_id = r.id) then
      raise exception 'article_publication_media_not_ready' using errcode = 'PT409';
    end if;
    if p_action = 'replace' and r.payload_hash = (select payload_hash from public.newsletter_article_publication_revisions where id = s.active_revision_id) then
      return jsonb_build_object('unchanged',true,'duplicate',false,'currentStatus',s.status,'currentVersion',s.state_version);
    end if;
  else
    select * into r from public.newsletter_article_publication_revisions where id = s.active_revision_id;
  end if;
  new_status := case when p_action = 'withdraw' then 'withdrawn' else 'published' end;
  update public.newsletter_article_publications set status = new_status,state_version = s.state_version + 1,
    active_revision_id = case when new_status = 'published' then r.id else null end,
    last_published_revision_id = r.id,
    first_published_at = coalesce(first_published_at,now()),
    last_published_at = case when new_status = 'published' then now() else last_published_at end,
    withdrawn_at = case when new_status = 'withdrawn' then now() else null end,updated_at = now()
    where article_id = p_article;
  result := jsonb_build_object('requestKey',p_request_key,'articleId',p_article,'revisionId',r.id,'action',p_action,
    'status',new_status,'stateVersion',s.state_version + 1,'executedAt',now(),'duplicate',false,'unchanged',false);
  insert into public.newsletter_article_publication_events(request_key,project_id,article_id,actor_id,action,request_hash,
    previous_status,new_status,previous_version,new_version,revision_id,result)
  values(p_request_key,p_project,p_article,p_actor,p_action,request_hash,s.status,new_status,s.state_version,s.state_version+1,r.id,result);
  if p_action <> 'withdraw' then update public.newsletter_article_publication_preparations set status = 'committed' where id = prep.id; end if;
  return result || jsonb_build_object('currentStatus',new_status,'currentVersion',s.state_version+1);
end $$;

-- Explicit ACL for every new helper/RPC. Existing function grants are untouched.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'article_publication_%'
      or p.proname in ('prepare_article_publication','finalize_article_publication_preparation','transition_article_publication_atomic')) loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.signature);
    if f.proname in ('prepare_article_publication','finalize_article_publication_preparation','transition_article_publication_atomic') then
      execute format('grant execute on function %s to service_role', f.signature);
    end if;
  end loop;
end $$;
commit;
