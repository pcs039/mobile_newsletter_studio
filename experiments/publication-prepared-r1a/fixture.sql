-- ISOLATED SYNTHETIC FIXTURE ONLY. Not a public schema migration.
-- Never run on Supabase. The runner requires a dedicated socket/database.
DO $$ BEGIN
 IF current_setting('data_directory') <> '/private/tmp/prepared-r1a-pg' OR inet_server_addr() IS NOT NULL THEN
  RAISE EXCEPTION 'isolated_r1a_cluster_required';
 END IF;
END $$;
CREATE SCHEMA r1a;
CREATE FUNCTION r1a.uid(n bigint) RETURNS uuid LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT md5('r1a-synthetic:' || n)::uuid $$;
CREATE FUNCTION r1a.pick(j jsonb, keys text[]) RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT coalesce(jsonb_object_agg(k,j->k ORDER BY k),'{}') FROM unnest(keys) k $$;
CREATE FUNCTION r1a.strings(j jsonb) RETURNS SETOF text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT DISTINCT v#>>'{}' FROM jsonb_path_query(j,'strict $.** ? (@.type() == "string")') v $$;
CREATE FUNCTION r1a.decode_path(s text) RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE result bytea=''; i integer=1; c text;
BEGIN
 IF s IS NULL THEN RETURN NULL; END IF;
 WHILE i<=length(s) LOOP
  c=substr(s,i,1);
  IF c='%' THEN
   IF substr(s,i+1,2) !~ '^[0-9A-Fa-f]{2}$' THEN RETURN NULL; END IF;
   result=result||decode(substr(s,i+1,2),'hex'); i=i+3;
  ELSE result=result||convert_to(CASE WHEN c='+' THEN ' ' ELSE c END,'UTF8'); i=i+1;
  END IF;
 END LOOP;
 RETURN convert_from(result,'UTF8');
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE TABLE r1a.newsletter_projects (
 id uuid PRIMARY KEY, slug text, title text, status text, deleted_at timestamptz,
 published_at timestamptz, updated_at timestamptz, title_font_asset_id uuid,
 body_font_asset_id uuid, cover_image_path text, cover_image_url text,
 cover_enabled boolean, cover_title text, cover_subtitle text, cover_layout text,
 cover_fit text, cover_issue_text text, primary_color text, article_tts_voice text,
 organization_name text, issue_label text, project_type text, ebook_source text,
 external_ebook_url text, description text, production_mode text
);
CREATE TABLE r1a.newsletter_articles (
 id uuid PRIMARY KEY, project_id uuid NOT NULL, page_id uuid, sort_order integer,
 title text, display_title text, summary text, body text, status text,
 publication_kind text, urgency text, institution_priority integer, interest_tags text[],
 valid_from timestamptz, valid_until timestamptz, created_at timestamptz, updated_at timestamptz,
 representative_asset_id uuid, audio_id uuid, ai_audio_id uuid, audio_source text,
 article_tts_voice text, title_font_asset_id uuid, body_font_asset_id uuid,
 caption_font_asset_id uuid, button_font_asset_id uuid, survey_id uuid,
 public_info jsonb, contact_name text, contact_phone text, body_alignment text,
 title_alignment text, summary_alignment text, motion_preset text
);
CREATE TABLE r1a.newsletter_content_blocks (
 id uuid PRIMARY KEY, project_id uuid, article_id uuid, block_type text, title text,
 body text, text_alignment text, asset_id uuid, link_action_id uuid, sort_order integer,
 metadata jsonb, is_visible boolean, updated_at timestamptz
);
CREATE TABLE r1a.newsletter_link_actions (
 id uuid PRIMARY KEY, project_id uuid, article_id uuid, label text, action_type text,
 target_value text, display_style text, sort_order integer, is_visible boolean
);
CREATE TABLE r1a.newsletter_article_compositions (
 id uuid PRIMARY KEY, project_id uuid, article_id uuid UNIQUE, layout_key text,
 status text, settings jsonb, updated_at timestamptz
);
CREATE TABLE r1a.newsletter_article_composition_assets (
 id uuid PRIMARY KEY, composition_id uuid, asset_id uuid, slot text, sort_order integer,
 settings jsonb, is_visible boolean, created_at timestamptz
);
CREATE TABLE r1a.newsletter_project_design_assets (
 id uuid PRIMARY KEY, project_id uuid, storage_bucket text, storage_path text,
 asset_type text, name text, is_active boolean, is_primary boolean, approval_status text,
 mime_type text, file_size_bytes integer, metadata jsonb, sort_order integer, updated_at timestamptz
);
CREATE TABLE r1a.font_families (
 id uuid PRIMARY KEY, css_family_name text UNIQUE, family_name text, display_name text,
 is_active boolean, webfont_allowed boolean
);
CREATE TABLE r1a.font_assets (
 id uuid PRIMARY KEY, family_id uuid, font_name text, font_family text, font_file_path text,
 font_file_format text, font_weight text, font_style text, detected_weight text,
 detected_style text, is_active boolean, webfont_allowed boolean, attribution_text text
);
CREATE TABLE r1a.newsletter_audio_files (
 id uuid PRIMARY KEY, project_id uuid, article_id uuid, title text, file_path text,
 duration_seconds integer, script_text text, script_status text, transcript_type text,
 pronunciation_note text, source_type text, ai_tts_audio_paths jsonb, ai_tts_text_hash text,
 ai_tts_voice text, ai_tts_model text, ai_tts_generated_at timestamptz, updated_at timestamptz
);
CREATE TABLE r1a.newsletter_project_design_kits (id uuid PRIMARY KEY,project_id uuid,heading_font_family text,body_font_family text,primary_color text);
CREATE TABLE r1a.newsletter_assets (id uuid PRIMARY KEY,project_id uuid,file_path text,is_approved boolean,mime_type text);
CREATE TABLE r1a.newsletter_pages (id uuid PRIMARY KEY,project_id uuid,page_number integer,title text,image_path text,image_status text);
CREATE TABLE r1a.newsletter_article_home_metadata (article_id uuid PRIMARY KEY,project_id uuid,target_regions text[],section_override text);
CREATE TABLE r1a.newsletter_project_home_settings (project_id uuid PRIMARY KEY,is_enabled boolean,regions text[],section_settings jsonb);
CREATE TABLE r1a.newsletter_page_hotspot_links (id uuid PRIMARY KEY,project_id uuid,page_id uuid,sort_order integer,is_visible boolean,target_value text);
CREATE TABLE r1a.newsletter_image_overlays (id uuid PRIMARY KEY,project_id uuid,article_id uuid,page_id uuid,image_asset_id uuid,link_action_id uuid,settings jsonb);
CREATE TABLE r1a.newsletter_link_areas (id uuid PRIMARY KEY,project_id uuid,page_id uuid,settings jsonb);
CREATE TABLE r1a.newsletter_project_demo_shares (id uuid PRIMARY KEY,project_id uuid,article_ids uuid[],source_snapshot text,expires_at timestamptz,revoked_at timestamptz);

-- Representative source indexes only. These are fixture indexes, not proposed DDL.
CREATE INDEX ON r1a.newsletter_articles(project_id,sort_order,id);
CREATE INDEX ON r1a.newsletter_content_blocks(article_id,sort_order);
CREATE INDEX ON r1a.newsletter_link_actions(article_id,sort_order);
CREATE INDEX ON r1a.newsletter_article_compositions(project_id,updated_at);
CREATE INDEX ON r1a.newsletter_article_composition_assets(composition_id,slot,sort_order);
CREATE INDEX ON r1a.newsletter_project_design_assets(project_id,asset_type,is_active,sort_order);
CREATE INDEX ON r1a.font_assets(family_id);
CREATE INDEX ON r1a.newsletter_audio_files(project_id,updated_at);

INSERT INTO r1a.font_families SELECT r1a.uid(10000+i),'Family'||i,'Family'||i,'Font family '||i,true,true FROM generate_series(1,243) i;
INSERT INTO r1a.font_assets SELECT r1a.uid(20000+i),r1a.uid(10000+1+(i-1)%243),'Font '||i,'Family'||(1+(i-1)%243),'fixture/font-'||i||'.woff2','woff2','400','normal',NULL,NULL,true,true,'Synthetic fixture' FROM generate_series(1,289)i;
INSERT INTO r1a.newsletter_projects(id,slug,title,status,updated_at,title_font_asset_id,body_font_asset_id,cover_image_path,cover_enabled,primary_color,article_tts_voice)
 SELECT r1a.uid(i),'synthetic-'||i,'Synthetic issue '||i,'published','2026-10-30T00:00Z',r1a.uid(20001),r1a.uid(20002),'projects/'||r1a.uid(i)||'/cover.webp',true,'#224c43','marin' FROM generate_series(1,3)i;

INSERT INTO r1a.newsletter_articles(id,project_id,sort_order,title,summary,body,status,publication_kind,urgency,institution_priority,interest_tags,created_at,updated_at,title_font_asset_id,body_font_asset_id,audio_source,article_tts_voice)
 SELECT r1a.uid(p*100000+i),r1a.uid(p),i*10,'Synthetic article '||i,repeat('요약 문장. ',8),repeat('자원순환과 시민 생활을 위한 공개 본문입니다. ',40),'draft','regular','normal',3,ARRAY['생활'], '2026-10-01Z','2026-10-01Z',r1a.uid(20001),r1a.uid(20002),'ai_tts','marin'
 FROM (VALUES(1,7),(2,700),(3,1500))v(p,n) CROSS JOIN LATERAL generate_series(1,n)i;
INSERT INTO r1a.newsletter_content_blocks SELECT r1a.uid(1000000+n),project_id,id,'paragraph','소제목',repeat('본문 문단입니다. ',30),'left',NULL,NULL,10,jsonb_build_object('proposal_sample',jsonb_build_object('font',r1a.uid(20003))),true,updated_at FROM (SELECT *,row_number()OVER(ORDER BY id)n FROM r1a.newsletter_articles)a;
INSERT INTO r1a.newsletter_content_blocks SELECT r1a.uid(10000000+n*10+part),project_id,id,'paragraph','소제목 '||part,repeat('본문 문단입니다. ',30),'left',NULL,NULL,part*10,'{}',true,updated_at FROM (SELECT *,row_number()OVER(ORDER BY id)n FROM r1a.newsletter_articles)a CROSS JOIN generate_series(2,5)part;
INSERT INTO r1a.newsletter_link_actions SELECT r1a.uid(2000000+n),project_id,id,'공식 안내','external_url','https://example.invalid/fixture','button',10,true FROM (SELECT *,row_number()OVER(ORDER BY id)n FROM r1a.newsletter_articles)a;
INSERT INTO r1a.newsletter_article_compositions SELECT r1a.uid(3000000+n),project_id,id,'standard','ready',jsonb_build_object('fontDesign',jsonb_build_object('subheading',r1a.uid(20004))),'2026-10-01Z' FROM (SELECT *,row_number()OVER(ORDER BY id)n FROM r1a.newsletter_articles)a;
INSERT INTO r1a.newsletter_project_design_assets SELECT r1a.uid(4000000+n),project_id,'design-production-assets','projects/'||project_id||'/asset-'||n||'.webp','illustration','Fixture',true,false,'approved','image/webp',100000,'{}',10,'2026-10-01Z' FROM (SELECT *,row_number()OVER(ORDER BY id)n FROM r1a.newsletter_articles)a;
INSERT INTO r1a.newsletter_article_composition_assets SELECT r1a.uid(5000000+n),r1a.uid(3000000+n),r1a.uid(4000000+n),'hero_illustration',10,'{}',true,'2026-10-01Z' FROM generate_series(1,2207)n;
INSERT INTO r1a.newsletter_audio_files SELECT r1a.uid(6000000+n),project_id,id,title,'projects/'||project_id||'/tts/'||id||'.mp3',30,body,'approved','custom_script',NULL,'ai_tts',jsonb_build_array('projects/'||project_id||'/tts/'||id||'.mp3'),repeat('a',64),'marin','gpt-4o-mini-tts','2026-10-01Z','2026-10-01Z' FROM (SELECT *,row_number()OVER(ORDER BY id)n FROM r1a.newsletter_articles)a;
INSERT INTO r1a.newsletter_audio_files(id,project_id,title,file_path,script_status,script_text,pronunciation_note,ai_tts_generated_at,updated_at)
 SELECT r1a.uid(7000000+i),r1a.uid(1),'[시연 TTS v3] candidate '||i,'projects/'||r1a.uid(1)||'/quality/'||i||'.mp3','pending','fixture','{}',NULL,'2026-10-01Z' FROM generate_series(1,40)i;
INSERT INTO r1a.newsletter_project_demo_shares VALUES(r1a.uid(9000001),r1a.uid(1),ARRAY(SELECT id FROM r1a.newsletter_articles WHERE project_id=r1a.uid(1) ORDER BY sort_order,id),'LEGACY_JS_SNAPSHOT_FIXTURE',NULL,NULL);
ANALYZE;
