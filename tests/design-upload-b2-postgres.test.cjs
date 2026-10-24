/* eslint-disable @typescript-eslint/no-require-imports -- Local socket-only PostgreSQL, never reads app env or remote URLs. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const bin = process.env.DESIGN_UPLOAD_B2_PG_BIN, runtime = process.env.DESIGN_UPLOAD_B2_PG_RUNTIME;
const operating = process.env.DESIGN_UPLOAD_B3_MIGRATION_TEST === '1';
const actor = { id: 'qa', name: 'QA', role: 'user' }, digest = 'a'.repeat(64);
test('B2 real PostgreSQL multi-connection contracts and legacy writers', { skip: !bin || !runtime, timeout: 90000 }, async t => {
  const { Client } = require(runtime);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'mns-upload-b2-'));
  const data = path.join(dir,'db'), socket = path.join(dir,'socket'); fs.mkdirSync(socket,{mode:0o700});
  const database = 'mns_upload_b2_' + randomUUID().replaceAll('-','');
  const port = 54329; // Unix socket in a unique private directory; TCP is disabled.
  let started = false; const clients = [];
  const exec = (command,args) => execFileSync(path.join(bin,command),args,{stdio:'pipe',timeout:15000});
  const connect = async (name, db = database) => {
    const c = new Client({host:socket,port,database:db,user:'fixture_root',password:'',ssl:false,application_name:name,
      connectionTimeoutMillis:3000,query_timeout:7000});
    await c.connect(); clients.push(c);
    if(operating){const original=c.query.bind(c);c.query=(text,...args)=>original(typeof text==='string'?text.replaceAll('upload_b2_draft','design_asset_upload'):text,...args);}
    await c.query("SET statement_timeout='5s'; SET idle_in_transaction_session_timeout='15s'");
    return c;
  };
  try {
    exec('initdb',['-D',data,'--username=fixture_root','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
    exec('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-k ${socket} -p ${port} -c listen_addresses='' -c max_connections=12`,'-w','start']); started=true;
    const admin = await connect('bootstrap','postgres'); await admin.query(`CREATE DATABASE ${database}`);
    const root = await connect('assertions');
    await root.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
      CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE public.newsletter_projects(id uuid PRIMARY KEY,assignee_name text,deleted_at timestamptz,status text NOT NULL DEFAULT 'draft');
      CREATE TABLE public.newsletter_project_design_kits(id uuid PRIMARY KEY);
      CREATE TABLE public.newsletter_articles(id uuid PRIMARY KEY,project_id uuid REFERENCES public.newsletter_projects(id) ON DELETE CASCADE,title text,body text);
      SET upload_b2.isolated='yes';`);
    for (const file of ['schema_v1_15_project_design_assets.sql','schema_v1_22_design_intake_foundation.sql','schema_v1_23_design_production_assets.sql',...(operating?['schema_v1_24_design_processing_jobs.sql']:[]),'schema_v1_25_article_compositions.sql','schema_v1_26_composition_asset_delete_integrity.sql','schema_v1_32_design_asset_metadata.sql'])
      await root.query(fs.readFileSync(path.join(__dirname,'../supabase',file),'utf8'));
    const draft = fs.readFileSync(path.join(__dirname,operating?'../supabase/schema_v1_41_design_asset_direct_upload.sql':'fixtures/design-upload-b2-draft.sql'),'utf8');
    if(!operating){await root.query("SET upload_b2.isolated='no'"); await assert.rejects(root.query(draft),/local B2 database/);}
    await root.query("SET upload_b2.isolated='yes'"); await root.query(draft);
    await root.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role');
    const a = await connect('writer-a'), b = await connect('writer-b');
    await a.query('SET ROLE service_role'); await b.query('SET ROLE service_role');
    t.afterEach(async()=>{ await a.query('ROLLBACK'); await b.query('ROLLBACK'); await root.query('RESET ROLE'); });
    const q = async (c,sql,args=[]) => (await c.query(sql,args)).rows;
    const seed = async () => { const id=randomUUID(); await root.query('INSERT INTO public.newsletter_projects(id,assignee_name) VALUES($1,$2)',[id,'QA']); return id; };
    const prepare = async (c,p,key=randomUUID(),name='fixture.png',who=actor) => (await q(c,'SELECT upload_b2_draft.prepare($1,$2,$3,$4,$5,$6,$7,$8) id',[p,who,key,name,'background','image/png',100,digest]))[0].id;
    const claim = async (c,id,who=actor) => Number((await q(c,'SELECT upload_b2_draft.claim($1,$2) g',[id,who]))[0].g);
    const mark = (c,id,g,patch={}) => q(c,'SELECT upload_b2_draft.mark_stored($1,$2,$3,$4)',[id,actor,g,{hash:digest,mime:'image/png',size:100,width:8,height:8,policy:'b2-raster-v1',decoded:true,...patch}]);
    const commit = async (c,id,g=1) => (await q(c,'SELECT upload_b2_draft.commit_asset($1,$2,$3) receipt',[id,actor,g]))[0].receipt;
    const ready = async p => { const id=await prepare(a,p),g=await claim(a,id); await mark(a,id,g); return {id,g}; };
    const outcome = promise => promise.then(value=>({value}),error=>({error}));
    const blocked = async c => {
      for(let n=0;n<100;n++) {
        const row=(await q(root,'SELECT cardinality(pg_blocking_pids($1)) n',[c.processID]))[0];
        if(row.n>0) return;
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.fail('expected a real PostgreSQL lock wait');
    };
    const countAssets = async id => Number((await q(root,'SELECT count(*) n FROM public.newsletter_project_design_assets WHERE id=$1',[id]))[0].n);
    await t.test('same-key parallel prepare waits on UNIQUE and returns one session', async()=>{
      const p=await seed(),key=randomUUID(); await a.query('BEGIN'); const id=await prepare(a,p,key);
      const waiting=outcome(prepare(b,p,key)); await blocked(b); await a.query('COMMIT');
      assert.equal((await waiting).value,id);
      assert.equal(Number((await q(root,'SELECT count(*) n FROM upload_b2_draft.sessions WHERE project_id=$1',[p]))[0].n),1);
    });
    await t.test('same key with changed input rejects after concurrent commit',async()=>{
      const p=await seed(),key=randomUUID(); await a.query('BEGIN'); await prepare(a,p,key);
      const waiting=outcome(prepare(b,p,key,'changed.png')); await blocked(b); await a.query('COMMIT');
      assert.equal((await waiting).error.code,'PT409');
    });
    await t.test('project/owner boundaries, unsupported name and proof mismatch fail closed',async()=>{
      const p=await seed(),id=await prepare(a,p),g=await claim(a,id);
      await assert.rejects(prepare(b,p,randomUUID(),'fixture.png',{id:'other',name:'Other',role:'user'}),{code:'42501'});
      await assert.rejects(claim(b,id,{id:'other',name:'QA',role:'user'}),{code:'42501'});
      await assert.rejects(prepare(b,p,randomUUID(),'file.svg'),{code:'22023'});
      for(const proof of [{hash:'b'.repeat(64)},{width:8193},{width:5000,height:5000},{decoded:false}])
        await assert.rejects(mark(b,id,g,proof),{code:'22023'});
      assert.equal(await countAssets(id),0);
    });
    await t.test('capability reissue is bounded and deadline is reserved before external work',async()=>{
      const p=await seed(),id=await prepare(a,p);
      for(let n=1;n<=3;n++) assert.equal((await q(a,'SELECT upload_b2_draft.reserve_capability($1,$2) n',[id,actor]))[0].n,n);
      await assert.rejects(a.query('SELECT upload_b2_draft.reserve_capability($1,$2)',[id,actor]),{code:'PT409'});
      await claim(a,id);
      await assert.rejects(a.query('SELECT upload_b2_draft.reserve_capability($1,$2)',[id,actor]),{code:'PT409'});
    });
    await t.test('concurrent finalize returns one receipt and one asset',async()=>{
      const p=await seed(),{id,g}=await ready(p); await a.query('BEGIN'); const receipt=await commit(a,id,g);
      const waiting=outcome(commit(b,id,g)); await blocked(b); await a.query('COMMIT');
      assert.deepEqual((await waiting).value,receipt); assert.equal(await countAssets(id),1);
    });
    await t.test('commit followed by caller disconnect recovers receipt on another connection',async()=>{
      const p=await seed(),{id,g}=await ready(p), lost=await connect('discarded-result'); await lost.query('SET ROLE service_role');
      await commit(lost,id,g); await lost.end(); // Discard application result; not a packet-drop proxy.
      assert.equal((await commit(b,id,g)).assetId,id); assert.equal(await countAssets(id),1);
    });
    await t.test('transaction rollback removes asset and receipt together, safe retry succeeds',async()=>{
      const p=await seed(),{id,g}=await ready(p); await a.query('BEGIN'); await commit(a,id,g); await a.query('ROLLBACK');
      assert.equal(await countAssets(id),0);
      assert.equal((await q(root,'SELECT receipt FROM upload_b2_draft.sessions WHERE id=$1',[id]))[0].receipt,null);
      await commit(b,id,g); assert.equal(await countAssets(id),1);
    });
    await t.test('lease takeover fences late worker and journals its distinct output path',async()=>{
      const p=await seed(),id=await prepare(a,p),old=await claim(a,id);
      await root.query("UPDATE upload_b2_draft.sessions SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[id]);
      const next=await claim(b,id); assert.equal(next,old+1);
      await assert.rejects(mark(a,id,old),{code:'PT409'}); await assert.rejects(commit(a,id,old),{code:'PT409'});
      await mark(b,id,next); await commit(b,id,next);
      assert.match((await q(root,'SELECT path FROM upload_b2_draft.cleanup_jobs WHERE session_id=$1 AND reason=$2',[id,'superseded_worker']))[0].path,/\/1\.png$/);
    });
    await t.test('expiry first blocks waiting finalize; registered receipt blocks expiry',async()=>{
      const p=await seed(),{id,g}=await ready(p);
      await root.query("UPDATE upload_b2_draft.sessions SET intent_expires=clock_timestamp()-interval '1 second',lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[id]);
      await a.query('BEGIN'); await a.query('SELECT upload_b2_draft.expire($1)',[id]);
      const waiting=outcome(commit(b,id,g)); await blocked(b); await a.query('COMMIT'); assert.equal((await waiting).error.code,'PT409');
      const next=await ready(p); await a.query('BEGIN'); await commit(a,next.id,next.g);
      const expires=outcome(b.query('SELECT upload_b2_draft.expire($1) ok',[next.id])); await blocked(b); await a.query('COMMIT');
      assert.equal((await expires).value.rows[0].ok,false);
    });
    await t.test('project delete first cancels sessions and rejects waiting finalize',async()=>{
      const p=await seed(),{id,g}=await ready(p); await a.query('BEGIN'); await a.query('DELETE FROM public.newsletter_projects WHERE id=$1',[p]);
      const waiting=outcome(commit(b,id,g)); await blocked(b); await a.query('COMMIT'); assert.equal((await waiting).error.code,'PT409');
      const s=(await q(root,'SELECT phase,project_gone_at FROM upload_b2_draft.sessions WHERE id=$1',[id]))[0];
      assert.equal(s.phase,'cancelled'); assert.ok(s.project_gone_at); assert.equal(await countAssets(id),0);
    });
    await t.test('finalize first permits later project cascade, retaining receipt and cleanup paths',async()=>{
      const p=await seed(),{id,g}=await ready(p); await a.query('BEGIN'); const receipt=await commit(a,id,g);
      const waiting=outcome(b.query('DELETE FROM public.newsletter_projects WHERE id=$1',[p])); await blocked(b); await a.query('COMMIT'); assert.ok(!(await waiting).error);
      const s=(await q(root,'SELECT receipt,project_gone_at,asset_gone_at FROM upload_b2_draft.sessions WHERE id=$1',[id]))[0];
      assert.deepEqual(s.receipt,receipt); assert.ok(s.project_gone_at); assert.ok(s.asset_gone_at); assert.equal(await countAssets(id),0);
    });
    for(const mode of ['soft-delete','archived','assignee-change']) await t.test(`${mode} writer first prevents stale authorization at commit`,async()=>{
      const p=await seed(),{id,g}=await ready(p); await a.query('BEGIN');
      await a.query(mode==='soft-delete'?'UPDATE public.newsletter_projects SET deleted_at=clock_timestamp() WHERE id=$1':mode==='archived'?"UPDATE public.newsletter_projects SET status='archived' WHERE id=$1":"UPDATE public.newsletter_projects SET assignee_name='Other' WHERE id=$1",[p]);
      const waiting=outcome(commit(b,id,g)); await blocked(b); await a.query('COMMIT');
      assert.equal((await waiting).error.code,mode==='assignee-change'?'42501':'PT409'); assert.equal(await countAssets(id),0);
    });
    await t.test('existing PATCH fields survive an idempotent finalize waiting on asset writer',async()=>{
      const p=await seed(),{id,g}=await ready(p); await commit(a,id,g); await a.query('BEGIN');
      await a.query("UPDATE public.newsletter_project_design_assets SET name='Edited',approval_status='approved',is_active=true WHERE id=$1",[id]);
      const waiting=outcome(commit(b,id,g)); await blocked(b); await a.query('COMMIT'); assert.ok(!(await waiting).error);
      const asset=(await q(root,'SELECT name,approval_status,is_active FROM public.newsletter_project_design_assets WHERE id=$1',[id]))[0];
      assert.deepEqual(asset,{name:'Edited',approval_status:'approved',is_active:true});
    });
    await t.test('existing DELETE and finalize retry do not resurrect asset or erase receipt',async()=>{
      const p=await seed(),{id,g}=await ready(p),receipt=await commit(a,id,g); await a.query('BEGIN');
      await a.query('DELETE FROM public.newsletter_project_design_assets WHERE id=$1',[id]);
      const waiting=outcome(commit(b,id,g)); await blocked(b); await a.query('COMMIT');
      assert.deepEqual((await waiting).value,receipt); assert.equal(await countAssets(id),0);
    });
    await t.test('v1.26 deferred FK: DELETE winning rejects concurrent new placement at commit',async()=>{
      const p=await seed(),{id,g}=await ready(p); await commit(a,id,g);
      const article=randomUUID(),composition=randomUUID();
      await root.query("INSERT INTO public.newsletter_articles VALUES($1,$2,'Keep title','Keep body')",[article,p]);
      await root.query('INSERT INTO public.newsletter_article_compositions(id,project_id,article_id) VALUES($1,$2,$3)',[composition,p,article]);
      await a.query('BEGIN'); await a.query("INSERT INTO public.newsletter_article_composition_assets(composition_id,asset_id,slot) VALUES($1,$2,'hero_background')",[composition,id]);
      // INITIALLY DEFERRED checks at COMMIT, not at INSERT. Do not assume
      // the placement has already locked/referenced the asset before its commit.
      await b.query('BEGIN'); await b.query('DELETE FROM public.newsletter_project_design_assets WHERE id=$1',[id]);
      const waiting=outcome(a.query('COMMIT')); await blocked(a); await b.query('COMMIT');
      assert.equal((await waiting).error.code,'23503'); assert.equal(await countAssets(id),0);
      assert.equal(Number((await q(root,'SELECT count(*) n FROM public.newsletter_article_composition_assets WHERE composition_id=$1',[composition]))[0].n),0);
      assert.equal((await q(root,'SELECT body FROM public.newsletter_articles WHERE id=$1',[article]))[0].body,'Keep body');
    });
    await t.test('v1.26 committed placement rejects legacy DELETE and rolls back cleanup journal',async()=>{
      const p=await seed(),{id,g}=await ready(p); await commit(a,id,g);
      const article=randomUUID(),composition=randomUUID();
      await root.query("INSERT INTO public.newsletter_articles VALUES($1,$2,'Keep title','Keep body')",[article,p]);
      await root.query('INSERT INTO public.newsletter_article_compositions(id,project_id,article_id) VALUES($1,$2,$3)',[composition,p,article]);
      await a.query("INSERT INTO public.newsletter_article_composition_assets(composition_id,asset_id,slot) VALUES($1,$2,'hero_background')",[composition,id]);
      await b.query('BEGIN'); await b.query('DELETE FROM public.newsletter_project_design_assets WHERE id=$1',[id]);
      await assert.rejects(b.query('COMMIT'),{code:'23503'}); assert.equal(await countAssets(id),1);
      assert.equal((await q(root,'SELECT asset_gone_at FROM upload_b2_draft.sessions WHERE id=$1',[id]))[0].asset_gone_at,null);
    });
    await t.test('legacy POST insert coexists, new registration stays draft/inactive',async()=>{
      const p=await seed(),{id,g}=await ready(p),old=randomUUID(); await a.query('BEGIN');
      await a.query("INSERT INTO public.newsletter_project_design_assets(id,project_id,asset_type,name,storage_bucket,storage_path,approval_status,is_active) VALUES($1,$2,'background','Legacy','design-production-assets','legacy-fixture.png','approved',true)",[old,p]);
      await commit(b,id,g); await a.query('COMMIT');
      assert.equal(await countAssets(old),1);
      assert.deepEqual((await q(root,'SELECT approval_status,is_active FROM public.newsletter_project_design_assets WHERE id=$1',[id]))[0],{approval_status:'draft',is_active:false});
    });
    await t.test('ACL, no SECURITY DEFINER, frozen intent and receipt, no server session DELETE',async()=>{
      const p=await seed(),{id,g}=await ready(p); await commit(a,id,g);
      await assert.rejects(a.query("UPDATE upload_b2_draft.sessions SET actor_id='other' WHERE id=$1",[id]),{code:'PT409'});
      await assert.rejects(a.query("UPDATE upload_b2_draft.sessions SET receipt='{}' WHERE id=$1",[id]),{code:'PT409'});
      await assert.rejects(a.query("UPDATE upload_b2_draft.sessions SET final_path='unexpected-path' WHERE id=$1",[id]),{code:'PT409'});
      await assert.rejects(a.query('DELETE FROM upload_b2_draft.sessions WHERE id=$1',[id]),{code:'42501'});
      for(const role of ['anon','authenticated']) {
        await root.query(`SET ROLE ${role}`);
        await assert.rejects(root.query('SELECT * FROM upload_b2_draft.sessions'),{code:'42501'});
        await assert.rejects(root.query('SELECT upload_b2_draft.claim($1,$2)',[id,actor]),{code:'42501'});
        await root.query('RESET ROLE');
      }
      const functions=await q(root,"SELECT p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='upload_b2_draft'");
      for(const fn of functions){assert.equal(fn.prosecdef,false);assert.ok(fn.proconfig.includes('search_path=pg_catalog'));}
    });
    if(operating)await t.test('operating public wrappers, request lookup, quota, proof allowlist and v1.24 references',async()=>{
      const p=await seed(),request=randomUUID();
      const id=(await q(a,'SELECT public.prepare_design_asset_upload($1,$2,$3,$4,$5,$6,$7,$8) id',[p,actor,request,'fixture.png','background','image/png',100,digest]))[0].id;
      const state=async()=> (await q(a,'SELECT public.get_design_asset_upload_status($1,$2,$3,$4) s',[p,actor,null,request]))[0].s;
      assert.equal((await state()).id,id);
      const g=(await q(a,'SELECT public.claim_design_asset_upload($1,$2) g',[id,actor]))[0].g;
      await a.query('SELECT public.mark_design_asset_upload_stored($1,$2,$3,$4)',[id,actor,g,{hash:digest,mime:'image/png',size:100,width:8,height:8,policy:'b2-raster-v1',decoded:true,untrusted:'must not persist'}]);
      assert.equal((await state()).verified.untrusted,undefined);
      await a.query('SELECT public.finalize_design_asset_upload($1,$2,$3)',[id,actor,g]);
      const job=randomUUID();
      await a.query("INSERT INTO public.newsletter_design_processing_jobs(id,project_id,provider,operation) VALUES($1,$2,'canva','canva_export')",[job,p]);
      await a.query('INSERT INTO public.newsletter_design_processing_job_outputs(job_id,asset_id) VALUES($1,$2)',[job,id]);
      await assert.rejects(a.query("UPDATE public.newsletter_project_design_assets SET asset_type='logo' WHERE id=$1",[id]),{code:'23514'});
      await a.query('DELETE FROM public.newsletter_project_design_assets WHERE id=$1',[id]);
      assert.equal((await q(a,'SELECT asset_id FROM public.newsletter_design_processing_job_outputs WHERE job_id=$1',[job]))[0].asset_id,null);
      assert.equal((await state()).asset_exists,false);assert.equal((await state()).receipt.assetId,id);
      for(let n=0;n<8;n++)await prepare(a,p);
      await assert.rejects(prepare(a,p),{code:'PT409'});
      await root.query('SET ROLE anon');await assert.rejects(root.query('SELECT public.get_design_asset_upload_status($1,$2,$3,$4)',[p,actor,id,null]),{code:'42501'});await root.query('RESET ROLE');
    });
    if(operating)await t.test('unregistered ID collision does not journal an unrelated legacy file for cleanup',async()=>{
      const p=await seed(),id=await prepare(a,p);
      await a.query("INSERT INTO public.newsletter_project_design_assets(id,project_id,asset_type,name,storage_bucket,storage_path) VALUES($1,$2,'background','Legacy collision','design-production-assets','unrelated-legacy.png')",[id,p]);
      await a.query('DELETE FROM public.newsletter_project_design_assets WHERE id=$1',[id]);
      assert.equal((await q(root,'SELECT asset_gone_at FROM upload_b2_draft.sessions WHERE id=$1',[id]))[0].asset_gone_at,null);
      assert.equal(Number((await q(root,'SELECT count(*) n FROM upload_b2_draft.cleanup_jobs WHERE session_id=$1',[id]))[0].n),0);
    });
    assert.match((await root.query('SHOW server_version')).rows[0].server_version,/^17\./);
  } finally {
    for(const c of clients) { try { await c.end(); } catch { /* Already closed. */ } }
    if(started) exec('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
