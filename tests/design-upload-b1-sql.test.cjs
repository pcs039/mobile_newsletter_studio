/* eslint-disable @typescript-eslint/no-require-imports -- Disposable PostgreSQL contract specimen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const runtime = process.env.DESIGN_UPLOAD_B1_SQL_RUNTIME;
const sql = fs.readFileSync(path.join(__dirname, 'fixtures/design-upload-b1-local.sql'), 'utf8');
test('B1 local SQL constraints, receipts, fencing and ACL', { skip: !runtime }, async t => {
  const { PGlite } = require(runtime);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-upload-b1-'));
  let db = new PGlite(dir);
  const project = randomUUID(), session = randomUUID(), key = randomUUID();
  const at = '2026-10-24T00:00:00Z';
  const insert = (id = session, request = key, digest = 'a'.repeat(64), size = 100) => db.query(`
    INSERT INTO upload_b1_fixture.sessions(id,project_id,actor_id,request_key,intent_hash,size_bytes,temp_path,final_path,intent_expires,transport_deadline)
    VALUES($1,$2,'qa',$3,$4,$5,$6,$7,'2026-10-24T00:30:00Z','2026-10-25T00:00:00Z')`,
  [id, project, request, digest, size, `quarantine/${id}`, `production/${id}`]);
  const claim = (id, time = at) => db.query('SELECT upload_b1_fixture.claim($1,$2) AS generation', [id,time]);
  const commit = (id, generation, time = at) => db.query('SELECT upload_b1_fixture.commit_verified($1,$2,$3) AS receipt', [id,generation,time]);
  try {
    await t.test('SQL refuses unguarded installation', async () => { await assert.rejects(db.exec(sql), /fixture guard/); });
    await db.exec("SET upload_b1.fixture_only='yes';" + sql);
    await insert();
    await t.test('request scope unique; malformed hash and size rejected', async () => {
      await assert.rejects(insert(randomUUID()), { code: '23505' });
      await assert.rejects(insert(randomUUID(),randomUUID(),'bad'), { code: '23514' });
      await assert.rejects(insert(randomUUID(),randomUUID(),'a'.repeat(64),10485761), { code: '23514' });
      assert.equal((await db.query('SELECT count(*)::int AS n FROM upload_b1_fixture.sessions')).rows[0].n,1);
    });
    await t.test('second finalize claim denied and expired worker fenced after takeover', async () => {
      assert.equal(Number((await claim(session)).rows[0].generation),1);
      await assert.rejects(claim(session), { code: 'PT409' });
      assert.equal(Number((await claim(session,'2026-10-24T00:01:01Z')).rows[0].generation),2);
      await assert.rejects(commit(session,1,'2026-10-24T00:01:02Z'), { code: 'PT409' });
    });
    await t.test('outer DB failure rolls back asset and receipt together', async () => {
      await db.exec('BEGIN'); await commit(session,2,'2026-10-24T00:01:02Z'); await db.exec('ROLLBACK');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM upload_b1_fixture.assets')).rows[0].n,0);
      assert.equal((await db.query('SELECT receipt FROM upload_b1_fixture.sessions WHERE id=$1',[session])).rows[0].receipt,null);
    });
    let receipt;
    await t.test('lost response retries return one stored receipt, no duplicate asset', async () => {
      receipt = (await commit(session,2,'2026-10-24T00:01:02Z')).rows[0].receipt;
      assert.deepEqual((await commit(session,2)).rows[0].receipt,receipt);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM upload_b1_fixture.assets')).rows[0].n,1);
    });
    await t.test('receipt survives local database close/reopen', async () => {
      await db.close(); db = new PGlite(dir);
      assert.deepEqual((await commit(session,2)).rows[0].receipt,receipt);
    });
    await t.test('asset delete does not erase receipt or allow retry resurrection', async () => {
      await db.query('DELETE FROM upload_b1_fixture.assets WHERE id=$1',[session]);
      assert.deepEqual((await commit(session,2)).rows[0].receipt,receipt);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM upload_b1_fixture.assets')).rows[0].n,0);
      assert.equal((await db.query('SELECT upload_b1_fixture.claim_cleanup($1,$2) AS ok',[session,'2026-10-26Z'])).rows[0].ok,false);
    });
    await t.test('cleanup waits for transport closure, bumps fencing generation and rejects late finalize', async () => {
      const id = randomUUID(); await insert(id,randomUUID());
      assert.equal((await db.query('SELECT upload_b1_fixture.claim_cleanup($1,$2) AS ok',[id,'2026-10-26Z'])).rows[0].ok,false);
      await db.query('UPDATE upload_b1_fixture.sessions SET transport_closed=true WHERE id=$1',[id]);
      assert.equal((await db.query('SELECT upload_b1_fixture.claim_cleanup($1,$2) AS ok',[id,'2026-10-25T00:04:59Z'])).rows[0].ok,false);
      assert.equal((await db.query('SELECT upload_b1_fixture.claim_cleanup($1,$2) AS ok',[id,'2026-10-26Z'])).rows[0].ok,true);
      await assert.rejects(commit(id,0,'2026-10-26Z'),{code:'PT409'});
    });
    await t.test('non-server role cannot read metadata or call functions; server role retains access', async () => {
      await db.exec('SET ROLE upload_b1_reader');
      await assert.rejects(db.query('SELECT * FROM upload_b1_fixture.sessions'),{code:'42501'});
      await assert.rejects(claim(session),{code:'42501'});
      await db.exec('RESET ROLE; SET ROLE upload_b1_server');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM upload_b1_fixture.sessions')).rows[0].n,2);
      assert.deepEqual((await commit(session,2)).rows[0].receipt,receipt);
      await db.exec('RESET ROLE');
    });
  } finally { await db.close(); fs.rmSync(dir,{recursive:true,force:true}); }
});
