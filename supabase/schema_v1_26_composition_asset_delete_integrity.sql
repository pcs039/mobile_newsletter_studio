-- Mobile Newsletter Studio v1.26
-- Preserve direct in-use asset protection while allowing project-wide cascades
-- to remove composition placements and project design assets in one statement.

begin;

alter table public.newsletter_article_composition_assets
  drop constraint if exists newsletter_article_composition_assets_asset_id_fkey;

alter table public.newsletter_article_composition_assets
  add constraint newsletter_article_composition_assets_asset_id_fkey
  foreign key (asset_id)
  references public.newsletter_project_design_assets(id)
  on delete no action
  deferrable initially deferred;

commit;
