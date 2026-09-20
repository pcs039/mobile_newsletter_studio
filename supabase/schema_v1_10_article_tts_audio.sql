-- Mobile Newsletter Studio / schema v1.10
-- Purpose: keep uploaded article audio and AI-generated article TTS audio side by side.

alter table public.newsletter_projects
  add column if not exists article_tts_voice text null default 'marin';

alter table public.newsletter_articles
  add column if not exists audio_source text null default null,
  add column if not exists article_tts_voice text null,
  add column if not exists ai_audio_id uuid null references public.newsletter_audio_files(id) on delete set null;

alter table public.newsletter_audio_files
  add column if not exists source_type text null default 'uploaded',
  add column if not exists ai_tts_audio_paths jsonb not null default '[]'::jsonb,
  add column if not exists ai_tts_text_hash text null,
  add column if not exists ai_tts_voice text null,
  add column if not exists ai_tts_model text null,
  add column if not exists ai_tts_generated_at timestamptz null;

update public.newsletter_audio_files
set source_type = 'uploaded'
where source_type is null;

update public.newsletter_audio_files
set ai_tts_audio_paths = '[]'::jsonb
where ai_tts_audio_paths is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_projects_article_tts_voice_allowed'
  ) then
    alter table public.newsletter_projects
      add constraint newsletter_projects_article_tts_voice_allowed
      check (article_tts_voice is null or article_tts_voice in ('marin', 'cedar', 'onyx', 'coral')) not valid;

    alter table public.newsletter_projects
      validate constraint newsletter_projects_article_tts_voice_allowed;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_articles_audio_source_allowed'
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_audio_source_allowed
      check (audio_source is null or audio_source in ('uploaded', 'ai_tts', 'none')) not valid;

    alter table public.newsletter_articles
      validate constraint newsletter_articles_audio_source_allowed;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_articles_article_tts_voice_allowed'
  ) then
    alter table public.newsletter_articles
      add constraint newsletter_articles_article_tts_voice_allowed
      check (article_tts_voice is null or article_tts_voice in ('marin', 'cedar', 'onyx', 'coral')) not valid;

    alter table public.newsletter_articles
      validate constraint newsletter_articles_article_tts_voice_allowed;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_audio_files_source_type_allowed'
  ) then
    alter table public.newsletter_audio_files
      add constraint newsletter_audio_files_source_type_allowed
      check (source_type is null or source_type in ('uploaded', 'ai_tts')) not valid;

    alter table public.newsletter_audio_files
      validate constraint newsletter_audio_files_source_type_allowed;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_audio_files_ai_tts_audio_paths_array'
  ) then
    alter table public.newsletter_audio_files
      add constraint newsletter_audio_files_ai_tts_audio_paths_array
      check (jsonb_typeof(ai_tts_audio_paths) = 'array') not valid;

    alter table public.newsletter_audio_files
      validate constraint newsletter_audio_files_ai_tts_audio_paths_array;
  end if;
end $$;
