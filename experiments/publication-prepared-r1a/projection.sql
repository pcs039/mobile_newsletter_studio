-- R1-A DRAFT, isolated r1a schema only. Not a migration / authorization RPC.
-- $1 project UUID; $2 regular|demo; $3 Demo article IDs (trusted selection,
-- NOT a credential); $4 explicit evaluation time; $5 sample-v289|regular-v289.
-- One SQL statement. No volatile reads, Storage, writes or cached permissions.
-- Execution contract: TimeZone=UTC (the isolated STABLE wrapper enforces it).
-- JSONB representation is tied to PostgreSQL 17 / projection version r1a-v1.
WITH
p AS MATERIALIZED (SELECT $1::uuid pid,$2::text scope,$3::uuid[] ids,$4::timestamptz at_time,$5::text renderer),
project AS MATERIALIZED (
 SELECT n.id,r1a.pick(to_jsonb(n),ARRAY['id','slug','title','organization_name','issue_label','description','primary_color','production_mode','project_type','ebook_source','external_ebook_url','title_font_asset_id','body_font_asset_id','article_tts_voice','cover_enabled','cover_layout','cover_image_path','cover_image_url','cover_fit','cover_title','cover_subtitle','cover_issue_text']) doc
 FROM r1a.newsletter_projects n,p WHERE n.id=$1::uuid
),
a AS MATERIALIZED (
 SELECT n.*,r1a.pick(to_jsonb(n),ARRAY['id','page_id','sort_order','title','display_title','summary','body','text_alignment','title_alignment','summary_alignment','body_alignment','interest_tags','article_type','institution_priority','urgency','publication_kind','public_info','survey_id','contact_name','contact_phone','motion_preset','motion_speed','title_motion_effect','title_motion_speed','text_box_motion_effect','text_box_motion_speed','image_motion_effect','image_motion_speed','link_motion_effect','link_motion_speed','title_font_asset_id','body_font_asset_id','caption_font_asset_id','button_font_asset_id','status','representative_asset_id','audio_id','audio_source','article_tts_voice','ai_audio_id'])
 || jsonb_build_object('created_epoch',extract(epoch FROM n.created_at),'valid_from_epoch',extract(epoch FROM n.valid_from),'valid_until_epoch',extract(epoch FROM n.valid_until),
 'eligible',coalesce(n.publication_kind,'regular')<>'rolling' OR (n.status='published' AND (n.valid_from IS NULL OR n.valid_from<=p.at_time) AND (n.valid_until IS NULL OR n.valid_until>=p.at_time))) doc
 FROM r1a.newsletter_articles n,p WHERE n.project_id=$1::uuid AND (p.scope='regular' OR n.id=ANY(p.ids))
),
b AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] doc FROM r1a.newsletter_content_blocks n,p
 WHERE n.project_id=p.pid AND n.article_id IN(SELECT id FROM a)
),
c AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] doc FROM r1a.newsletter_article_compositions n,p
 WHERE n.project_id=p.pid AND n.article_id IN(SELECT id FROM a)
),
placements AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['created_at','updated_at']||jsonb_build_object('created_epoch',extract(epoch FROM n.created_at)) doc
 FROM r1a.newsletter_article_composition_assets n WHERE n.composition_id IN(SELECT id FROM c)
),
pages AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] doc FROM r1a.newsletter_pages n,p
 WHERE n.project_id=p.pid AND (p.scope='regular' OR n.id IN(SELECT page_id FROM a))
),
aux AS MATERIALIZED (
 SELECT 'kit' kind,to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] doc FROM r1a.newsletter_project_design_kits n,p WHERE n.project_id=p.pid
 UNION ALL SELECT 'home',to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] FROM r1a.newsletter_project_home_settings n,p WHERE n.project_id=p.pid
 UNION ALL SELECT 'article_home',to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] FROM r1a.newsletter_article_home_metadata n,p WHERE n.project_id=p.pid AND n.article_id IN(SELECT id FROM a)
 UNION ALL SELECT 'hotspot',to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] FROM r1a.newsletter_page_hotspot_links n,p WHERE n.project_id=p.pid AND n.page_id IN(SELECT id FROM pages)
 UNION ALL SELECT 'overlay',to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] FROM r1a.newsletter_image_overlays n,p WHERE n.project_id=p.pid AND (n.article_id IN(SELECT id FROM a) OR n.page_id IN(SELECT id FROM pages))
 UNION ALL SELECT 'link_area',to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] FROM r1a.newsletter_link_areas n,p WHERE n.project_id=p.pid AND n.page_id IN(SELECT id FROM pages)
),
texts AS MATERIALIZED (
 SELECT DISTINCT value FROM (
 SELECT v value FROM project CROSS JOIN LATERAL r1a.strings(doc)v
 UNION ALL SELECT v::text FROM a CROSS JOIN LATERAL unnest(ARRAY[title_font_asset_id,body_font_asset_id,caption_font_asset_id,button_font_asset_id])v WHERE v IS NOT NULL
 UNION ALL SELECT v FROM b CROSS JOIN LATERAL r1a.strings(metadata)v
 UNION ALL SELECT body FROM b WHERE body LIKE '/api/%'
 UNION ALL SELECT v FROM c CROSS JOIN LATERAL r1a.strings(settings)v
 UNION ALL SELECT v FROM placements CROSS JOIN LATERAL r1a.strings(settings)v
 UNION ALL SELECT v FROM pages CROSS JOIN LATERAL r1a.strings(doc)v
 UNION ALL SELECT v FROM aux CROSS JOIN LATERAL r1a.strings(doc)v
 )s
),
l AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] doc FROM r1a.newsletter_link_actions n,p
 WHERE n.project_id=p.pid AND (n.article_id IN(SELECT id FROM a) OR n.id IN(SELECT link_action_id FROM b)
 OR n.id IN(SELECT (doc->>'link_action_id')::uuid FROM aux WHERE doc->>'link_action_id' IS NOT NULL))
),
uuid_refs AS MATERIALIZED (SELECT value::uuid id FROM texts WHERE value ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'),
path_refs AS MATERIALIZED (
 SELECT DISTINCT path FROM (
 SELECT value path FROM texts WHERE value LIKE 'projects/%'
 UNION ALL SELECT r1a.decode_path(substring(value FROM '[?&]path=([^&#]+)')) FROM texts WHERE value ~ '^/api/(project-files|public-files|demo-share/sample-files)'
 )s WHERE path IS NOT NULL AND path !~ '(^/|\.\.|[\\[:cntrl:]])'
),
assets AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] doc FROM r1a.newsletter_assets n,p
 WHERE n.project_id=p.pid AND (n.id IN(SELECT asset_id FROM b) OR n.id IN(SELECT representative_asset_id FROM a)
 OR n.id IN(SELECT (doc->>'image_asset_id')::uuid FROM aux WHERE kind='overlay' AND doc->>'image_asset_id' IS NOT NULL) OR n.file_path IN(SELECT path FROM path_refs))
),
design AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['project_id','created_at','updated_at'] doc FROM r1a.newsletter_project_design_assets n,p
 WHERE n.project_id=p.pid AND (n.id IN(SELECT asset_id FROM placements) OR n.id IN(SELECT id FROM uuid_refs)
 OR n.storage_path IN(SELECT path FROM path_refs) OR n.asset_type='logo')
),
-- Family closure preserves family-based CSS candidates, including disabled faces
-- that could become eligible. Referenced-face aliases alone need fewer faces.
family_refs AS MATERIALIZED (
 SELECT DISTINCT family_id id FROM r1a.font_assets WHERE id IN(SELECT id FROM uuid_refs) AND family_id IS NOT NULL
 UNION SELECT id FROM r1a.font_families WHERE css_family_name IN(SELECT value FROM texts) OR family_name IN(SELECT value FROM texts)
),
fonts AS MATERIALIZED (
 SELECT n.id,n.family_id,to_jsonb(n)-ARRAY['uploaded_by','license_note','source_file_name','created_at','updated_at'] doc
 FROM r1a.font_assets n WHERE n.id IN(SELECT id FROM uuid_refs) OR n.family_id IN(SELECT id FROM family_refs)
),
families AS MATERIALIZED (
 SELECT n.id,r1a.pick(to_jsonb(n),ARRAY['id','css_family_name','display_name','family_name','is_active','webfont_allowed','attribution_required','attribution_text']) doc
 FROM r1a.font_families n WHERE n.id IN(SELECT family_id FROM fonts)
),
audio AS MATERIALIZED (
 SELECT n.*,to_jsonb(n)-ARRAY['project_id','created_at','updated_at','ai_tts_generated_at']
 ||jsonb_build_object('updated_epoch',extract(epoch FROM n.updated_at),'generated_epoch',extract(epoch FROM n.ai_tts_generated_at)) doc
 FROM r1a.newsletter_audio_files n,p WHERE n.project_id=p.pid AND (n.article_id IN(SELECT id FROM a) OR n.id IN(SELECT audio_id FROM a UNION SELECT ai_audio_id FROM a) OR n.id IN(SELECT id FROM uuid_refs)
 OR(p.renderer='sample-v289' AND (n.title LIKE '[시연 TTS v3] %' OR n.title LIKE '[시연 TTS v2] %' OR n.title LIKE '[만평 성우 시험 v1] %' OR n.title LIKE '[만평 성우 시험 v2] %')))
),
source AS MATERIALIZED (
 SELECT jsonb_build_object('projection','r1a-v1','renderer',p.renderer,'scope',p.scope,
 'project',(SELECT doc FROM project),
 'articles',(SELECT coalesce(jsonb_agg(doc ORDER BY sort_order,id),'[]')FROM a),
 'blocks',(SELECT coalesce(jsonb_agg(doc ORDER BY article_id,sort_order,id),'[]')FROM b),
 'links',(SELECT coalesce(jsonb_agg(doc ORDER BY article_id,sort_order,id),'[]')FROM l),
 'composition',(SELECT coalesce(jsonb_agg(doc ORDER BY id),'[]')FROM c),
 'placements',(SELECT coalesce(jsonb_agg(doc ORDER BY id),'[]')FROM placements),
 'pages',(SELECT coalesce(jsonb_agg(doc ORDER BY page_number,id),'[]')FROM pages),
 'aux',(SELECT coalesce(jsonb_agg(jsonb_build_array(kind,doc) ORDER BY kind,doc::text COLLATE "C"),'[]')FROM aux),
 'assets',(SELECT coalesce(jsonb_agg(doc ORDER BY id),'[]')FROM assets),
 'design',(SELECT coalesce(jsonb_agg(doc ORDER BY id),'[]')FROM design),
 'fonts',(SELECT coalesce(jsonb_agg(doc ORDER BY id),'[]')FROM fonts),
 'families',(SELECT coalesce(jsonb_agg(doc ORDER BY id),'[]')FROM families),
 'audio_candidates',(SELECT coalesce(jsonb_agg(doc ORDER BY id),'[]')FROM audio)) doc FROM p
),
checks AS (
 SELECT p.scope IN('regular','demo') AND p.renderer IN('sample-v289','regular-v289') AND EXISTS(SELECT 1 FROM project)
 AND(p.scope='regular' OR(coalesce(cardinality(p.ids),0)>0 AND cardinality(p.ids)=(SELECT count(*)FROM a) AND cardinality(p.ids)=(SELECT count(DISTINCT x)FROM unnest(p.ids)x))) scope_ok,
 NOT EXISTS(SELECT 1 FROM b GROUP BY article_id,sort_order HAVING count(*)>1)
 AND NOT EXISTS(SELECT 1 FROM l GROUP BY article_id,sort_order HAVING count(*)>1)
 AND NOT EXISTS(SELECT 1 FROM audio WHERE article_id IS NOT NULL GROUP BY article_id,updated_at HAVING count(*)>1) order_ok FROM p
),
-- Serialize exactly once; do not pay another JSON pass for source_bytes.
serialized AS MATERIALIZED(SELECT convert_to(doc::text,'UTF8') bytes FROM source)
SELECT encode(sha256(serialized.bytes),'hex') source_digest,
 octet_length(serialized.bytes) source_bytes,
 jsonb_build_object('articles',(SELECT count(*)FROM a),'blocks',(SELECT count(*)FROM b),'design',(SELECT count(*)FROM design),'fonts',(SELECT count(*)FROM fonts),'audio',(SELECT count(*)FROM audio)) dependencies,
 checks.scope_ok AND checks.order_ok cacheable,
 'NOT_AUTHORIZATION'::text access_contract,'dynamic_only'::text media_reuse
FROM serialized,checks;
