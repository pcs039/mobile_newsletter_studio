-- Mobile Newsletter Studio v1.28
-- Atomic same-project article composition placement copy to multiple targets.

begin;

create or replace function public.copy_newsletter_article_compositions_batch_atomic(
  p_project_id uuid,
  p_source_article_id uuid,
  p_target_article_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested_target_count integer;
  v_distinct_target_count integer;
  v_locked_article_count integer;
  v_source_composition_id uuid;
  v_source_placement_count integer;
  v_copied_placement_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_project_id is null or p_source_article_id is null then
    raise exception 'composition_batch_copy_identifiers_required' using errcode = '22023';
  end if;

  v_requested_target_count := coalesce(cardinality(p_target_article_ids), 0);

  if v_requested_target_count = 0 then
    raise exception 'composition_batch_copy_targets_required' using errcode = '22023';
  end if;

  if array_position(p_target_article_ids, null) is not null then
    raise exception 'composition_batch_copy_identifiers_required' using errcode = '22023';
  end if;

  select count(distinct target_id)
  into v_distinct_target_count
  from unnest(p_target_article_ids) as target(target_id);

  if v_distinct_target_count <> v_requested_target_count then
    raise exception 'composition_batch_copy_duplicate_targets' using errcode = '22023';
  end if;

  if p_source_article_id = any(p_target_article_ids) then
    raise exception 'composition_batch_copy_source_in_targets' using errcode = '22023';
  end if;

  -- Use the same deterministic article lock order as the single-target copy RPC.
  perform 1
  from public.newsletter_articles article
  where article.id = p_source_article_id
    or article.id = any(p_target_article_ids)
  order by article.id
  for update;

  get diagnostics v_locked_article_count = row_count;

  if v_locked_article_count <> v_requested_target_count + 1 then
    raise exception 'composition_batch_copy_article_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.newsletter_articles article
    where (article.id = p_source_article_id or article.id = any(p_target_article_ids))
      and article.project_id is distinct from p_project_id
  ) then
    raise exception 'composition_batch_copy_project_mismatch' using errcode = '23514';
  end if;

  -- Lock existing compositions in article order before creating missing targets.
  perform 1
  from public.newsletter_article_compositions composition
  where composition.article_id = p_source_article_id
    or composition.article_id = any(p_target_article_ids)
  order by composition.article_id
  for update;

  select composition.id
  into v_source_composition_id
  from public.newsletter_article_compositions composition
  where composition.project_id = p_project_id
    and composition.article_id = p_source_article_id;

  if v_source_composition_id is null then
    raise exception 'composition_batch_copy_source_not_found' using errcode = 'P0002';
  end if;

  insert into public.newsletter_article_compositions (
    project_id,
    article_id,
    layout_key,
    status,
    settings
  )
  select
    p_project_id,
    article.id,
    'standard',
    'draft',
    '{}'::jsonb
  from public.newsletter_articles article
  where article.id = any(p_target_article_ids)
    and not exists (
      select 1
      from public.newsletter_article_compositions composition
      where composition.article_id = article.id
    )
  order by article.id;

  update public.newsletter_article_compositions composition
  set status = 'draft'
  where composition.project_id = p_project_id
    and composition.article_id = any(p_target_article_ids);

  -- Keep the source placement snapshot stable while every target is replaced.
  perform 1
  from public.newsletter_article_composition_assets placement
  where placement.composition_id = v_source_composition_id
  order by placement.id
  for share;

  select count(*)
  into v_source_placement_count
  from public.newsletter_article_composition_assets placement
  where placement.composition_id = v_source_composition_id;

  delete from public.newsletter_article_composition_assets placement
  using public.newsletter_article_compositions composition
  where placement.composition_id = composition.id
    and composition.project_id = p_project_id
    and composition.article_id = any(p_target_article_ids);

  insert into public.newsletter_article_composition_assets (
    composition_id,
    asset_id,
    slot,
    sort_order,
    is_visible,
    settings
  )
  select
    target_composition.id,
    source_placement.asset_id,
    source_placement.slot,
    source_placement.sort_order,
    source_placement.is_visible,
    source_placement.settings
  from public.newsletter_article_compositions target_composition
  cross join public.newsletter_article_composition_assets source_placement
  where target_composition.project_id = p_project_id
    and target_composition.article_id = any(p_target_article_ids)
    and source_placement.composition_id = v_source_composition_id
  order by
    target_composition.article_id,
    source_placement.slot,
    source_placement.sort_order,
    source_placement.id;

  get diagnostics v_copied_placement_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'source_article_id', p_source_article_id,
    'target_article_count', v_requested_target_count,
    'source_placement_count', v_source_placement_count,
    'copied_placement_count', v_copied_placement_count
  );
end;
$$;

revoke execute on function public.copy_newsletter_article_compositions_batch_atomic(uuid, uuid, uuid[]) from public;
revoke execute on function public.copy_newsletter_article_compositions_batch_atomic(uuid, uuid, uuid[]) from anon;
revoke execute on function public.copy_newsletter_article_compositions_batch_atomic(uuid, uuid, uuid[]) from authenticated;
grant execute on function public.copy_newsletter_article_compositions_batch_atomic(uuid, uuid, uuid[]) to service_role;

commit;
