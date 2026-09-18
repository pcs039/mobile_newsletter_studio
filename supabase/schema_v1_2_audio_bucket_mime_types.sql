-- Allow newsletter voice uploads from common audio sources:
-- external TTS exports, iPhone Voice Memos, and macOS recordings.
-- Existing object paths and newsletter_audio_files records are unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio-files',
  'audio-files',
  false,
  52428800,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/x-mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac'
  ]
)
on conflict (id) do update
set
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit),
  allowed_mime_types = excluded.allowed_mime_types;
