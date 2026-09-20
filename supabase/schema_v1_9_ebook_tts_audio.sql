-- Mobile Newsletter Studio / schema v1.9
-- Purpose: store generated internal e-book page TTS audio metadata.

alter table public.newsletter_pages
  add column if not exists tts_audio_paths jsonb not null default '[]'::jsonb,
  add column if not exists tts_audio_updated_at timestamptz,
  add column if not exists tts_text_hash text,
  add column if not exists tts_voice text,
  add column if not exists tts_model text;

update public.newsletter_pages
set tts_audio_paths = '[]'::jsonb
where tts_audio_paths is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'newsletter_pages_tts_audio_paths_array'
  ) then
    alter table public.newsletter_pages
      add constraint newsletter_pages_tts_audio_paths_array
      check (jsonb_typeof(tts_audio_paths) = 'array') not valid;

    alter table public.newsletter_pages
      validate constraint newsletter_pages_tts_audio_paths_array;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ebook-tts-audio',
  'ebook-tts-audio',
  false,
  52428800,
  array[
    'audio/mpeg',
    'audio/mp3'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit),
  allowed_mime_types = excluded.allowed_mime_types;
