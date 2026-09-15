-- Mobile Newsletter Studio / Supabase migration v0.8
-- Purpose: add element-level motion settings for public mobile articles.
-- Run this once in the Supabase SQL editor before saving element motion settings.

alter table newsletter_articles
  add column if not exists title_motion_effect text not null default 'inherit';

alter table newsletter_articles
  add column if not exists title_motion_speed text not null default 'inherit';

alter table newsletter_articles
  add column if not exists text_box_motion_effect text not null default 'inherit';

alter table newsletter_articles
  add column if not exists text_box_motion_speed text not null default 'inherit';

alter table newsletter_articles
  add column if not exists image_motion_effect text not null default 'inherit';

alter table newsletter_articles
  add column if not exists image_motion_speed text not null default 'inherit';

alter table newsletter_articles
  add column if not exists link_motion_effect text not null default 'inherit';

alter table newsletter_articles
  add column if not exists link_motion_speed text not null default 'inherit';

update newsletter_articles
set
  title_motion_effect = coalesce(nullif(title_motion_effect, ''), 'inherit'),
  title_motion_speed = coalesce(nullif(title_motion_speed, ''), 'inherit'),
  text_box_motion_effect = coalesce(nullif(text_box_motion_effect, ''), 'inherit'),
  text_box_motion_speed = coalesce(nullif(text_box_motion_speed, ''), 'inherit'),
  image_motion_effect = coalesce(nullif(image_motion_effect, ''), 'inherit'),
  image_motion_speed = coalesce(nullif(image_motion_speed, ''), 'inherit'),
  link_motion_effect = coalesce(nullif(link_motion_effect, ''), 'inherit'),
  link_motion_speed = coalesce(nullif(link_motion_speed, ''), 'inherit');

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_title_motion_effect_check
    check (title_motion_effect in ('inherit', 'none', 'fade_up', 'char_by_char', 'card_lift', 'fade_in', 'reveal_up', 'soft_zoom', 'blur_clear', 'soft_emphasis'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_text_box_motion_effect_check
    check (text_box_motion_effect in ('inherit', 'none', 'fade_up', 'char_by_char', 'card_lift', 'fade_in', 'reveal_up', 'soft_zoom', 'blur_clear', 'soft_emphasis'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_image_motion_effect_check
    check (image_motion_effect in ('inherit', 'none', 'fade_up', 'char_by_char', 'card_lift', 'fade_in', 'reveal_up', 'soft_zoom', 'blur_clear', 'soft_emphasis'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_link_motion_effect_check
    check (link_motion_effect in ('inherit', 'none', 'fade_up', 'char_by_char', 'card_lift', 'fade_in', 'reveal_up', 'soft_zoom', 'blur_clear', 'soft_emphasis'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_title_motion_speed_check
    check (title_motion_speed in ('inherit', 'slow', 'normal', 'fast'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_text_box_motion_speed_check
    check (text_box_motion_speed in ('inherit', 'slow', 'normal', 'fast'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_image_motion_speed_check
    check (image_motion_speed in ('inherit', 'slow', 'normal', 'fast'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table newsletter_articles
    add constraint newsletter_articles_link_motion_speed_check
    check (link_motion_speed in ('inherit', 'slow', 'normal', 'fast'));
exception
  when duplicate_object then null;
end $$;
