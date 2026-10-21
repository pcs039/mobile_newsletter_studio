/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in isolated PostgreSQL, never a remote database. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const runtime = process.env.ARTICLE_PUBLICATION_SQL_RUNTIME;
const sqlFile = 'supabase/schema_v1_41_article_independent_publication_a1.sql';
const priorFiles = ['supabase/schema_v1_21_article_transactions.sql', 'supabase/schema_v1_38_article_order_atomic.sql',
  'supabase/schema_v1_29_client_review_workflow.sql', 'supabase/schema_v1_30_client_review_feedback.sql',
  'supabase/schema_v1_40_author_direct_publishing.sql'];

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function fixture(db) {
  const textColumns = 'title display_title summary body text_alignment title_alignment summary_alignment body_alignment article_type urgency publication_kind audio_source article_tts_voice contact_name contact_phone motion_preset motion_speed title_motion_effect title_motion_speed text_box_motion_effect text_box_motion_speed image_motion_effect image_motion_speed link_motion_effect link_motion_speed status'.split(' ').map(c => `${c} text`).join(',');
  await db.query(`create schema auth;create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    create type project_status as enum('draft','in_review','published','private','archived');
    create type content_block_type as enum('paragraph','image','button_group');
    create type link_action_type as enum('url');create type link_display_style as enum('button');
    create table newsletter_projects(id uuid primary key,title text,slug text,assignee_name text,status project_status default 'draft',
      published_at timestamptz,deleted_at timestamptz,updated_at timestamptz default now(),project_type text default 'newsletter',
      ebook_source text,external_ebook_url text,primary_color text,title_font_asset_id uuid,body_font_asset_id uuid,
      password_hash text default 'fixture-secret-not-for-snapshot');
    create table newsletter_pages(id uuid primary key,project_id uuid);create table newsletter_surveys(id uuid primary key,project_id uuid);
    create table newsletter_assets(id uuid primary key,project_id uuid);
    create table newsletter_articles(id uuid primary key default gen_random_uuid(),project_id uuid references newsletter_projects(id) on delete cascade,
      page_id uuid,sort_order int not null default 0,${textColumns},interest_tags text[],institution_priority smallint,valid_from timestamptz,
      valid_until timestamptz,public_info jsonb,survey_id uuid,title_font_asset_id uuid,body_font_asset_id uuid,
      caption_font_asset_id uuid,button_font_asset_id uuid,updated_at timestamptz default now(),created_at timestamptz default now());
    create table newsletter_link_actions(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid references newsletter_articles(id) on delete cascade,
      label text,action_type link_action_type,target_value text,display_style link_display_style,sort_order int,is_visible boolean);
    create table newsletter_content_blocks(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid references newsletter_articles(id) on delete cascade,
      block_type content_block_type,title text,body text,text_alignment text,asset_id uuid,link_action_id uuid,sort_order int,metadata jsonb,is_visible boolean);
    create table newsletter_article_compositions(id uuid primary key default gen_random_uuid(),project_id uuid references newsletter_projects(id) on delete cascade,
      article_id uuid unique references newsletter_articles(id) on delete cascade,status text default 'draft',settings jsonb default '{}',updated_at timestamptz default now());
    create table newsletter_article_composition_assets(id uuid primary key default gen_random_uuid(),composition_id uuid references newsletter_article_compositions(id) on delete cascade,
      asset_id uuid,slot text,settings jsonb default '{}');
    create table newsletter_project_design_kits(id uuid primary key default gen_random_uuid(),project_id uuid,style_tokens jsonb default '{}');
    create function set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
    select set_config('request.jwt.claim.role','service_role',false);`);
  for (const f of priorFiles) await db.query(fs.readFileSync(f, 'utf8'));
}

test('A1 actual PostgreSQL: isolated state, ownership, immutable receipts and multi-session races', { skip: !runtime, timeout: 120000 }, async t => {
  // Runtime path only, never DATABASE_URL/Supabase keys. Starts its own loopback
  // server with an ephemeral password; no connection to an existing server.
  assert(path.isAbsolute(runtime), 'runtime must be an explicit absolute local dependency path');
  const { default: EmbeddedPostgres } = await import(pathToFileURL(path.join(runtime, 'embedded-postgres/dist/index.js')).href);
  const { Client } = require(path.join(runtime, 'pg'));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mns-a1-'));
  const port = await freePort(), password = randomBytes(24).toString('hex');
  const server = new EmbeddedPostgres({ databaseDir: path.join(directory, 'db'), port, user: 'postgres', password,
    persistent: false, postgresFlags: ['-h', '127.0.0.1', '-k', directory], onLog() {}, onError() {} });
  const clients = [];
  const connect = async (database, enable = true) => {
    const c = new Client({ host: '127.0.0.1', port, user: 'postgres', password, database });
    await c.connect(); clients.push(c);
    await c.query("set statement_timeout='8s';set lock_timeout='5s';set timezone='UTC';set request.jwt.claim.role='service_role'");
    if (enable) await c.query("set newsletter.a1_isolated_test='on'");
    return c;
  };
  try {
    await server.initialise(); await server.start();
    const root = await connect('postgres');
    await root.query('create role anon;create role authenticated;create role service_role bypassrls');
    const database = `mns_a1_${randomBytes(6).toString('hex')}`;
    await root.query(`create database ${database}`);
    const db = await connect(database), second = await connect(database), observer = await connect(database);
    await fixture(db);
    const priorFunctions = async () => (await db.query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname not like 'article_publication_%' and p.proname not in ('prepare_article_publication','finalize_article_publication_preparation','transition_article_publication_atomic') order by 1")).rows;
    const before = await priorFunctions();
    await db.query(fs.readFileSync(sqlFile, 'utf8'));
    const project = randomUUID(), foreignProject = randomUUID();
    await db.query("insert into newsletter_projects(id,title,slug,assignee_name) values($1,'격리 시험','a1','writer'),($2,'다른 프로젝트','other','other')", [project, foreignProject]);
    const article = async (p = project) => {
      const id = randomUUID();
      await db.query("insert into newsletter_articles(id,project_id,title,body,status,publication_kind,sort_order) values($1,$2,'기사 제목','원문 본문','draft','regular',30)", [id,p]);
      await db.query("insert into newsletter_content_blocks(article_id,project_id,block_type,body,sort_order,metadata,is_visible) values($1,$2,'paragraph','첫 문단',10,'{}',true)", [id,p]);
      return id;
    };
    const prepare = async (id, intent = 'publish', historical = null, c = db, overrides = {}) => {
      const args = { project, article: id, actor: 'writer', name: 'writer', role: 'user', assignee: 'writer', intent, key: randomUUID(), historical, ...overrides };
      return (await c.query('select prepare_article_publication($1,$2,$3,$4,$5,$6,$7,$8,$9) r', Object.values(args))).rows[0].r;
    };
    const finalize = async (id, prep, c = db) => (await c.query("select finalize_article_publication_preparation($1,$2,'writer','writer','user','writer',$3) r", [project,id,prep.preparationId])).rows[0].r;
    const ready = async (id, intent = 'publish', historical = null) => {
      const p = await prepare(id,intent,historical); const f = await finalize(id,p); return { ...p,...f };
    };
    const request = (id, prep, action = 'publish', changes = {}) => ({ project, article: id, actor: 'writer', name: 'writer', role: 'user', assignee: 'writer',
      key: randomUUID(), action, version: prep?.expectedStateVersion ?? 0, preparation: prep?.preparationId ?? null,
      hash: prep?.sourceHash ?? null, confirmed: true, ...changes });
    const transition = async (args, c = db) => (await c.query('select transition_article_publication_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) r', Object.values(args))).rows[0].r;
    const state = async id => (await db.query('select * from newsletter_article_publications where article_id=$1',[id])).rows[0];
    const count = async id => (await db.query('select count(*)::int n from newsletter_article_publication_events where article_id=$1',[id])).rows[0].n;
    const conflict = message => e => e.code === 'PT409' && e.message === message;
    // Real barrier: hold the same parent row, wait until each concurrent session
    // reports a PostgreSQL Lock wait, then release. No sleep-only race assertions.
    const race = async (first, next) => {
      await observer.query('begin'); await observer.query('select id from newsletter_projects where id=$1 for update',[project]);
      const pid1 = db.processID, pid2 = second.processID;
      const a = first(db).then(value => ({status:'fulfilled',value}), reason => ({status:'rejected',reason}));
      const b = next(second).then(value => ({status:'fulfilled',value}), reason => ({status:'rejected',reason}));
      try {
        const deadline = Date.now()+4000; let waiting = false;
        while (Date.now()<deadline) {
          const rows = (await observer.query("select pid,wait_event_type from pg_stat_activity where pid=any($1::int[])",[[pid1,pid2]])).rows;
          if (rows.length===2 && rows.every(r=>r.wait_event_type==='Lock')) { waiting=true; break; }
          await new Promise(resolve=>setTimeout(resolve,10));
        }
        assert(waiting,'both PostgreSQL sessions must reach observed lock barrier');
      } finally { await observer.query('commit'); }
      return Promise.all([a,b]);
    };

    await t.test('default disabled; installation rejects non-isolated DB before DDL', async () => {
      await assert.rejects(root.query(fs.readFileSync(sqlFile,'utf8')), e=>e.code==='42501'); await root.query('rollback');
      const c=await connect(database,false),id=await article();
      await assert.rejects(prepare(id,'publish',null,c),/article_publication_disabled/);
      assert.equal(await state(id),undefined);
    });
    await t.test('all five tables RLS; anon/authenticated denied and service has read/RPC only', async () => {
      const rows=(await db.query("select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'select,insert,update,delete') anon,has_table_privilege('authenticated',c.oid,'select,insert,update,delete') authenticated,has_table_privilege('service_role',c.oid,'select') service,has_table_privilege('service_role',c.oid,'insert,update,delete') write from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'newsletter_article_publication%'")).rows;
      assert.equal(rows.length,5); for(const r of rows){assert(r.relrowsecurity);assert(!r.anon&&!r.authenticated&&r.service&&!r.write);}
      const deniedArticle=await article();
      for(const role of ['anon','authenticated']) {
        await db.query(`set role ${role}`);
        try {
          await assert.rejects(db.query('select * from newsletter_article_publications'),e=>e.code==='42501');
          await assert.rejects(prepare(deniedArticle),e=>e.code==='42501');
        } finally { await db.query('reset role'); }
      }
      await db.query('set role service_role');
      await assert.rejects(db.query("update newsletter_article_publications set status='withdrawn'"),e=>e.code==='42501');
      await db.query('reset role');
      const functions=(await db.query("select proname,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,has_function_privilege('service_role',oid,'execute') service from pg_proc where proname like 'article_publication_%' or proname in ('prepare_article_publication','finalize_article_publication_preparation','transition_article_publication_atomic')")).rows;
      for(const f of functions){assert(!f.anon&&!f.authenticated);assert.equal(f.service,['prepare_article_publication','finalize_article_publication_preparation','transition_article_publication_atomic'].includes(f.proname));}
    });
    await t.test('service JWT assertion, current assignee and same-project ownership enforced', async () => {
      const id=await article(),other=await article(foreignProject);
      await assert.rejects(prepare(other),e=>e.code==='PT404');
      await assert.rejects(prepare(id,'publish',null,db,{actor:'other',name:'other'}),e=>e.code==='42501');
      await assert.rejects(prepare(id,'publish',null,db,{assignee:'old'}),conflict('article_publication_assignee_conflict'));
      await db.query("set request.jwt.claim.role='authenticated'");await assert.rejects(prepare(id),e=>e.code==='42501');
      await db.query("set request.jwt.claim.role='service_role'");
      await assert.rejects(db.query('insert into newsletter_article_publications(article_id,project_id) values($1,$2)',[id,foreignProject]),e=>e.code==='23514');
    });
    let id,published,initial,originalRequest;
    await t.test('prepare/finalize idempotent; new revision text immutable and secrets excluded', async () => {
      id=await article(); const key=randomUUID(); initial=await prepare(id,'publish',null,db,{key});
      assert.equal((await prepare(id,'publish',null,db,{key})).duplicate,true);
      await assert.rejects(prepare(id,'replace',null,db,{key}),conflict('article_publication_key_conflict'));
      const f=await finalize(id,initial);assert.equal((await finalize(id,initial)).duplicate,true);initial={...initial,...f};
      const r=(await db.query('select * from newsletter_article_publication_revisions where id=$1',[f.revisionId])).rows[0];
      assert(!JSON.stringify(r.snapshot).includes('fixture-secret'));assert.equal(r.snapshot.article.body,'원문 본문');assert.equal(r.expected_media_manifest.length,0);
      const text=(await db.query('select snapshot::text s from newsletter_article_publication_revisions where id=$1',[f.revisionId])).rows[0].s;
      assert.equal(createHash('sha256').update(text).digest('hex'),r.payload_hash);
      await assert.rejects(db.query("update newsletter_article_publication_revisions set snapshot='{}' where id=$1",[f.revisionId]),e=>e.code==='23514');
    });
    await t.test('publish only selected article; project state and source digest unchanged', async () => {
      const source=(await db.query('select to_jsonb(a) a from newsletter_articles a order by id')).rows;
      originalRequest=request(id,initial);published=await transition(originalRequest);
      assert.equal(published.status,'published');assert.equal(published.stateVersion,1);assert.equal(await count(id),1);
      assert.equal((await db.query('select status from newsletter_projects where id=$1',[project])).rows[0].status,'draft');
      assert.deepEqual((await db.query('select to_jsonb(a) a from newsletter_articles a order by id')).rows,source);
    });
    await t.test('response loss recovers same receipt; changed key payload rejected', async () => {
      const r=await transition(originalRequest);assert(r.duplicate);assert.equal(r.executedAt,published.executedAt);assert.equal(await count(id),1);
      await assert.rejects(transition({...originalRequest,version:99}),conflict('article_publication_key_conflict'));
      await assert.rejects(db.query('delete from newsletter_article_publication_events where article_id=$1',[id]),e=>e.code==='23514');
    });
    await t.test('draft edit preserves old snapshot; stale candidate conflicts; replace swaps once', async () => {
      const stale=await ready(id,'replace');
      await db.query("update newsletter_articles set body='새 편집 초안' where id=$1",[id]);
      assert.equal((await db.query('select snapshot from newsletter_article_publication_revisions where id=$1',[initial.revisionId])).rows[0].snapshot.article.body,'원문 본문');
      await assert.rejects(transition(request(id,stale,'replace')),conflict('article_publication_source_stale'));
      const fresh=await ready(id,'replace');await transition(request(id,fresh,'replace'));
      assert.equal((await state(id)).active_revision_id,fresh.revisionId);assert.equal(await count(id),2);
    });
    await t.test('same render payload replace no-op; source timestamp change remains detectable', async () => {
      await db.query('update newsletter_articles set updated_at=now() where id=$1',[id]);
      const prep=await ready(id,'replace');const r=await transition(request(id,prep,'replace'));assert(r.unchanged);
      assert.equal(await count(id),2);assert.equal((await state(id)).state_version,'2');
      await db.query("update newsletter_articles set updated_at=now()+interval '1 second' where id=$1",[id]);
      await assert.rejects(transition(request(id,prep,'replace')),conflict('article_publication_source_stale'));
    });
    await t.test('withdraw preserves last revision; historical republish explicitly selects old public version', async () => {
      await transition(request(id,null,'withdraw',{version:2}));assert.equal((await state(id)).active_revision_id,null);
      const old=await transition(originalRequest);assert.equal(old.status,'published');assert.equal(old.currentStatus,'withdrawn');assert.equal(old.currentVersion,3);
      const prep=await ready(id,'republish',initial.revisionId);await transition(request(id,prep,'republish'));
      assert.equal((await state(id)).active_revision_id,initial.revisionId);assert.equal(await count(id),4);
      await assert.rejects(transition(request(id,null,'withdraw',{version:1})),conflict('article_publication_stale'));
    });
    await t.test('historical selection rejects another article and never-published candidate', async () => {
      const target=await article(),candidate=await ready(target);
      await transition(request(id,null,'withdraw',{version:4}));
      await assert.rejects(prepare(id,'republish',candidate.revisionId),conflict('article_publication_revision_not_published'));
      const prep=await ready(id,'republish');await transition(request(id,prep,'republish'));assert.equal(await count(id),6);
    });
    await t.test('new source owner move blocked, including article with no Composition', async () => {
      await assert.rejects(db.query('update newsletter_articles set project_id=$2 where id=$1',[id,foreignProject]),conflict('article_publication_project_move_protected'));
      const other=await article(foreignProject);
      const p=await prepare(other,'publish',null,db,{project:foreignProject,actor:'other',name:'other',assignee:'other'});
      const r=(await db.query("select finalize_article_publication_preparation($1,$2,'other','other','user','other',$3) r",[foreignProject,other,p.preparationId])).rows[0].r;
      await assert.rejects(db.query('update newsletter_article_publications set active_revision_id=$2 where article_id=$1',[id,r.revisionId]),e=>e.code==='23503');
    });
    await t.test('archived/soft-delete block new publish; authorized withdraw remains available', async () => {
      await db.query("update newsletter_projects set status='archived' where id=$1",[project]);
      await assert.rejects(prepare(id,'replace'),conflict('article_publication_inactive'));
      await transition(request(id,null,'withdraw',{version:6}));
      await db.query("update newsletter_projects set status='draft',deleted_at=now() where id=$1",[project]);
      await assert.rejects(prepare(id,'republish'),conflict('article_publication_inactive'));
      await db.query('update newsletter_projects set deleted_at=null where id=$1',[project]);
    });
    await t.test('lost authority prevents old receipt retrieval', async () => {
      await db.query("update newsletter_projects set assignee_name='other' where id=$1",[project]);
      await assert.rejects(transition({...originalRequest,assignee:'other'}),e=>e.code==='42501');
      await db.query("update newsletter_projects set assignee_name='writer' where id=$1",[project]);
    });
    await t.test('media/font/HTML/CTA/Composition cannot be finalized or claimed verified', async () => {
      const modifications=["title_font_asset_id=gen_random_uuid()","audio_source='ai'","body='<img src=\"https://example.invalid/x\">'","public_info='{\"mapUrl\":\"https://example.invalid\"}'"];
      for(const modification of modifications){const a=await article();await db.query(`update newsletter_articles set ${modification} where id=$1`,[a]);const p=await prepare(a);assert(p.blockers.length,modification);await assert.rejects(finalize(a,p),conflict('article_publication_media_not_ready'));assert.equal(await count(a),0);}
      const a=await article();await db.query("insert into newsletter_article_compositions(project_id,article_id) values($1,$2)",[project,a]);
      const p=await prepare(a);await assert.rejects(finalize(a,p),conflict('article_publication_media_not_ready'));
      await assert.rejects(db.query("insert into newsletter_article_publication_media(article_id,project_id,preparation_id,role,source_descriptor,status) values($1,$2,$3,'image','{}','verified')",[a,project,p.preparationId]),e=>e.code==='23514');
    });
    await t.test('child-only Composition and block mutations invalidate source without article.updated_at change', async () => {
      const a=await article(),p=await ready(a),date=(await db.query('select updated_at from newsletter_articles where id=$1',[a])).rows[0].updated_at;
      await db.query("insert into newsletter_article_compositions(project_id,article_id,settings) values($1,$2,'{\"changed\":true}')",[project,a]);
      assert.deepEqual((await db.query('select updated_at from newsletter_articles where id=$1',[a])).rows[0].updated_at,date);
      await assert.rejects(transition(request(a,p)),conflict('article_publication_source_stale'));
      const b=await article(),q=await ready(b);await db.query("update newsletter_content_blocks set body='문단 수정' where article_id=$1",[b]);
      await assert.rejects(transition(request(b,q)),conflict('article_publication_source_stale'));
    });
    await t.test('event insertion failure rolls back pointer, preparation and event together', async () => {
      const a=await article(),p=await ready(a),req=request(a,p);
      await db.query("create function fixture_event_failure() returns trigger language plpgsql as $$begin raise exception 'fixture_event_failure';end$$;create trigger fixture_failure before insert on newsletter_article_publication_events for each row execute function fixture_event_failure()");
      await assert.rejects(transition(req),/fixture_event_failure/);assert.equal((await state(a)).state_version,'0');assert.equal(await count(a),0);
      assert.equal((await db.query('select status from newsletter_article_publication_preparations where id=$1',[p.preparationId])).rows[0].status,'ready');
      await db.query('drop trigger fixture_failure on newsletter_article_publication_events;drop function fixture_event_failure()');await transition(req);assert.equal(await count(a),1);
    });
    await t.test('same-key concurrent publish yields one event and one duplicate', async () => {
      const a=await article(),p=await ready(a),req=request(a,p);
      const results=await race(c=>transition(req,c),c=>transition(req,c));assert(results.every(r=>r.status==='fulfilled'));
      assert.equal(results.filter(r=>r.value.duplicate).length,1);assert.equal(await count(a),1);
    });
    await t.test('different-key same-version publish has one winner and PT409 loser', async () => {
      const a=await article(),p=await ready(a),req=request(a,p);
      const results=await race(c=>transition(req,c),c=>transition({...req,key:randomUUID()},c));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'PT409');assert.equal(await count(a),1);
    });
    await t.test('replace versus withdraw is atomic at same state version', async () => {
      const a=await article(),first=await ready(a);await transition(request(a,first));await db.query("update newsletter_articles set body='변경 공개 후보' where id=$1",[a]);
      const p=await ready(a,'replace');const results=await race(c=>transition(request(a,p,'replace'),c),c=>transition(request(a,null,'withdraw',{version:1}),c));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'PT409');assert.equal(await count(a),2);
      const s=await state(a);assert.equal(s.status==='published',s.active_revision_id!==null);
    });
    await t.test('concurrent withdraw has one event and one conflict', async () => {
      const a=await article(),p=await ready(a);await transition(request(a,p));
      const results=await race(c=>transition(request(a,null,'withdraw',{version:1}),c),c=>transition(request(a,null,'withdraw',{version:1}),c));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'PT409');assert.equal(await count(a),2);
    });
    await t.test('original delete RPC allows untouched/prepared articles, retains orphan revision', async () => {
      for(const prepared of [false,true]){const a=await article();const p=prepared?await ready(a):null;
        let ledger;
        if(p)ledger=(await db.query("insert into newsletter_article_publication_media(article_id,project_id,preparation_id,role,source_descriptor) values($1,$2,$3,'test-only-pending','{}') returning id",[a,project,p.preparationId])).rows[0].id;
        const r=(await db.query('select delete_newsletter_article_atomic($1,$2) r',[project,a])).rows[0].r;assert(r.ok);assert.equal(await state(a),undefined);
        assert.equal((await db.query('select count(*)::int n from newsletter_article_publication_preparations where article_id=$1',[a])).rows[0].n,0);
        if(p){assert.equal((await db.query('select count(*)::int n from newsletter_article_publication_revisions where id=$1',[p.revisionId])).rows[0].n,1);
          const m=(await db.query('select * from newsletter_article_publication_media where id=$1',[ledger])).rows[0];assert.equal(m.preparation_id,null);assert.equal(m.status,'pending');assert.equal(m.article_id,a);}
      }
    });
    await t.test('published/withdrawn history protects article and project hard delete', async () => {
      await assert.rejects(db.query('select delete_newsletter_article_atomic($1,$2)',[project,id]),conflict('article_publication_history_protected'));
      await assert.rejects(db.query('delete from newsletter_projects where id=$1',[project]));assert.equal(await count(id),7);
    });
    await t.test('first publish versus old delete RPC: one winner, no orphan public pointer', async () => {
      const a=await article(),p=await ready(a),req=request(a,p);
      const results=await race(c=>transition(req,c),c=>c.query('select delete_newsletter_article_atomic($1,$2)',[project,a]));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      const exists=(await db.query('select count(*)::int n from newsletter_articles where id=$1',[a])).rows[0].n;
      assert.equal(await count(a),exists);assert.equal(Boolean(await state(a)),Boolean(exists));
    });
    const waitForLock = async pid => {
      const deadline=Date.now()+4000;
      while(Date.now()<deadline){const r=(await observer.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];
        if(r?.wait_event_type==='Lock')return;await new Promise(resolve=>setTimeout(resolve,10));}
      assert.fail('competing session did not reach observed PostgreSQL lock');
    };
    await t.test('delete-first barrier: publication fails after source deletion commits', async () => {
      const a=await article(),p=await ready(a);await second.query('begin');
      await second.query('select delete_newsletter_article_atomic($1,$2)',[project,a]);
      const result=transition(request(a,p),db).then(value=>({value}),error=>({error}));
      try{await waitForLock(db.processID);}finally{await second.query('commit');}
      assert.equal((await result).error.code,'PT404');assert.equal(await count(a),0);assert.equal(await state(a),undefined);
    });
    await t.test('publish-first barrier: old delete RPC fails and all publication history remains', async () => {
      const a=await article(),p=await ready(a);await db.query('begin');await transition(request(a,p));
      const result=second.query('select delete_newsletter_article_atomic($1,$2)',[project,a]).then(value=>({value}),error=>({error}));
      try{await waitForLock(second.processID);}finally{await db.query('commit');}
      assert.equal((await result).error.code,'PT409');assert.equal(await count(a),1);assert.equal((await state(a)).status,'published');
    });
    await t.test('single source capture sees pre-commit or post-commit related rows, never mixed', async () => {
      const a=await article();await second.query('begin');
      await second.query("update newsletter_articles set body='after' where id=$1",[a]);await second.query("update newsletter_content_blocks set body='after' where article_id=$1",[a]);
      const before=(await db.query('select article_publication_capture($1,$2) r',[project,a])).rows[0].r.snapshot;
      assert.equal(before.article.body,'원문 본문');assert.equal(before.blocks[0].body,'첫 문단');await second.query('commit');
      const after=(await db.query('select article_publication_capture($1,$2) r',[project,a])).rows[0].r.snapshot;assert.equal(after.article.body,'after');assert.equal(after.blocks[0].body,'after');
    });
    await t.test('actual service_role can prepare/finalize/transition but cannot invoke private helpers', async () => {
      const a=await article();await db.query('set role service_role');
      try {
        const p=await ready(a);const r=await transition(request(a,p));assert.equal(r.status,'published');
        await assert.rejects(db.query('select article_publication_capture($1,$2)',[project,a]),e=>e.code==='42501');
      } finally { await db.query('reset role'); }
    });
    await t.test('pending preparations also permit original article deletion', async () => {
      const a=await article();await db.query("update newsletter_articles set audio_source='ai' where id=$1",[a]);
      const p=await prepare(a);assert.equal(p.status,'pending');
      const r=(await db.query('select delete_newsletter_article_atomic($1,$2) r',[project,a])).rows[0].r;assert(r.ok);
      await assert.rejects(finalize(a,p),e=>e.code==='PT404');
    });
    await t.test('preparation expiry and stale state fail without publication writes', async () => {
      const a=await article(),p=await ready(a);
      await db.query("update newsletter_article_publication_preparations set expires_at=now()-interval '1 second' where id=$1",[p.preparationId]);
      await assert.rejects(transition(request(a,p)),conflict('article_publication_preparation_conflict'));assert.equal(await count(a),0);
      const first=await ready(a),secondPrep=await ready(a);await transition(request(a,first));
      await assert.rejects(finalize(a,secondPrep),conflict('article_publication_stale'));
    });
    await t.test('same preparation key concurrently resumes one candidate', async () => {
      const a=await article(),key=randomUUID();
      const results=await race(c=>prepare(a,'publish',null,c,{key}),c=>prepare(a,'publish',null,c,{key}));
      assert(results.every(r=>r.status==='fulfilled'));assert.equal(results.filter(r=>r.value.duplicate).length,1);
      assert.equal(results[0].value.preparationId,results[1].value.preparationId);
    });
    await t.test('explicit confirmation and valid action/version are required', async () => {
      const a=await article(),p=await ready(a),req=request(a,p);
      for(const change of [{confirmed:false},{action:null},{action:'unpublish'},{version:null},{version:-1},{preparation:null}])
        await assert.rejects(transition({...req,...change}),e=>e.code==='22023');
      assert.equal(await count(a),0);
    });
    await t.test('project defaults changed after prepare invalidate candidate', async () => {
      const a=await article(),p=await ready(a);
      await db.query("update newsletter_projects set primary_color='#005500' where id=$1",[project]);
      await assert.rejects(transition(request(a,p)),conflict('article_publication_source_stale'));
      await db.query('update newsletter_projects set primary_color=null where id=$1',[project]);
    });
    await t.test('source canonicalization is stable across caller timezones', async () => {
      const a=await article();const first=(await db.query('select article_publication_capture($1,$2) r',[project,a])).rows[0].r;
      await second.query("set timezone='Asia/Seoul'");
      try{const other=(await second.query('select article_publication_capture($1,$2) r',[project,a])).rows[0].r;assert.deepEqual(other,first);}
      finally{await second.query("set timezone='UTC'");}
    });
    await t.test('pending media ledger blocks finalize/commit; service cannot mark verified, pin or GC', async () => {
      const a=await article(),p=await ready(a);
      const ledger=(await db.query("insert into newsletter_article_publication_media(article_id,project_id,preparation_id,role,source_descriptor) values($1,$2,$3,'isolated-pending','{}') returning id",[a,project,p.preparationId])).rows[0].id;
      await assert.rejects(finalize(a,p),conflict('article_publication_media_not_ready'));
      await assert.rejects(transition(request(a,p)),conflict('article_publication_media_not_ready'));assert.equal(await count(a),0);
      await db.query('set role service_role');
      try{await assert.rejects(db.query("update newsletter_article_publication_media set status='verified' where id=$1",[ledger]),e=>e.code==='42501');
        await assert.rejects(db.query('delete from newsletter_article_publication_media where id=$1',[ledger]),e=>e.code==='42501');}
      finally{await db.query('reset role');}
    });
    await t.test('empty title, unsupported public info and project design kit are fail-closed', async () => {
      for(const change of ["title=''","public_info='[]'","survey_id=gen_random_uuid()"]){const a=await article();
        await db.query(`update newsletter_articles set ${change} where id=$1`,[a]);const p=await prepare(a);
        await assert.rejects(finalize(a,p),conflict('article_publication_media_not_ready'));}
      const a=await article(),before=await ready(a);
      const kit=(await db.query("insert into newsletter_project_design_kits(project_id,style_tokens) values($1,'{\"background\":true}') returning id",[project])).rows[0].id;
      await assert.rejects(transition(request(a,before)),conflict('article_publication_source_stale'));
      const p=await prepare(a);await assert.rejects(finalize(a,p),conflict('article_publication_media_not_ready'));
      await db.query('delete from newsletter_project_design_kits where id=$1',[kit]);
    });
    await t.test('existing v1.38 save keeps order and published snapshot; new article appends', async () => {
      const a=await article();const p=await ready(a);await transition(request(a,p));
      const order=(await db.query('select sort_order from newsletter_articles where id=$1',[a])).rows[0].sort_order;
      const input={title:'저장 회귀',body:'편집만 변경',sort_order:999,interest_tags:[],public_info:{},status:'draft'};
      await db.query('select save_newsletter_article_atomic($1,$2,$3,$4)',[project,a,input,'[]']);
      assert.equal((await db.query('select sort_order from newsletter_articles where id=$1',[a])).rows[0].sort_order,order);
      assert.equal((await db.query('select snapshot from newsletter_article_publication_revisions where id=$1',[p.revisionId])).rows[0].snapshot.article.body,'원문 본문');
      const max=(await db.query('select max(sort_order) n from newsletter_articles where project_id=$1',[project])).rows[0].n;
      const r=(await db.query('select save_newsletter_article_atomic($1,null,$2,$3) r',[project,input,'[]'])).rows[0].r;
      assert.equal((await db.query('select sort_order from newsletter_articles where id=$1',[r.article.id])).rows[0].sort_order,max+10);
    });
    await t.test('existing issue publish/review RPCs and ACL byte-identical after A1', async () => {
      assert.deepEqual(await priorFunctions(),before);
      const revision=(await db.query('select project_publication_state($1) s',[project])).rows[0].s.revision;
      await db.query("select transition_project_publication_atomic($1,'writer','writer','user','writer',$2,'publish','author_direct',$3,true,null)",[project,randomUUID(),revision]);
      assert.equal((await db.query('select status from newsletter_projects where id=$1',[project])).rows[0].status,'published');
      await db.query("insert into newsletter_project_client_reviews(project_id,token_hash,expires_at) values($1,$2,now()+interval '1 day')",[project,'a'.repeat(64)]);
      await db.query("select respond_client_review_atomic($1,'changes_requested','검수 회귀')",['a'.repeat(64)]);
      assert.equal((await db.query('select status from newsletter_projects where id=$1',[project])).rows[0].status,'published');
    });
  } finally {
    await Promise.all(clients.map(async c=>{try{await c.query('rollback');await c.end();}catch{}}));
    await server.stop();
    // Only the locally-created temporary cluster; never Storage or repo data.
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
