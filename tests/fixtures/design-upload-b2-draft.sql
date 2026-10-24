-- Operating contract DRAFT. Not a Supabase migration or an exposed RPC.
-- The harness loads this only into a disposable, socket-only PostgreSQL database.
DO $$ BEGIN
  IF current_database() NOT LIKE 'mns_upload_b2_%'
     OR current_setting('upload_b2.isolated',true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'local B2 database required';
  END IF;
END $$;
CREATE SCHEMA upload_b2_draft;
REVOKE ALL ON SCHEMA upload_b2_draft FROM PUBLIC;
GRANT USAGE ON SCHEMA upload_b2_draft TO service_role;

-- Deliberately no cascading project/asset FK: cleanup paths and historical receipts
-- survive existing hard deletes. Existence/ownership is checked under project locks.
CREATE TABLE upload_b2_draft.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL,
  actor_id text NOT NULL, request_key uuid NOT NULL, intent_hash text NOT NULL,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 180),
  asset_type text NOT NULL CHECK (asset_type IN ('background','illustration','icon','card_frame','banner','pattern','decoration')),
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  byte_hash text NOT NULL CHECK (byte_hash ~ '^[a-f0-9]{64}$'),
  policy_version text NOT NULL DEFAULT 'b2-raster-v1' CHECK (policy_version='b2-raster-v1'),
  temp_bucket text NOT NULL DEFAULT 'design-upload-quarantine' CHECK (temp_bucket='design-upload-quarantine'),
  temp_path text NOT NULL UNIQUE, final_path text UNIQUE,
  phase text NOT NULL DEFAULT 'prepared' CHECK (phase IN ('prepared','verifying','stored','registered','cancelled','expired','rejected')),
  generation bigint NOT NULL DEFAULT 0 CHECK (generation>=0), lease_until timestamptz,
  intent_expires timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '30 minutes'),
  capability_deadline timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '2 hours'),
  capability_issue_count integer NOT NULL DEFAULT 0 CHECK (capability_issue_count BETWEEN 0 AND 3),
  transport_closed_at timestamptz, verified jsonb, receipt jsonb,
  asset_gone_at timestamptz, project_gone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(project_id,actor_id,request_key),
  CHECK (intent_hash ~ '^[a-f0-9]{64}$'),
  CHECK ((phase='registered')=(receipt IS NOT NULL)),
  CHECK ((phase IN ('verifying','stored'))=(lease_until IS NOT NULL)),
  CHECK (phase NOT IN ('stored','registered') OR (verified IS NOT NULL AND final_path IS NOT NULL))
);
CREATE INDEX sessions_by_project ON upload_b2_draft.sessions(project_id,created_at DESC);
CREATE INDEX sessions_expiring ON upload_b2_draft.sessions(intent_expires) WHERE receipt IS NULL;
CREATE TABLE upload_b2_draft.cleanup_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL, generation bigint NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('design-upload-quarantine','design-production-assets')),
  path text NOT NULL, reason text NOT NULL,
  not_before timestamptz NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','claimed','done')),
  UNIQUE(bucket,path)
);
CREATE INDEX cleanup_pending ON upload_b2_draft.cleanup_jobs(not_before) WHERE state='pending';
ALTER TABLE upload_b2_draft.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_b2_draft.cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA upload_b2_draft FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA upload_b2_draft TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA upload_b2_draft TO service_role;

CREATE FUNCTION upload_b2_draft.project_guard(p_project uuid,p_actor jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE a text; deleted timestamptz; project_status text;
BEGIN
  IF current_user<>'service_role' OR nullif(p_actor->>'id','') IS NULL
     OR coalesce(p_actor->>'role','') NOT IN ('admin','user') THEN
    RAISE SQLSTATE '42501' USING MESSAGE='server_actor_required';
  END IF;
  SELECT assignee_name,deleted_at,status::text INTO a,deleted,project_status FROM public.newsletter_projects WHERE id=p_project FOR SHARE;
  IF NOT FOUND OR deleted IS NOT NULL OR project_status='archived' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='project_unavailable'; END IF;
  IF p_actor->>'role'<>'admin' AND (a IS NULL OR
    regexp_replace(lower(a),'[[:space:]]','','g') NOT IN
      (regexp_replace(lower(p_actor->>'id'),'[[:space:]]','','g'),regexp_replace(lower(coalesce(p_actor->>'name','')),'[[:space:]]','','g'))) THEN
    RAISE SQLSTATE '42501' USING MESSAGE='project_forbidden';
  END IF;
END $$;

CREATE FUNCTION upload_b2_draft.prepare(p_project uuid,p_actor jsonb,p_key uuid,p_name text,p_type text,p_mime text,p_size bigint,p_hash text)
RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions; n uuid=gen_random_uuid(); d text; ext text;
BEGIN
  PERFORM upload_b2_draft.project_guard(p_project,p_actor);
  IF p_key IS NULL THEN RAISE SQLSTATE '22023' USING MESSAGE='request_key_required'; END IF;
  p_name=normalize(p_name,NFC);
  ext=CASE p_mime WHEN 'image/png' THEN 'png' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/webp' THEN 'webp' END;
  IF p_name ~ '[[:cntrl:]]' OR position('/' IN p_name)>0 OR position(chr(92) IN p_name)>0 OR NOT
    (CASE p_mime WHEN 'image/png' THEN lower(p_name) ~ '\.png$'
     WHEN 'image/jpeg' THEN lower(p_name) ~ '\.jpe?g$'
     WHEN 'image/webp' THEN lower(p_name) ~ '\.webp$' ELSE false END) THEN
    RAISE SQLSTATE '22023' USING MESSAGE='file_name_or_format'; END IF;
  d=encode(sha256(convert_to(jsonb_build_array('b2-raster-v1',p_name,p_type,p_mime,p_size,p_hash)::text,'UTF8')),'hex');
  INSERT INTO upload_b2_draft.sessions(id,project_id,actor_id,request_key,intent_hash,file_name,asset_type,mime,byte_size,byte_hash,temp_path)
  VALUES(n,p_project,p_actor->>'id',p_key,d,p_name,p_type,p_mime,p_size,p_hash,
    'projects/'||p_project||'/design-upload-v1/'||n||'/input.'||ext)
  ON CONFLICT(project_id,actor_id,request_key) DO NOTHING;
  SELECT * INTO STRICT s FROM upload_b2_draft.sessions
    WHERE project_id=p_project AND actor_id=p_actor->>'id' AND request_key=p_key FOR UPDATE;
  IF s.intent_hash<>d THEN RAISE SQLSTATE 'PT409' USING MESSAGE='request_key_conflict'; END IF;
  RETURN s.id;
END $$;

CREATE FUNCTION upload_b2_draft.lock_session(p_id uuid,p_actor jsonb)
RETURNS upload_b2_draft.sessions LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions; pid uuid;
BEGIN
  SELECT project_id INTO pid FROM upload_b2_draft.sessions WHERE id=p_id;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='session_missing'; END IF;
  PERFORM upload_b2_draft.project_guard(pid,p_actor);
  -- Existing asset writers lock assets before deletion journal touches sessions.
  PERFORM id FROM public.newsletter_project_design_assets WHERE id=p_id FOR UPDATE;
  SELECT * INTO STRICT s FROM upload_b2_draft.sessions WHERE id=p_id FOR UPDATE;
  IF s.actor_id IS DISTINCT FROM p_actor->>'id' THEN RAISE SQLSTATE '42501' USING MESSAGE='session_forbidden'; END IF;
  RETURN s;
END $$;

CREATE FUNCTION upload_b2_draft.claim(p_id uuid,p_actor jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions; g bigint; ext text;
BEGIN
  s=upload_b2_draft.lock_session(p_id,p_actor);
  IF s.receipt IS NOT NULL OR s.phase NOT IN ('prepared','verifying','stored') OR s.intent_expires<=clock_timestamp()
     OR (s.lease_until IS NOT NULL AND s.lease_until>clock_timestamp()) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='session_not_claimable'; END IF;
  -- Remember outputs of expired workers; do not delete them synchronously.
  IF s.final_path IS NOT NULL THEN
    INSERT INTO upload_b2_draft.cleanup_jobs(session_id,generation,bucket,path,reason,not_before)
      VALUES(s.id,s.generation,'design-production-assets',s.final_path,'superseded_worker',s.capability_deadline+interval '5 minutes') ON CONFLICT DO NOTHING;
  END IF;
  ext=CASE s.mime WHEN 'image/png' THEN 'png' WHEN 'image/jpeg' THEN 'jpg' ELSE 'webp' END;
  g=s.generation+1;
  UPDATE upload_b2_draft.sessions SET phase='verifying',generation=g,verified=NULL,
    lease_until=clock_timestamp()+interval '60 seconds',updated_at=clock_timestamp(),
    final_path='projects/'||s.project_id||'/production/'||s.asset_type||'/direct-v1/'||s.id||'/'||g||'.'||ext WHERE id=s.id;
  RETURN g;
END $$;

CREATE FUNCTION upload_b2_draft.reserve_capability(p_id uuid,p_actor jsonb)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions; attempt integer;
BEGIN
  s=upload_b2_draft.lock_session(p_id,p_actor);
  IF s.phase<>'prepared' OR s.intent_expires<=clock_timestamp() OR s.capability_issue_count>=3 THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='capability_not_issuable'; END IF;
  -- Reserve BEFORE remote mint; a crash leaves a conservative deadline.
  -- Provider clocks/in-flight requests still require remote proof before any GC.
  UPDATE upload_b2_draft.sessions SET capability_issue_count=capability_issue_count+1,
    capability_deadline=greatest(capability_deadline,clock_timestamp()+interval '2 hours 5 minutes')
    WHERE id=s.id RETURNING capability_issue_count INTO attempt;
  RETURN attempt;
END $$;

CREATE FUNCTION upload_b2_draft.mark_stored(p_id uuid,p_actor jsonb,p_generation bigint,p_proof jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions; w bigint; h bigint;
BEGIN
  s=upload_b2_draft.lock_session(p_id,p_actor);
  IF s.phase<>'verifying' OR s.generation<>p_generation OR s.lease_until<=clock_timestamp() OR s.intent_expires<=clock_timestamp() THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='stale_worker'; END IF;
  w=(p_proof->>'width')::bigint; h=(p_proof->>'height')::bigint;
  IF p_proof->>'hash' IS DISTINCT FROM s.byte_hash OR p_proof->>'mime' IS DISTINCT FROM s.mime
     OR (p_proof->>'size')::bigint IS DISTINCT FROM s.byte_size OR p_proof->>'policy' IS DISTINCT FROM s.policy_version
     OR w IS NULL OR h IS NULL OR w NOT BETWEEN 1 AND 8192 OR h NOT BETWEEN 1 AND 8192 OR w*h>16000000
     OR p_proof->>'decoded' IS DISTINCT FROM 'true' THEN
    RAISE SQLSTATE '22023' USING MESSAGE='verification_mismatch'; END IF;
  UPDATE upload_b2_draft.sessions SET phase='stored',verified=jsonb_build_object(
    'hash',s.byte_hash,'mime',s.mime,'size',s.byte_size,'width',w,'height',h,'policy',s.policy_version,'decoded',true),
    updated_at=clock_timestamp() WHERE id=s.id;
END $$;

CREATE FUNCTION upload_b2_draft.commit_asset(p_id uuid,p_actor jsonb,p_generation bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions; r jsonb;
BEGIN
  s=upload_b2_draft.lock_session(p_id,p_actor);
  IF s.receipt IS NOT NULL THEN RETURN s.receipt; END IF;
  IF s.phase<>'stored' OR s.generation<>p_generation OR s.lease_until<=clock_timestamp() OR s.intent_expires<=clock_timestamp() THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='stale_worker'; END IF;
  INSERT INTO public.newsletter_project_design_assets(id,project_id,asset_type,name,storage_bucket,storage_path,original_file_name,mime_type,file_size_bytes,approval_status,is_active,metadata)
    VALUES(s.id,s.project_id,s.asset_type,s.file_name,'design-production-assets',s.final_path,s.file_name,s.mime,s.byte_size,'draft',false,
      jsonb_build_object('directUpload',jsonb_build_object('sessionId',s.id,'policy',s.policy_version,'sha256',s.byte_hash)));
  r=jsonb_build_object('assetId',s.id,'state','registered','policy',s.policy_version);
  UPDATE upload_b2_draft.sessions SET phase='registered',receipt=r,lease_until=NULL,updated_at=clock_timestamp() WHERE id=s.id;
  INSERT INTO upload_b2_draft.cleanup_jobs(session_id,generation,bucket,path,reason,not_before)
    VALUES(s.id,s.generation,s.temp_bucket,s.temp_path,'registered_temp',s.capability_deadline+interval '5 minutes') ON CONFLICT DO NOTHING;
  RETURN r;
END $$;

CREATE FUNCTION upload_b2_draft.expire(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions;
BEGIN
  IF current_user<>'service_role' THEN RAISE SQLSTATE '42501' USING MESSAGE='server_required'; END IF;
  SELECT * INTO s FROM upload_b2_draft.sessions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR s.receipt IS NOT NULL OR s.intent_expires>clock_timestamp()
     OR (s.lease_until IS NOT NULL AND s.lease_until>clock_timestamp()) THEN RETURN false; END IF;
  UPDATE upload_b2_draft.sessions SET phase='expired',generation=generation+1,lease_until=NULL WHERE id=s.id;
  INSERT INTO upload_b2_draft.cleanup_jobs(session_id,generation,bucket,path,reason,not_before)
    VALUES(s.id,s.generation,s.temp_bucket,s.temp_path,'expired',s.capability_deadline+interval '5 minutes') ON CONFLICT DO NOTHING;
  IF s.final_path IS NOT NULL THEN
    INSERT INTO upload_b2_draft.cleanup_jobs(session_id,generation,bucket,path,reason,not_before)
      VALUES(s.id,s.generation,'design-production-assets',s.final_path,'expired_output',s.capability_deadline+interval '5 minutes') ON CONFLICT DO NOTHING;
  END IF;
  RETURN true;
END $$;

-- DRAFT lifecycle hooks: record cleanup intent only; never remove Storage files.
CREATE FUNCTION upload_b2_draft.asset_deleted() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions;
BEGIN
  SELECT * INTO s FROM upload_b2_draft.sessions WHERE id=old.id FOR UPDATE;
  IF FOUND THEN
    UPDATE upload_b2_draft.sessions SET asset_gone_at=clock_timestamp() WHERE id=s.id;
    INSERT INTO upload_b2_draft.cleanup_jobs(session_id,generation,bucket,path,reason,not_before)
      VALUES(s.id,s.generation,'design-production-assets',old.storage_path,'asset_deleted',s.capability_deadline+interval '5 minutes') ON CONFLICT DO NOTHING;
  END IF;
  RETURN old;
END $$;
CREATE TRIGGER upload_b2_asset_deleted AFTER DELETE ON public.newsletter_project_design_assets
  FOR EACH ROW EXECUTE FUNCTION upload_b2_draft.asset_deleted();
CREATE FUNCTION upload_b2_draft.project_deleted() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s upload_b2_draft.sessions;
BEGIN
  FOR s IN SELECT * FROM upload_b2_draft.sessions WHERE project_id=old.id ORDER BY id FOR UPDATE LOOP
    UPDATE upload_b2_draft.sessions SET project_gone_at=clock_timestamp(),
      phase=CASE WHEN receipt IS NULL THEN 'cancelled' ELSE phase END,
      generation=CASE WHEN receipt IS NULL THEN generation+1 ELSE generation END,
      lease_until=NULL WHERE id=s.id;
    INSERT INTO upload_b2_draft.cleanup_jobs(session_id,generation,bucket,path,reason,not_before)
      VALUES(s.id,s.generation,s.temp_bucket,s.temp_path,'project_deleted',s.capability_deadline+interval '5 minutes') ON CONFLICT DO NOTHING;
    IF s.final_path IS NOT NULL THEN
      INSERT INTO upload_b2_draft.cleanup_jobs(session_id,generation,bucket,path,reason,not_before)
        VALUES(s.id,s.generation,'design-production-assets',s.final_path,'project_deleted',s.capability_deadline+interval '5 minutes') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN old;
END $$;
CREATE TRIGGER upload_b2_project_deleted AFTER DELETE ON public.newsletter_projects
  FOR EACH ROW EXECUTE FUNCTION upload_b2_draft.project_deleted();
CREATE FUNCTION upload_b2_draft.freeze_intent() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF ROW(new.id,new.project_id,new.actor_id,new.request_key,new.intent_hash,new.file_name,new.asset_type,new.mime,new.byte_size,new.byte_hash,new.policy_version,new.temp_bucket,new.temp_path,new.created_at)
     IS DISTINCT FROM ROW(old.id,old.project_id,old.actor_id,old.request_key,old.intent_hash,old.file_name,old.asset_type,old.mime,old.byte_size,old.byte_hash,old.policy_version,old.temp_bucket,old.temp_path,old.created_at)
     OR (old.receipt IS NOT NULL AND (new.receipt IS DISTINCT FROM old.receipt OR new.phase<>'registered'
       OR ROW(new.final_path,new.verified,new.generation) IS DISTINCT FROM ROW(old.final_path,old.verified,old.generation))) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='immutable_upload_intent_or_receipt'; END IF;
  RETURN new;
END $$;
CREATE TRIGGER freeze_upload_intent BEFORE UPDATE ON upload_b2_draft.sessions
  FOR EACH ROW EXECUTE FUNCTION upload_b2_draft.freeze_intent();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA upload_b2_draft FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA upload_b2_draft TO service_role;
