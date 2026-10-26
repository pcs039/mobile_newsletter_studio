/* eslint-disable @typescript-eslint/no-require-imports -- Fresh Unix-socket-only PostgreSQL, no remote URL or app secrets. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const bin=process.env.ARTICLE_TTS_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const runtime=process.env.ARTICLE_TTS_PG_RUNTIME;
test('article TTS real PostgreSQL atomicity and multiple connections',{skip:!runtime||!fs.existsSync(path.join(bin,'initdb')),timeout:90000},async t=>{
 const {Client}=require(runtime),dir=fs.mkdtempSync(path.join(os.tmpdir(),'mns-article-tts-')),data=path.join(dir,'db'),socket=path.join(dir,'socket');fs.mkdirSync(socket);
 const exec=(name,args)=>execFileSync(path.join(bin,name),args,{stdio:'pipe',timeout:20000});let started=false;const clients=[];
 const connect=async()=>{const c=new Client({host:socket,port:54888,database:'postgres',user:'fixture_root'});await c.connect();clients.push(c);await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;};
 const p='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',old='44444444-4444-4444-8444-444444444444';
 const key=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
 let root,x,y;
 const scalar=async(c,q,args=[])=> (await c.query(q,args)).rows[0];
 const claim=(c,id=key(1),previous=null,force=false,voice='marin',name='writer',role='user')=>scalar(c,'SELECT public.article_tts_claim($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r',[p,a,id,previous,force,voice,'gpt-4o-mini-tts','writer-id',name,role]).then(r=>r.r);
 const segments=id=>[{path:`ai-tts-v2/${p}/${a}/${id}/000.mp3`,hash:'a'.repeat(64),size:1668,duration:1}];
 const complete=(c,id,fp,parts=segments(id))=>scalar(c,'SELECT public.article_tts_complete($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r',[p,a,id,fp,'marin','gpt-4o-mini-tts','b'.repeat(64),JSON.stringify(parts),'writer-id','writer','user']).then(r=>r.r);
 const finish=(c,id,state)=>scalar(c,'SELECT public.article_tts_finish($1,$2,$3,$4,$5,$6,$7) r',[p,a,id,state,'writer-id','writer','user']).then(r=>r.r);
 const seed=async()=>{await root.query('TRUNCATE public.newsletter_projects CASCADE');await root.query("INSERT INTO public.newsletter_projects VALUES($1,'writer','draft',NULL,'marin')",[p]);await root.query("INSERT INTO public.newsletter_audio_files(id,project_id,title,file_path) VALUES($1,$2,'old audio','keep-original.mp3')",[old,p]);await root.query("INSERT INTO public.newsletter_articles(id,project_id,title,body,summary,audio_source,article_tts_voice,ai_audio_id) VALUES($1,$2,'article','본문','요약','ai_tts','marin',$3)",[a,p,old]);await root.query("INSERT INTO public.newsletter_content_blocks VALUES('55555555-5555-4555-8555-555555555555',$1,'paragraph','','본문',10,true)",[a]);};
 const unchanged=async()=>assert.equal((await scalar(root,'SELECT ai_audio_id FROM public.newsletter_articles WHERE id=$1',[a])).ai_audio_id,old);
 const blocked=async(c)=>{for(let i=0;i<100;i++){if((await scalar(root,'SELECT cardinality(pg_blocking_pids($1)) n',[c.processID])).n)return;await new Promise(r=>setTimeout(r,10));}assert.fail('connection did not block');};
 const settle=p=>p.then(value=>({value}),error=>({error}));
 try{
  exec('initdb',['-D',data,'--username=fixture_root','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  exec('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-k ${socket} -p 54888 -c listen_addresses=''`,'-w','start']);started=true;
  root=await connect();await root.query(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role NOLOGIN BYPASSRLS;
   CREATE SCHEMA auth;CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_setting(''role'',true)';
   CREATE TABLE public.newsletter_projects(id uuid PRIMARY KEY,assignee_name text,status text,deleted_at timestamptz,article_tts_voice text);
   CREATE TABLE public.newsletter_articles(id uuid PRIMARY KEY,project_id uuid REFERENCES public.newsletter_projects ON DELETE CASCADE,title text,body text,summary text,audio_source text,article_tts_voice text,audio_id uuid,ai_audio_id uuid);
   CREATE TABLE public.newsletter_audio_files(id uuid PRIMARY KEY,project_id uuid REFERENCES public.newsletter_projects ON DELETE CASCADE,article_id uuid REFERENCES public.newsletter_articles ON DELETE SET NULL,title text NOT NULL,file_path text NOT NULL,duration_seconds int,script_status text DEFAULT 'pending',source_type text,transcript_type text,ai_tts_audio_paths jsonb,ai_tts_text_hash text,ai_tts_voice text,ai_tts_model text,ai_tts_generated_at timestamptz);
   ALTER TABLE public.newsletter_articles ADD FOREIGN KEY(ai_audio_id) REFERENCES public.newsletter_audio_files ON DELETE SET NULL;ALTER TABLE public.newsletter_articles ADD FOREIGN KEY(audio_id) REFERENCES public.newsletter_audio_files ON DELETE SET NULL;
   CREATE TABLE public.newsletter_content_blocks(id uuid PRIMARY KEY,article_id uuid REFERENCES public.newsletter_articles ON DELETE CASCADE,block_type text,title text,body text,sort_order int,is_visible boolean);`);
  const sql=fs.readFileSync('supabase/schema_v1_43_article_tts_safety.sql','utf8');
  await assert.rejects(root.query(sql),/explicit article TTS schema approval required/);await root.query('ROLLBACK');
  await root.query("SET app.article_tts_schema_target='explicitly-approved'");await root.query(sql);
  x=await connect();y=await connect();await x.query('SET ROLE service_role');await y.query('SET ROLE service_role');
  t.afterEach(async()=>{await x.query('ROLLBACK');await y.query('ROLLBACK');await root.query('ROLLBACK');});
  await t.test('adds exactly four article columns and three service-only RPCs',async()=>{
   const cols=(await root.query("SELECT column_name FROM information_schema.columns WHERE table_name='newsletter_articles' AND column_name LIKE 'tts_%'")).rows;assert.equal(cols.length,4);
   const funcs=(await root.query("SELECT prosecdef,proconfig FROM pg_proc WHERE proname IN ('article_tts_claim','article_tts_complete','article_tts_finish')")).rows;assert.equal(funcs.length,3);assert(funcs.every(f=>f.prosecdef&&f.proconfig.includes('search_path=pg_catalog')));
   await seed();for(const role of ['anon','authenticated']){await root.query(`SET ROLE ${role}`);await assert.rejects(claim(root),{code:'42501'});await root.query('RESET ROLE');}
  });
  await t.test('parallel identical keys have one winner; no audio reservation before verification',async()=>{
   await seed();await x.query('BEGIN');assert.equal((await claim(x)).won,true);const wait=settle(claim(y));await blocked(y);await x.query('COMMIT');assert.equal((await wait).value.won,false);
   assert.equal((await scalar(root,'SELECT count(*)::int n FROM public.newsletter_audio_files')).n,1);await unchanged();
  });
  await t.test('parallel different keys with stale predecessor cannot both win',async()=>{
   await seed();await x.query('BEGIN');await claim(x);const wait=settle(claim(y,key(2)));await blocked(y);await x.query('COMMIT');assert.equal((await wait).error.code,'PT409');await unchanged();
  });
  await t.test('same request ID across articles is rejected before a second dispatch',async()=>{
   await seed();await claim(x);
   const other='66666666-6666-4666-8666-666666666666';
   await root.query("INSERT INTO public.newsletter_articles(id,project_id,title,body,audio_source,article_tts_voice) VALUES($1,$2,'other','본문','ai_tts','marin')",[other,p]);
   await assert.rejects(y.query('SELECT public.article_tts_claim($1,$2,$3,null,false,$4,$5,$6,$7,$8)',[p,other,key(1),'marin','gpt-4o-mini-tts','writer-id','writer','user']),{code:'23505'});
   assert.equal((await scalar(root,'SELECT tts_request_id FROM public.newsletter_articles WHERE id=$1',[other])).tts_request_id,null);
  });
  await t.test('assignee identity normalization matches existing project access',async()=>{
   await seed();await root.query("UPDATE public.newsletter_projects SET assignee_name=' W R I T E R '");
   assert.equal((await claim(x)).won,true);
  });
  await t.test('complete creates one new audio and atomically links without changing text or old metadata',async()=>{
   await seed();const c=await claim(x);const r=await complete(x,key(1),c.fingerprint);assert.equal(r.state,'ready');assert.equal(r.audioId,key(1));assert.equal((await scalar(root,'SELECT count(*)::int n FROM public.newsletter_audio_files')).n,2);
   const arow=await scalar(root,'SELECT title,body,ai_audio_id FROM public.newsletter_articles');assert.equal(arow.title,'article');assert.equal(arow.body,'본문');assert.equal(arow.ai_audio_id,key(1));assert.equal((await scalar(root,'SELECT file_path FROM public.newsletter_audio_files WHERE id=$1',[old])).file_path,'keep-original.mp3');
   assert.equal((await complete(y,key(1),c.fingerprint)).state,'ready');assert.equal((await scalar(root,'SELECT count(*)::int n FROM public.newsletter_audio_files')).n,2);
  });
  await t.test('metadata insert failure rolls back link and leaves old audio usable',async()=>{
   await seed();const c=await claim(x);await root.query("CREATE FUNCTION public.fail_fixture_audio() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'mock DB rejection'; END $$;CREATE TRIGGER fail_fixture BEFORE INSERT ON public.newsletter_audio_files FOR EACH ROW EXECUTE FUNCTION public.fail_fixture_audio()");
   try{await assert.rejects(complete(x,key(1),c.fingerprint));await unchanged();assert.equal((await scalar(root,'SELECT tts_generation_state s FROM public.newsletter_articles')).s,'processing');}finally{await root.query('DROP TRIGGER fail_fixture ON public.newsletter_audio_files;DROP FUNCTION public.fail_fixture_audio()');}
  });
  await t.test('writer holding article lock changes blocks before completion; old link remains',async()=>{
   await seed();const c=await claim(x);await root.query('BEGIN');await root.query('SELECT id FROM public.newsletter_articles WHERE id=$1 FOR UPDATE',[a]);await root.query("UPDATE public.newsletter_content_blocks SET body='수정한 본문' WHERE article_id=$1",[a]);const wait=settle(complete(y,key(1),c.fingerprint));await blocked(y);await root.query('COMMIT');assert.equal((await wait).value.code,'source_changed');await unchanged();
  });
  await t.test('project inherited voice, article source and title changes invalidate a candidate',async()=>{
   for(const query of ["UPDATE public.newsletter_projects SET article_tts_voice='cedar'","UPDATE public.newsletter_articles SET audio_source='none'","UPDATE public.newsletter_articles SET title='다른 제목'"]){await seed();const c=await claim(x);await root.query(query);assert.equal((await complete(x,key(1),c.fingerprint)).code,'source_changed');await unchanged();}
  });
  await t.test('ownership, project mismatch and wrong voice reject before dispatch',async()=>{
   await seed();await assert.rejects(claim(x,key(1),null,false,'marin','other'),{code:'42501'});await assert.rejects(claim(x,key(1),null,false,'cedar'),{code:'PT409'});
   const c=await claim(x);await root.query("UPDATE public.newsletter_projects SET assignee_name='other'");await assert.rejects(complete(x,key(1),c.fingerprint),{code:'42501'});await unchanged();
  });
  await t.test('failed/unknown retry is explicit; old request replay and late completion are fenced',async()=>{
   await seed();const c=await claim(x);await finish(x,key(1),'unknown');assert.equal((await claim(y,key(2),key(1),false)).won,false);assert.equal((await claim(y,key(2),key(1),true)).won,true);await assert.rejects(complete(x,key(1),c.fingerprint),{code:'PT409'});await assert.rejects(claim(x,key(1)),{code:'PT409'});await unchanged();
  });
  await t.test('processing cannot be taken over before hard execution limit; explicit aged takeover fences old owner',async()=>{
   await seed();const c=await claim(x);assert.equal((await claim(y,key(2),key(1),true)).won,false);await root.query("UPDATE public.newsletter_articles SET tts_started_at=clock_timestamp()-interval '7 minutes'");assert.equal((await claim(y,key(2),key(1),true)).won,true);await assert.rejects(complete(x,key(1),c.fingerprint),{code:'PT409'});
  });
  await t.test('path mismatch and malformed proofs never create metadata or replace link',async()=>{
   await seed();const c=await claim(x);for(const parts of [[{...segments(key(1))[0],path:'other-project/file.mp3'}],[{...segments(key(1))[0],size:0}],[]])await assert.rejects(complete(x,key(1),c.fingerprint,parts),{code:'22023'});await unchanged();
  });
  await t.test('unused ordinary TTS metadata is retired only after successful new link',async()=>{
   await seed();const oldPath=`ai-tts/${p}/${a}/${'c'.repeat(64)}/000.mp3`;
   await root.query("UPDATE public.newsletter_audio_files SET source_type='ai_tts',file_path=$1,ai_tts_audio_paths=$2 WHERE id=$3",[oldPath,JSON.stringify([oldPath]),old]);
   const c=await claim(x),r=await complete(x,key(1),c.fingerprint);assert(r.cleanupPaths.includes(oldPath));
   assert.equal((await scalar(root,'SELECT count(*)::int n FROM public.newsletter_audio_files WHERE id=$1',[old])).n,0);
   assert.equal((await scalar(root,'SELECT ai_audio_id FROM public.newsletter_articles WHERE id=$1',[a])).ai_audio_id,key(1));
  });
  await t.test('another article or an unknown publication snapshot domain prevents retirement',async()=>{
   for(const mode of ['article','snapshot']) {
    await seed();const oldPath=`ai-tts/${p}/${a}/${'c'.repeat(64)}/000.mp3`;
    await root.query("UPDATE public.newsletter_audio_files SET source_type='ai_tts',file_path=$1,ai_tts_audio_paths=$2 WHERE id=$3",[oldPath,JSON.stringify([oldPath]),old]);
    if(mode==='article')await root.query("INSERT INTO public.newsletter_articles(id,project_id,title,audio_id) VALUES('22222222-2222-4222-8222-333333333333',$1,'other',$2)",[p,old]);
    else await root.query('CREATE TABLE public.fixture_publication_revisions(id int)');
    const c=await claim(x),r=await complete(x,key(1),c.fingerprint);assert.equal(r.state,'ready');assert.deepEqual(r.cleanupPaths,[]);
    assert.equal((await scalar(root,'SELECT count(*)::int n FROM public.newsletter_audio_files WHERE id=$1',[old])).n,1);
    if(mode==='snapshot')await root.query('DROP TABLE public.fixture_publication_revisions');
   }
  });
  await t.test('commit with discarded response remains queryable; finish cannot reset successful result',async()=>{
   await seed();const c=await claim(x);await complete(x,key(1),c.fingerprint);assert.equal((await claim(y)).state,'ready');assert.equal((await finish(x,key(1),'unknown')).state,'ready');assert.equal((await scalar(root,'SELECT ai_audio_id FROM public.newsletter_articles')).ai_audio_id,key(1));
  });
 } finally {for(const c of clients)await c.end().catch(()=>{});if(started)exec('pg_ctl',['-D',data,'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
