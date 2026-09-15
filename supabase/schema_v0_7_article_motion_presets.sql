-- Mobile Newsletter Studio / Supabase migration v0.7
-- Purpose: add per-article mobile motion preset settings.
-- Run this once in the Supabase SQL editor before saving article motion presets.

alter table newsletter_articles
  add column if not exists motion_preset text not null default 'dynamic';

alter table newsletter_articles
  add column if not exists motion_speed text not null default 'normal';

update newsletter_articles
set
  motion_preset = coalesce(nullif(motion_preset, ''), 'dynamic'),
  motion_speed = coalesce(nullif(motion_speed, ''), 'normal');

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_motion_preset_check
    check (motion_preset in ('none', 'calm', 'image_focus', 'promotion', 'dynamic'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_motion_speed_check
    check (motion_speed in ('slow', 'normal', 'fast'));
exception
  when duplicate_object then null;
end $$;
