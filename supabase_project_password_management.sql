-- Project password management for DataDiction Newsletter Studio
-- Run this once in Supabase SQL Editor before deploying the project-password code.

alter table newsletter_projects
  add column if not exists project_password_hash text,
  add column if not exists project_password_updated_at timestamptz;

comment on column newsletter_projects.project_password_hash is
  'Hashed project-level password used for non-admin project workspace unlock.';

comment on column newsletter_projects.project_password_updated_at is
  'Timestamp when the project-level password was last set or changed.';
