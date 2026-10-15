-- Admin workflow v1. Function definitions/grants only; do not apply without DB approval.
-- Existing article save contract is preserved except ordering: append new, retain existing.
begin;

create or replace function public.reorder_newsletter_articles_atomic(
  p_project_id uuid,
  p_ordered_article_ids uuid[] default null,
  p_expected_snapshot text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot text;
  v_rows jsonb;
  v_count integer;
  v_duplicate boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_ordered_article_ids is null then
    perform 1 from public.newsletter_projects where id = p_project_id;
  else
    -- Same project-first lock order as article save/delete. Blocks new FK inserts too.
    perform 1 from public.newsletter_projects where id = p_project_id for update;
  end if;
  if not found then raise exception 'project_not_found' using errcode = 'PT404'; end if;
  if p_ordered_article_ids is not null then
    perform 1 from public.newsletter_articles where project_id = p_project_id order by id for update;
  end if;
  select count(*)::integer,
    md5(coalesce(jsonb_agg(jsonb_build_array(id,sort_order,updated_at) order by id),'[]'::jsonb)::text),
    coalesce(jsonb_agg(jsonb_build_object('id',id,'sortOrder',sort_order,'updatedAt',updated_at)
      order by sort_order,updated_at desc,id),'[]'::jsonb)
  into v_count,v_snapshot,v_rows
  from public.newsletter_articles where project_id = p_project_id;
  if p_ordered_article_ids is null then
    return jsonb_build_object('ok',true,'snapshot',v_snapshot,'articles',v_rows);
  end if;
  if v_count > 5000 or cardinality(p_ordered_article_ids) > 5000 then
    raise exception 'article_order_too_large' using errcode = '22023';
  end if;
  if p_expected_snapshot is distinct from v_snapshot then
    raise exception 'article_order_stale' using errcode = 'PT409';
  end if;
  if cardinality(p_ordered_article_ids) <> v_count
    or (select count(distinct x) from unnest(p_ordered_article_ids) x) <> v_count
    or exists(select 1 from unnest(p_ordered_article_ids) x where x is null or not exists(
      select 1 from public.newsletter_articles a where a.id=x and a.project_id=p_project_id)) then
    raise exception 'article_order_ids_mismatch' using errcode = '22023';
  end if;
  select not exists(select 1 from unnest(p_ordered_article_ids) with ordinality n(id,position)
    join public.newsletter_articles a on a.id=n.id where a.sort_order <> n.position*10)
    into v_duplicate;
  update public.newsletter_articles a set sort_order=(n.position*10)::integer,updated_at=now()
    from unnest(p_ordered_article_ids) with ordinality n(id,position)
    where a.id=n.id and a.project_id=p_project_id and a.sort_order is distinct from n.position*10;
  select md5(coalesce(jsonb_agg(jsonb_build_array(id,sort_order,updated_at) order by id),'[]'::jsonb)::text),
    coalesce(jsonb_agg(jsonb_build_object('id',id,'sortOrder',sort_order,'updatedAt',updated_at)
      order by sort_order,updated_at desc,id),'[]'::jsonb)
  into v_snapshot,v_rows from public.newsletter_articles where project_id=p_project_id;
  return jsonb_build_object('ok',true,'snapshot',v_snapshot,'articles',v_rows,'duplicate',v_duplicate);
end;
$$;

create or replace function public.save_newsletter_article_atomic(
  p_project_id uuid,
  p_article_id uuid,
  p_article jsonb,
  p_blocks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_article_id uuid;
  v_next_sort_order integer;
  v_article_title text;
  v_block jsonb;
  v_action jsonb;
  v_link_action_id uuid;
  v_page_id uuid := nullif(p_article ->> 'page_id', '')::uuid;
  v_survey_id uuid := nullif(p_article ->> 'survey_id', '')::uuid;
  v_asset_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_article), 'null') <> 'object'
    or coalesce(jsonb_typeof(p_blocks), 'null') <> 'array' then
    raise exception 'invalid_article_payload' using errcode = '22023';
  end if;

  perform 1
  from public.newsletter_projects
  where id = p_project_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'status', 'not_found',
      'message', '기사 저장 대상 프로젝트를 찾지 못했습니다.'
    );
  end if;

  if v_page_id is not null and not exists (
    select 1
    from public.newsletter_pages
    where id = v_page_id
      and project_id = p_project_id
  ) then
    raise exception 'page_project_mismatch' using errcode = '23503';
  end if;

  if v_survey_id is not null and not exists (
    select 1
    from public.newsletter_surveys
    where id = v_survey_id
      and project_id = p_project_id
  ) then
    raise exception 'survey_project_mismatch' using errcode = '23503';
  end if;

  if p_article_id is null then
    select coalesce(max(sort_order), 0) + 10 into v_next_sort_order
    from public.newsletter_articles where project_id = p_project_id;
    insert into public.newsletter_articles (
      project_id,
      page_id,
      sort_order,
      title,
      display_title,
      summary,
      body,
      text_alignment,
      title_alignment,
      summary_alignment,
      body_alignment,
      interest_tags,
      article_type,
      institution_priority,
      urgency,
      publication_kind,
      valid_from,
      valid_until,
      public_info,
      survey_id,
      audio_source,
      article_tts_voice,
      contact_name,
      contact_phone,
      motion_preset,
      motion_speed,
      title_motion_effect,
      title_motion_speed,
      text_box_motion_effect,
      text_box_motion_speed,
      image_motion_effect,
      image_motion_speed,
      link_motion_effect,
      link_motion_speed,
      title_font_asset_id,
      body_font_asset_id,
      caption_font_asset_id,
      button_font_asset_id,
      status
    ) values (
      p_project_id,
      v_page_id,
      v_next_sort_order,
      p_article ->> 'title',
      nullif(p_article ->> 'display_title', ''),
      nullif(p_article ->> 'summary', ''),
      nullif(p_article ->> 'body', ''),
      p_article ->> 'text_alignment',
      p_article ->> 'title_alignment',
      p_article ->> 'summary_alignment',
      p_article ->> 'body_alignment',
      array(select jsonb_array_elements_text(p_article -> 'interest_tags')),
      p_article ->> 'article_type',
      (p_article ->> 'institution_priority')::smallint,
      p_article ->> 'urgency',
      p_article ->> 'publication_kind',
      nullif(p_article ->> 'valid_from', '')::timestamptz,
      nullif(p_article ->> 'valid_until', '')::timestamptz,
      coalesce(p_article -> 'public_info', '{}'::jsonb),
      v_survey_id,
      nullif(p_article ->> 'audio_source', ''),
      nullif(p_article ->> 'article_tts_voice', ''),
      nullif(p_article ->> 'contact_name', ''),
      nullif(p_article ->> 'contact_phone', ''),
      p_article ->> 'motion_preset',
      p_article ->> 'motion_speed',
      p_article ->> 'title_motion_effect',
      p_article ->> 'title_motion_speed',
      p_article ->> 'text_box_motion_effect',
      p_article ->> 'text_box_motion_speed',
      p_article ->> 'image_motion_effect',
      p_article ->> 'image_motion_speed',
      p_article ->> 'link_motion_effect',
      p_article ->> 'link_motion_speed',
      nullif(p_article ->> 'title_font_asset_id', '')::uuid,
      nullif(p_article ->> 'body_font_asset_id', '')::uuid,
      nullif(p_article ->> 'caption_font_asset_id', '')::uuid,
      nullif(p_article ->> 'button_font_asset_id', '')::uuid,
      p_article ->> 'status'
    )
    returning id, title into v_article_id, v_article_title;
  else
    select id
    into v_article_id
    from public.newsletter_articles
    where id = p_article_id
      and project_id = p_project_id
    for update;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'status', 'not_found',
        'message', '저장할 기사를 찾지 못했습니다.'
      );
    end if;

    update public.newsletter_articles as article
    set
      page_id = v_page_id,
      sort_order = article.sort_order, -- Order belongs to the project list, never a stale editor form.
      title = p_article ->> 'title',
      display_title = case
        when p_article ? 'display_title' then nullif(p_article ->> 'display_title', '')
        else article.display_title
      end,
      summary = nullif(p_article ->> 'summary', ''),
      body = nullif(p_article ->> 'body', ''),
      text_alignment = p_article ->> 'text_alignment',
      title_alignment = p_article ->> 'title_alignment',
      summary_alignment = p_article ->> 'summary_alignment',
      body_alignment = p_article ->> 'body_alignment',
      interest_tags = array(select jsonb_array_elements_text(p_article -> 'interest_tags')),
      article_type = p_article ->> 'article_type',
      institution_priority = (p_article ->> 'institution_priority')::smallint,
      urgency = p_article ->> 'urgency',
      publication_kind = p_article ->> 'publication_kind',
      valid_from = nullif(p_article ->> 'valid_from', '')::timestamptz,
      valid_until = nullif(p_article ->> 'valid_until', '')::timestamptz,
      public_info = coalesce(p_article -> 'public_info', '{}'::jsonb),
      survey_id = v_survey_id,
      audio_source = nullif(p_article ->> 'audio_source', ''),
      article_tts_voice = nullif(p_article ->> 'article_tts_voice', ''),
      contact_name = nullif(p_article ->> 'contact_name', ''),
      contact_phone = nullif(p_article ->> 'contact_phone', ''),
      motion_preset = p_article ->> 'motion_preset',
      motion_speed = p_article ->> 'motion_speed',
      title_motion_effect = p_article ->> 'title_motion_effect',
      title_motion_speed = p_article ->> 'title_motion_speed',
      text_box_motion_effect = p_article ->> 'text_box_motion_effect',
      text_box_motion_speed = p_article ->> 'text_box_motion_speed',
      image_motion_effect = p_article ->> 'image_motion_effect',
      image_motion_speed = p_article ->> 'image_motion_speed',
      link_motion_effect = p_article ->> 'link_motion_effect',
      link_motion_speed = p_article ->> 'link_motion_speed',
      title_font_asset_id = nullif(p_article ->> 'title_font_asset_id', '')::uuid,
      body_font_asset_id = nullif(p_article ->> 'body_font_asset_id', '')::uuid,
      caption_font_asset_id = nullif(p_article ->> 'caption_font_asset_id', '')::uuid,
      button_font_asset_id = nullif(p_article ->> 'button_font_asset_id', '')::uuid,
      status = p_article ->> 'status'
    where article.id = v_article_id
    returning article.title into v_article_title;

    delete from public.newsletter_content_blocks
    where article_id = v_article_id;

    delete from public.newsletter_link_actions
    where article_id = v_article_id;
  end if;

  for v_block in
    select value
    from jsonb_array_elements(p_blocks)
  loop
    if jsonb_typeof(v_block) <> 'object' then
      raise exception 'invalid_block_payload' using errcode = '22023';
    end if;

    v_asset_id := nullif(v_block ->> 'asset_id', '')::uuid;

    if v_asset_id is not null and not exists (
      select 1
      from public.newsletter_assets
      where id = v_asset_id
        and project_id = p_project_id
    ) then
      raise exception 'asset_project_mismatch' using errcode = '23503';
    end if;

    v_link_action_id := null;
    v_action := v_block -> 'action';

    if v_action is not null and jsonb_typeof(v_action) = 'object' then
      insert into public.newsletter_link_actions (
        project_id,
        article_id,
        label,
        action_type,
        target_value,
        display_style,
        sort_order,
        is_visible
      ) values (
        p_project_id,
        v_article_id,
        v_action ->> 'label',
        (v_action ->> 'action_type')::public.link_action_type,
        v_action ->> 'target_value',
        (v_action ->> 'display_style')::public.link_display_style,
        (v_action ->> 'sort_order')::integer,
        true
      )
      returning id into v_link_action_id;
    elsif v_action is not null and jsonb_typeof(v_action) <> 'null' then
      raise exception 'invalid_link_action_payload' using errcode = '22023';
    end if;

    insert into public.newsletter_content_blocks (
      project_id,
      article_id,
      block_type,
      title,
      body,
      text_alignment,
      asset_id,
      link_action_id,
      sort_order,
      metadata,
      is_visible
    ) values (
      p_project_id,
      v_article_id,
      (v_block ->> 'block_type')::public.content_block_type,
      nullif(v_block ->> 'title', ''),
      nullif(v_block ->> 'body', ''),
      v_block ->> 'text_alignment',
      v_asset_id,
      v_link_action_id,
      (v_block ->> 'sort_order')::integer,
      coalesce(v_block -> 'metadata', '{}'::jsonb),
      true
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'article', jsonb_build_object(
      'id', v_article_id,
      'title', v_article_title
    )
  );
end;
$$;

revoke all on function public.reorder_newsletter_articles_atomic(uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.reorder_newsletter_articles_atomic(uuid,uuid[],text) to service_role;
revoke all on function public.save_newsletter_article_atomic(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_newsletter_article_atomic(uuid,uuid,jsonb,jsonb) to service_role;
commit;
