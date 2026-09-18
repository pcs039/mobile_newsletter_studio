-- Add the missing audio transcript type field.
-- Existing audio linkage, audio_mp3 kind, storage paths, and script fields remain unchanged.

alter table if exists newsletter_audio_files
  add column if not exists transcript_type text;

update newsletter_audio_files
set transcript_type = 'custom_script'
where transcript_type is null;

alter table if exists newsletter_audio_files
  alter column transcript_type set default 'custom_script';

update newsletter_audio_files
set script_status = 'pending'
where script_status = 'unchecked';

alter table if exists newsletter_audio_files
  alter column script_status set default 'pending';
