-- Mobile Newsletter Studio v1.27
-- Atomic same-project article composition placement copy.

begin;

create or replace function public.copy_newsletter_article_composition_atomic(
  p_project_id uuid,
  p_source_article_id uuid,
  p_target_article_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_project_id uuid;
  v_target_project_id uuid;
  v_source_composition_id uuid;
  v_target_composition_id uuid;
  v_copied_placement_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_project_id is null
    or p_source_article_id is null
    or p_target_article_id is null then
    raise exception 'composition_copy_identifiers_required' using errcode = '22023';
  end if;

  if p_source_article_id = p_target_article_id then
    raise exception 'composition_copy_same_article' using errcode = '22023';
  end if;

  -- Lock both articles in a deterministic order so reverse-direction copies
  -- cannot deadlock each other.
  perform 1
  from public.newsletter_articles article
  where article.id in (p_source_article_id, p_target_article_id)
  order by article.id
  for update;

  select article.project_id
  into v_source_project_id
  from public.newsletter_articles article
  where article.id = p_source_article_id;

  select article.project_id
  into v_target_project_id
  from public.newsletter_articles article
  where article.id = p_target_article_id;

  if v_source_project_id is null or v_target_project_id is null then
    raise exception 'composition_copy_article_not_found' using errcode = 'P0002';
  end if;

  if v_source_project_id is distinct from v_target_project_id
    or v_source_project_id is distinct from p_project_id then
    raise exception 'composition_copy_project_mismatch' using errcode = '23514';
  end if;

  -- Serialize composition status and placement changes for both articles.
  perform 1
  from public.newsletter_article_compositions composition
  where composition.article_id in (p_source_article_id, p_target_article_id)
  order by composition.article_id
  for update;

  select composition.id
  into v_source_composition_id
  from public.newsletter_article_compositions composition
  where composition.project_id = p_project_id
    and composition.article_id = p_source_article_id;

  if v_source_composition_id is null then
    raise exception 'composition_copy_source_not_found' using errcode = 'P0002';
  end if;

  select composition.id
  into v_target_composition_id
  from public.newsletter_article_compositions composition
  where composition.project_id = p_project_id
    and composition.article_id = p_target_article_id;

  if v_target_composition_id is null then
    insert into public.newsletter_article_compositions (
      project_id,
      article_id,
      layout_key,
      status,
      settings
    ) values (
      p_project_id,
      p_target_article_id,
      'standard',
      'draft',
      '{}'::jsonb
    )
    returning id into v_target_composition_id;
  else
    update public.newsletter_article_compositions
    set status = 'draft'
    where id = v_target_composition_id;
  end if;

  -- Block concurrent edits to the source snapshot while the target is replaced.
  perform 1
  from public.newsletter_article_composition_assets placement
  where placement.composition_id = v_source_composition_id
  order by placement.id
  for share;

  delete from public.newsletter_article_composition_assets
  where composition_id = v_target_composition_id;

  insert into public.newsletter_article_composition_assets (
    composition_id,
    asset_id,
    slot,
    sort_order,
    is_visible,
    settings
  )
  select
    v_target_composition_id,
    source_placement.asset_id,
    source_placement.slot,
    source_placement.sort_order,
    source_placement.is_visible,
    source_placement.settings
  from public.newsletter_article_composition_assets source_placement
  where source_placement.composition_id = v_source_composition_id
  order by source_placement.slot, source_placement.sort_order, source_placement.id;

  get diagnostics v_copied_placement_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'composition_id', v_target_composition_id,
    'copied_placement_count', v_copied_placement_count
  );
end;
$$;

revoke execute on function public.copy_newsletter_article_composition_atomic(uuid, uuid, uuid) from public;
revoke execute on function public.copy_newsletter_article_composition_atomic(uuid, uuid, uuid) from anon;
revoke execute on function public.copy_newsletter_article_composition_atomic(uuid, uuid, uuid) from authenticated;
grant execute on function public.copy_newsletter_article_composition_atomic(uuid, uuid, uuid) to service_role;

commit;
