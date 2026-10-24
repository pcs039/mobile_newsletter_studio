-- Contract specimen only; NOT a migration. Loaded into disposable PGlite only.
-- Contains no production tables, Storage operations or existing RPC changes.
DO $$ BEGIN
  IF current_setting('upload_b1.fixture_only', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'isolated fixture guard required';
  END IF;
END $$;
CREATE SCHEMA upload_b1_fixture;
CREATE ROLE upload_b1_reader NOLOGIN;
CREATE ROLE upload_b1_server NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA upload_b1_fixture TO upload_b1_reader, upload_b1_server;
CREATE TABLE upload_b1_fixture.assets (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, storage_path text UNIQUE NOT NULL,
  approval text NOT NULL DEFAULT 'draft' CHECK (approval = 'draft'),
  active boolean NOT NULL DEFAULT false CHECK (NOT active)
);
CREATE TABLE upload_b1_fixture.sessions (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, actor_id text NOT NULL,
  request_key uuid NOT NULL, intent_hash text NOT NULL CHECK (intent_hash ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','verifying','storage_ready','registered','expired','collected')),
  temp_path text UNIQUE NOT NULL, final_path text UNIQUE NOT NULL,
  intent_expires timestamptz NOT NULL, transport_deadline timestamptz NOT NULL,
  generation bigint NOT NULL DEFAULT 0 CHECK (generation >= 0), lease_until timestamptz,
  receipt jsonb, transport_closed boolean NOT NULL DEFAULT false,
  UNIQUE (project_id, actor_id, request_key),
  CHECK (transport_deadline >= intent_expires),
  CHECK ((state = 'registered') = (receipt IS NOT NULL)),
  CHECK ((state = 'verifying') = (lease_until IS NOT NULL))
  -- Receipt intentionally has no cascading FK to assets: deletion must not erase idempotency.
);
CREATE INDEX sessions_cleanup ON upload_b1_fixture.sessions(transport_deadline)
  WHERE receipt IS NULL;
ALTER TABLE upload_b1_fixture.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_b1_fixture.assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA upload_b1_fixture FROM PUBLIC, upload_b1_reader;
GRANT ALL ON ALL TABLES IN SCHEMA upload_b1_fixture TO upload_b1_server;

CREATE FUNCTION upload_b1_fixture.claim(p_id uuid, p_now timestamptz)
RETURNS bigint LANGUAGE plpgsql SET search_path = pg_catalog, upload_b1_fixture AS $$
DECLARE s upload_b1_fixture.sessions; g bigint;
BEGIN
  SELECT * INTO s FROM upload_b1_fixture.sessions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR s.receipt IS NOT NULL OR s.intent_expires<=p_now
     OR s.state NOT IN ('prepared','storage_ready','verifying')
     OR (s.lease_until IS NOT NULL AND s.lease_until>p_now) THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='not_claimable';
  END IF;
  UPDATE upload_b1_fixture.sessions SET state='verifying', generation=generation+1,
    lease_until=p_now+interval '60 seconds' WHERE id=p_id RETURNING generation INTO g;
  RETURN g;
END $$;
CREATE FUNCTION upload_b1_fixture.commit_verified(p_id uuid, p_generation bigint, p_now timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, upload_b1_fixture AS $$
DECLARE s upload_b1_fixture.sessions; r jsonb;
BEGIN
  SELECT * INTO s FROM upload_b1_fixture.sessions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='missing_session'; END IF;
  IF s.receipt IS NOT NULL THEN RETURN s.receipt; END IF;
  IF s.state<>'verifying' OR s.generation<>p_generation OR s.lease_until<=p_now
     OR s.intent_expires<=p_now THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='stale_worker';
  END IF;
  -- Actual ownership, file verification and Storage fencing are NOT implemented here.
  INSERT INTO upload_b1_fixture.assets(id,project_id,storage_path) VALUES(s.id,s.project_id,s.final_path);
  r=jsonb_build_object('assetId',s.id,'state','registered');
  UPDATE upload_b1_fixture.sessions SET state='registered',receipt=r,lease_until=NULL WHERE id=s.id;
  RETURN r;
END $$;
CREATE FUNCTION upload_b1_fixture.claim_cleanup(p_id uuid, p_now timestamptz)
RETURNS boolean LANGUAGE plpgsql SET search_path = pg_catalog, upload_b1_fixture AS $$
DECLARE s upload_b1_fixture.sessions;
BEGIN
  SELECT * INTO s FROM upload_b1_fixture.sessions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR s.receipt IS NOT NULL OR NOT s.transport_closed
     OR s.transport_deadline+interval '5 minutes'>p_now
     OR (s.lease_until IS NOT NULL AND s.lease_until>p_now)
     OR EXISTS(SELECT 1 FROM upload_b1_fixture.assets WHERE id=p_id) THEN RETURN false; END IF;
  UPDATE upload_b1_fixture.sessions SET state='collected',generation=generation+1,lease_until=NULL WHERE id=p_id;
  RETURN true;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA upload_b1_fixture FROM PUBLIC, upload_b1_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA upload_b1_fixture TO upload_b1_server;
