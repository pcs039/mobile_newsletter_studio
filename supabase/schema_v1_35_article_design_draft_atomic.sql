-- v1.35: one atomic presentation-only draft operation; no table/column/policy changes.
begin;

create or replace function public.apply_newsletter_article_design_draft_atomic(
  p_project_id uuid,
  p_article_id uuid,
  p_action text,
  p_expected jsonb default null,
  p_pattern text default null,
  p_text_design jsonb default '{}'::jsonb,
  p_placements jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_composition public.newsletter_article_compositions%rowtype;
  v_article public.newsletter_articles%rowtype;
  v_snapshot jsonb;
  v_asset public.newsletter_project_design_assets%rowtype;
  v_item jsonb;
  v_slot text;
  v_seen text[] := '{}';
  v_settings jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('snapshot', 'apply') or p_project_id is null or p_article_id is null then
    raise exception 'invalid_draft_input' using errcode = '22023';
  end if;
  -- Lock order matches existing article/composition operations. FK key-share locks
  -- prevent new target placements/blocks while this snapshot is being applied.
  select * into v_article from public.newsletter_articles where id = p_article_id for update;
  if not found or v_article.project_id is distinct from p_project_id then
    raise exception 'draft_article_not_found' using errcode = 'P0002';
  end if;
  select * into v_composition from public.newsletter_article_compositions
    where article_id = p_article_id and project_id = p_project_id for update;
  if not found then
    raise exception 'draft_composition_not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.newsletter_article_composition_assets
    where composition_id = v_composition.id order by id for update;
  perform 1 from public.newsletter_content_blocks where article_id = p_article_id order by id for share;
  perform 1 from public.newsletter_link_actions where article_id = p_article_id order by id for share;
  v_snapshot := jsonb_build_object(
    'id', v_composition.id, 'settings', v_composition.settings,
    'status', v_composition.status, 'updated_at', v_composition.updated_at,
    'placements', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'asset_id', asset_id, 'slot', slot, 'sort_order', sort_order,
      'is_visible', is_visible, 'settings', settings, 'updated_at', updated_at) order by id)
      from public.newsletter_article_composition_assets where composition_id = v_composition.id), '[]'::jsonb),
    'content_version', md5(jsonb_build_object(
      'article', to_jsonb(v_article),
      'blocks', (select coalesce(jsonb_agg(to_jsonb(b) order by b.id), '[]'::jsonb)
        from public.newsletter_content_blocks b where b.article_id = p_article_id),
      'links', (select coalesce(jsonb_agg(to_jsonb(l) order by l.id), '[]'::jsonb)
        from public.newsletter_link_actions l where l.article_id = p_article_id)
    )::text)
  );
  if p_action = 'snapshot' then return v_snapshot; end if;
  if p_expected is distinct from v_snapshot then
    raise exception 'stale_design_draft' using errcode = 'PT409';
  end if;
  if p_pattern is null or p_pattern not in ('manual', 'event', 'policy', 'interview')
    or jsonb_typeof(p_text_design) is distinct from 'object'
    or jsonb_typeof(p_placements) is distinct from 'array'
    or jsonb_array_length(p_placements) > 2 then
    raise exception 'invalid_draft_input' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_text_design) k where k not in ('labelEnabled','label','captionStyled','bodyEmphasis'))
    or (p_text_design ? 'labelEnabled' and jsonb_typeof(p_text_design->'labelEnabled') <> 'boolean')
    or (p_text_design ? 'captionStyled' and jsonb_typeof(p_text_design->'captionStyled') <> 'boolean')
    or (p_text_design ? 'label' and (jsonb_typeof(p_text_design->'label') <> 'string' or length(p_text_design->>'label') > 80))
    or (p_text_design ? 'bodyEmphasis' and (jsonb_typeof(p_text_design->'bodyEmphasis') <> 'string' or p_text_design->>'bodyEmphasis' not in ('none','info','quote'))) then
    raise exception 'invalid_draft_text_design' using errcode = '22023';
  end if;
  if p_pattern = 'manual' then
    if p_text_design <> '{}'::jsonb or p_placements <> '[]'::jsonb then
      raise exception 'manual_draft_must_preserve_design' using errcode = '22023';
    end if;
    return jsonb_build_object('ok', true, 'changed', false, 'composition_id', v_composition.id);
  end if;
  -- Lock all selected assets in deterministic order, including approval changes.
  perform 1 from public.newsletter_project_design_assets a
    where a.id in (select (item->>'assetId')::uuid from jsonb_array_elements(p_placements) item)
    order by a.id for share;
  v_settings := v_composition.settings || jsonb_build_object(
    'productionPattern', p_pattern,
    'textDesign', (case when jsonb_typeof(v_composition.settings->'textDesign') = 'object'
      then v_composition.settings->'textDesign' else '{}'::jsonb end) || p_text_design);
  update public.newsletter_article_compositions set settings = v_settings where id = v_composition.id;
  -- All statements below are part of the same transaction. A failure after the
  -- settings update or first placement rolls back every earlier statement.
  for v_item in select value from jsonb_array_elements(p_placements) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(v_item) k where k not in ('assetId','slot'))
      or jsonb_typeof(v_item->'assetId') is distinct from 'string'
      or jsonb_typeof(v_item->'slot') is distinct from 'string' then
      raise exception 'invalid_draft_placement' using errcode = '22023';
    end if;
    v_slot := v_item->>'slot';
    if v_slot not in ('hero_background','hero_illustration') or v_slot = any(v_seen) then
      raise exception 'invalid_draft_slot' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_slot);
    if exists (select 1 from public.newsletter_article_composition_assets
      where composition_id = v_composition.id and slot = v_slot) then
      raise exception 'draft_preserves_existing_placement' using errcode = 'PT409';
    end if;
    select * into v_asset from public.newsletter_project_design_assets where id = (v_item->>'assetId')::uuid;
    if not found or v_asset.project_id is distinct from p_project_id
      or v_asset.approval_status <> 'approved' or not v_asset.is_active
      or coalesce(v_asset.storage_bucket, '') <> 'design-production-assets'
      or coalesce(v_asset.storage_path, '') = '' or v_asset.storage_path like '%..%'
      or v_asset.storage_path like '/%' or v_asset.storage_path like '%/'
      or coalesce(v_asset.mime_type, '') not in ('image/png','image/jpeg','image/webp','image/svg+xml')
      or not public.is_newsletter_composition_slot_asset_type_compatible(v_slot, v_asset.asset_type)
      or not exists (select 1 from public.newsletter_article_composition_assets placement
        join public.newsletter_article_compositions composition on composition.id = placement.composition_id
        where placement.asset_id = v_asset.id and placement.slot = v_slot and placement.is_visible
          and composition.project_id = p_project_id and composition.status = 'ready') then
      raise exception 'draft_asset_not_eligible' using errcode = '23514';
    end if;
    insert into public.newsletter_article_composition_assets (composition_id, asset_id, slot, sort_order, is_visible, settings)
    values (v_composition.id, v_asset.id, v_slot, 0, true, jsonb_build_object(
      'anchor','center','fit',case when v_slot = 'hero_background' then 'cover' else 'contain' end,
      'offsetX',0,'offsetY',0,'rotation',0,'scale',1,
      'opacity',case when v_slot = 'hero_background' then 0.12 else 1 end,
      'zIndex',case when v_slot = 'hero_background' then 0 else 10 end));
  end loop;
  return jsonb_build_object('ok',true,'changed',true,'composition_id',v_composition.id);
end;
$$;

revoke execute on function public.apply_newsletter_article_design_draft_atomic(uuid,uuid,text,jsonb,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.apply_newsletter_article_design_draft_atomic(uuid,uuid,text,jsonb,text,jsonb,jsonb) to service_role;
commit;
