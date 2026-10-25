-- FILE ONLY. No runner/automatic deployment. Apply to verified Staging only after approval.
-- Set app.marin_recovery_target='mvrkpmffuhcqwisqvpqi' in the same SQL session first.
BEGIN;
DO $$ BEGIN
  IF current_setting('app.marin_recovery_target',true) IS DISTINCT FROM 'mvrkpmffuhcqwisqvpqi'
     OR NOT EXISTS (SELECT 1 FROM public.newsletter_projects WHERE id='4cd5297e-a0fd-434c-84d4-fa4d3baf9389' AND slug='hwaseong-2026-10-samples') THEN
    RAISE EXCEPTION 'explicit verified Staging target required';
  END IF;
END $$;

CREATE TABLE public.hwaseong_marin_recoveries (
  parent_id uuid PRIMARY KEY REFERENCES public.newsletter_audio_files(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.newsletter_projects(id) ON DELETE RESTRICT,
  audio_id uuid NOT NULL UNIQUE REFERENCES public.newsletter_audio_files(id) ON DELETE RESTRICT,
  request_key text NOT NULL UNIQUE, attempt integer NOT NULL DEFAULT 1 CHECK(attempt=1),
  actor_id text NOT NULL, approval_reference text NOT NULL, claim_token uuid NOT NULL,
  parent_snapshot jsonb NOT NULL, phase text NOT NULL DEFAULT 'reserved'
    CHECK(phase IN ('reserved','unknown','output_verified','ready')),
  path text NOT NULL UNIQUE, byte_hash text, byte_size integer, duration_seconds integer,
  provider_status integer CHECK(provider_status BETWEEN 100 AND 599), provider_request_id text,
  last_error text CHECK(last_error IN ('provider_failed','provider_unknown','invalid_mp3','storage_unconfirmed','commit_unconfirmed')),
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(), output_verified_at timestamptz, completed_at timestamptz,
  CHECK(parent_id='e2041281-42e2-5363-a329-43db98714355' AND project_id='4cd5297e-a0fd-434c-84d4-fa4d3baf9389'),
  CHECK(audio_id='44c3166b-b00c-5c1e-ace8-72794dd2268b'),
  CHECK(request_key='44c3166bb00cec1e4ce872794dd2268b0c63cd59d8c2b5ec80bbe63708abd41e'),
  CHECK(path='projects/4cd5297e-a0fd-434c-84d4-fa4d3baf9389/sample-tts-recovery-v1/44c3166b-b00c-5c1e-ace8-72794dd2268b/000.mp3'),
  CHECK(length(actor_id) BETWEEN 1 AND 128 AND length(approval_reference) BETWEEN 1 AND 200),
  CHECK(provider_request_id IS NULL OR provider_request_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  CHECK((phase IN ('output_verified','ready'))=(byte_hash IS NOT NULL AND byte_size IS NOT NULL AND duration_seconds IS NOT NULL AND output_verified_at IS NOT NULL)),
  CHECK(byte_hash IS NULL OR byte_hash ~ '^[a-f0-9]{64}$'),
  CHECK(byte_size IS NULL OR byte_size BETWEEN 100 AND 8388608),
  CHECK(duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 120),
  CHECK((phase='ready')=(completed_at IS NOT NULL))
);
ALTER TABLE public.hwaseong_marin_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hwaseong_marin_recoveries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.hwaseong_marin_recoveries TO service_role;

-- These private helpers are not executable by PostgREST roles.
CREATE FUNCTION public._marin_recovery_guard(p_actor jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE p public.newsletter_projects;
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' OR p_actor->>'role' IS DISTINCT FROM 'admin'
     OR coalesce(length(p_actor->>'id'),0) NOT BETWEEN 1 AND 128 THEN
    RAISE SQLSTATE '42501' USING MESSAGE='server_admin_required';
  END IF;
  SELECT * INTO p FROM public.newsletter_projects WHERE id='4cd5297e-a0fd-434c-84d4-fa4d3baf9389' FOR SHARE;
  IF NOT FOUND OR p.slug<>'hwaseong-2026-10-samples' OR p.deleted_at IS NOT NULL OR p.status::text='archived' THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='project_unavailable';
  END IF;
  PERFORM 1 FROM public.newsletter_audio_files WHERE id='e2041281-42e2-5363-a329-43db98714355' FOR SHARE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='parent_unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(704273,1);
END $$;

CREATE FUNCTION public._marin_recovery_receipt(r public.hwaseong_marin_recoveries) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT to_jsonb(r)-ARRAY['claim_token','parent_snapshot','actor_id','approval_reference'];
$$;

CREATE FUNCTION public.marin_recovery_claim(p_actor jsonb,p_parent_snapshot jsonb,p_token uuid,p_approval text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.hwaseong_marin_recoveries; p public.newsletter_audio_files;
  original_path text='projects/4cd5297e-a0fd-434c-84d4-fa4d3baf9389/sample-tts-v1/e2041281-42e2-5363-a329-43db98714355/000.mp3';
  new_path text='projects/4cd5297e-a0fd-434c-84d4-fa4d3baf9389/sample-tts-recovery-v1/44c3166b-b00c-5c1e-ace8-72794dd2268b/000.mp3';
BEGIN
  PERFORM public._marin_recovery_guard(p_actor);
  SELECT * INTO r FROM public.hwaseong_marin_recoveries WHERE parent_id='e2041281-42e2-5363-a329-43db98714355' FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('won',false,'receipt',public._marin_recovery_receipt(r)); END IF;
  SELECT * INTO p FROM public.newsletter_audio_files WHERE id='e2041281-42e2-5363-a329-43db98714355';
  IF to_jsonb(p) IS DISTINCT FROM p_parent_snapshot OR p.project_id<>'4cd5297e-a0fd-434c-84d4-fa4d3baf9389'
     OR p.article_id IS NOT NULL OR p.source_type IS DISTINCT FROM 'ai_tts' OR p.transcript_type IS DISTINCT FROM 'custom_script'
     OR p.script_status<>'pending' OR p.ai_tts_generated_at IS NOT NULL OR p.ai_tts_voice IS DISTINCT FROM 'marin'
     OR p.title<>'[시연 TTS v1] 음질 비교 marin' OR p.pronunciation_note IS NOT NULL OR p.duration_seconds IS NOT NULL
     OR p.created_at IS DISTINCT FROM '2026-10-25T06:18:52.579765+00:00'::timestamptz
     OR p.updated_at IS DISTINCT FROM '2026-10-25T06:18:52.579765+00:00'::timestamptz
     OR p.ai_tts_model IS DISTINCT FROM 'gpt-4o-mini-tts'
     OR p.ai_tts_text_hash IS DISTINCT FROM 'e204128142e2c363432943db98714355fba056c9534e24df529f116522e2973d'
     OR p.script_text IS DISTINCT FROM '화성의 오늘을 더 가까이. 생활과 관광, 문화와 사람을 잇는 모바일 소식지입니다. 글자를 키우고, 편안한 속도로 소식을 들어 보세요.'
     OR p.file_path<>original_path OR p.ai_tts_audio_paths IS DISTINCT FROM jsonb_build_array(original_path)
     OR p_token IS NULL OR coalesce(length(btrim(p_approval)),0) NOT BETWEEN 1 AND 200 THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='parent_or_approval_mismatch';
  END IF;
  INSERT INTO public.newsletter_audio_files(id,project_id,article_id,title,file_path,script_text,script_status,
    transcript_type,source_type,ai_tts_audio_paths,ai_tts_text_hash,ai_tts_voice,ai_tts_model)
    VALUES('44c3166b-b00c-5c1e-ace8-72794dd2268b',p.project_id,NULL,'[시연 TTS 복구 v1] 음질 비교 marin',new_path,p.script_text,'pending',
      'custom_script','ai_tts',jsonb_build_array(new_path),p.ai_tts_text_hash,'marin','gpt-4o-mini-tts');
  INSERT INTO public.hwaseong_marin_recoveries(parent_id,project_id,audio_id,request_key,actor_id,approval_reference,claim_token,parent_snapshot,path)
    VALUES(p.id,p.project_id,'44c3166b-b00c-5c1e-ace8-72794dd2268b','44c3166bb00cec1e4ce872794dd2268b0c63cd59d8c2b5ec80bbe63708abd41e',p_actor->>'id',btrim(p_approval),p_token,to_jsonb(p),new_path)
    RETURNING * INTO r;
  RETURN jsonb_build_object('won',true,'receipt',public._marin_recovery_receipt(r));
END $$;

-- Only the one successful claim owner may record a provider outcome. No dispatch takeover.
CREATE FUNCTION public.marin_recovery_record(p_actor jsonb,p_token uuid,p_proof jsonb,p_status integer,p_request_id text,p_error text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.hwaseong_marin_recoveries; p public.newsletter_audio_files;
BEGIN
  PERFORM public._marin_recovery_guard(p_actor);
  SELECT * INTO r FROM public.hwaseong_marin_recoveries WHERE parent_id='e2041281-42e2-5363-a329-43db98714355' FOR UPDATE;
  IF NOT FOUND OR r.claim_token IS DISTINCT FROM p_token OR r.actor_id<>p_actor->>'id' THEN RAISE SQLSTATE '42501' USING MESSAGE='claim_owner_required'; END IF;
  SELECT * INTO p FROM public.newsletter_audio_files WHERE id=r.parent_id;
  IF to_jsonb(p) IS DISTINCT FROM r.parent_snapshot THEN RAISE SQLSTATE 'PT409' USING MESSAGE='parent_changed'; END IF;
  IF p_proof IS NOT NULL THEN
    IF p_status IS DISTINCT FROM 200 OR p_proof->>'hash' IS NULL OR p_proof->>'hash' !~ '^[a-f0-9]{64}$'
       OR coalesce((p_proof->>'size')::integer,0) NOT BETWEEN 100 AND 8388608
       OR coalesce((p_proof->>'duration')::integer,0) NOT BETWEEN 1 AND 120 THEN
      RAISE SQLSTATE '22023' USING MESSAGE='invalid_proof';
    END IF;
    IF r.phase='output_verified' AND r.byte_hash=p_proof->>'hash' AND r.byte_size=(p_proof->>'size')::integer
       AND r.duration_seconds=(p_proof->>'duration')::integer THEN RETURN public._marin_recovery_receipt(r); END IF;
    IF r.phase<>'reserved' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='outcome_already_recorded'; END IF;
    UPDATE public.hwaseong_marin_recoveries SET phase='output_verified',byte_hash=p_proof->>'hash',byte_size=(p_proof->>'size')::integer,
      duration_seconds=(p_proof->>'duration')::integer,output_verified_at=clock_timestamp(),provider_status=p_status,provider_request_id=p_request_id
      WHERE parent_id=r.parent_id RETURNING * INTO r;
  ELSE
    IF p_error IS NULL THEN RAISE SQLSTATE '22023' USING MESSAGE='error_required'; END IF;
    IF r.phase='reserved' THEN
      UPDATE public.hwaseong_marin_recoveries SET phase='unknown',last_error=p_error,provider_status=p_status,provider_request_id=p_request_id
        WHERE parent_id=r.parent_id RETURNING * INTO r;
    END IF;
  END IF;
  RETURN public._marin_recovery_receipt(r);
END $$;

-- Called only after re-downloading and verifying the saved MP3; never generates audio.
CREATE FUNCTION public.marin_recovery_complete(p_actor jsonb,p_hash text,p_size integer,p_duration integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.hwaseong_marin_recoveries; p public.newsletter_audio_files; a public.newsletter_audio_files;
BEGIN
  PERFORM public._marin_recovery_guard(p_actor);
  SELECT * INTO r FROM public.hwaseong_marin_recoveries WHERE parent_id='e2041281-42e2-5363-a329-43db98714355' FOR UPDATE;
  IF NOT FOUND OR r.phase NOT IN ('output_verified','ready') OR r.byte_hash IS DISTINCT FROM p_hash
     OR r.byte_size IS DISTINCT FROM p_size OR r.duration_seconds IS DISTINCT FROM p_duration THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='verified_output_required';
  END IF;
  SELECT * INTO p FROM public.newsletter_audio_files WHERE id=r.parent_id;
  IF to_jsonb(p) IS DISTINCT FROM r.parent_snapshot THEN RAISE SQLSTATE 'PT409' USING MESSAGE='parent_changed'; END IF;
  SELECT * INTO a FROM public.newsletter_audio_files WHERE id=r.audio_id FOR UPDATE;
  IF NOT FOUND OR a.project_id<>r.project_id OR a.article_id IS NOT NULL OR a.source_type IS DISTINCT FROM 'ai_tts'
     OR a.transcript_type IS DISTINCT FROM 'custom_script' OR a.script_text IS DISTINCT FROM p.script_text
     OR a.ai_tts_voice IS DISTINCT FROM 'marin' OR a.ai_tts_model IS DISTINCT FROM 'gpt-4o-mini-tts'
     OR a.ai_tts_text_hash IS DISTINCT FROM p.ai_tts_text_hash OR a.file_path<>r.path
     OR a.ai_tts_audio_paths IS DISTINCT FROM jsonb_build_array(r.path) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='reserved_asset_changed';
  END IF;
  IF r.phase='ready' THEN
    IF a.script_status<>'approved' OR a.ai_tts_generated_at IS NULL OR a.duration_seconds IS DISTINCT FROM r.duration_seconds THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='ready_asset_changed';
    END IF;
    RETURN public._marin_recovery_receipt(r);
  END IF;
  IF a.script_status<>'pending' OR a.ai_tts_generated_at IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='reserved_asset_changed'; END IF;
  UPDATE public.newsletter_audio_files SET script_status='approved',ai_tts_generated_at=clock_timestamp(),duration_seconds=p_duration WHERE id=r.audio_id;
  UPDATE public.hwaseong_marin_recoveries SET phase='ready',completed_at=clock_timestamp() WHERE parent_id=r.parent_id RETURNING * INTO r;
  RETURN public._marin_recovery_receipt(r);
END $$;

REVOKE ALL ON FUNCTION public._marin_recovery_guard(jsonb),public._marin_recovery_receipt(public.hwaseong_marin_recoveries) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.marin_recovery_claim(jsonb,jsonb,uuid,text),public.marin_recovery_record(jsonb,uuid,jsonb,integer,text,text),public.marin_recovery_complete(jsonb,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marin_recovery_claim(jsonb,jsonb,uuid,text),public.marin_recovery_record(jsonb,uuid,jsonb,integer,text,text),public.marin_recovery_complete(jsonb,text,integer,integer) TO service_role;
COMMIT;
