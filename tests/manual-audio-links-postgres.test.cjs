/* eslint-disable @typescript-eslint/no-require-imports -- Fresh socket-only PostgreSQL fixture; no remote credentials. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync,spawn}=require('node:child_process');
const bin=process.env.MANUAL_AUDIO_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const [p,p2,a,b,foreignArticle,old,f,ai]=[1,2,3,4,5,6,7,8].map(id);
const quote=v=>v===null?'NULL':`'${String(v).replaceAll("'","''")}'`;

test('manual audio real PostgreSQL transaction, CAS and replay',{skip:!fs.existsSync(path.join(bin,'initdb')),timeout:90000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mns-manual-audio-')),data=path.join(dir,'db'),socket=path.join(dir,'socket');fs.mkdirSync(socket);
 const exec=(name,args,input)=>execFileSync(path.join(bin,name),args,{input,encoding:'utf8',stdio:'pipe',timeout:15000});
 const args=['-X','-qAt','-v','ON_ERROR_STOP=1','-h',socket,'-p','54896','-U','fixture_root','-d','postgres'];
 const q=sql=>exec('psql',args,sql).trim();
 const asyncQ=sql=>new Promise((resolve,reject)=>{const c=spawn(path.join(bin,'psql'),args,{stdio:['pipe','pipe','pipe']});let out='',err='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);c.on('error',reject);c.on('close',code=>code?reject(new Error(err)):resolve(out.trim()));c.stdin.end(sql);});
 const rpc=(audio=f,article=null,revision=null,changes=null,project=p,actor='writer',role='user')=>`SELECT public.manage_newsletter_manual_audio_link(${[project,audio,article,revision,changes===null?null:JSON.stringify(changes),'writer-id',actor,role].map(quote).join(',')});`;
 const call=(...x)=>JSON.parse(q('SET ROLE service_role;'+rpc(...x)));
 const state=(audio=f)=>call(audio).state;
 const saved=()=>q(`SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.newsletter_articles x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.newsletter_audio_files x));`);
 const seed=()=>q(`TRUNCATE public.newsletter_projects CASCADE;
 INSERT INTO public.newsletter_projects VALUES('${p}','writer','private',null),('${p2}','other','private',null);
 INSERT INTO public.newsletter_articles(id,project_id,title,audio_source) VALUES('${a}','${p}','one','none'),('${b}','${p}','two','none'),('${foreignArticle}','${p2}','foreign','none');
 INSERT INTO public.newsletter_audio_files(id,project_id,title,file_path,script_text,pronunciation_note,script_status,transcript_type,source_type) VALUES
 ('${old}','${p}','old','old.mp3','old script','old note','approved','article_original','uploaded'),
 ('${f}','${p}','new','new.mp3','new script','new note','pending','custom_script','uploaded'),
 ('${ai}','${p}','AI','ai.mp3','AI script','AI note','approved','custom_script','ai_tts');`);
 const attach=()=>{seed();call(old,a,state(old).revision,{});};
 let started=false;
 try {
  exec('initdb',['-D',data,'--username=fixture_root','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  exec('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-k ${socket} -p 54896 -c listen_addresses=''`,'-w','start']);started=true;
  q(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth;CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_setting(''role'',true)';
 CREATE TABLE public.newsletter_projects(id uuid PRIMARY KEY,assignee_name text,status text,deleted_at timestamptz);
 CREATE TABLE public.newsletter_articles(id uuid PRIMARY KEY,project_id uuid REFERENCES public.newsletter_projects ON DELETE CASCADE,title text,audio_id uuid,audio_source text,ai_audio_id uuid,tts_generation_state text,updated_at timestamptz DEFAULT now());
 CREATE TABLE public.newsletter_audio_files(id uuid PRIMARY KEY,project_id uuid REFERENCES public.newsletter_projects ON DELETE CASCADE,article_id uuid REFERENCES public.newsletter_articles ON DELETE SET NULL,title text,file_path text,script_text text,pronunciation_note text,script_status text,transcript_type text,source_type text,updated_at timestamptz DEFAULT now());
 ALTER TABLE public.newsletter_articles ADD FOREIGN KEY(audio_id) REFERENCES public.newsletter_audio_files ON DELETE SET NULL;
 ALTER TABLE public.newsletter_articles ADD FOREIGN KEY(ai_audio_id) REFERENCES public.newsletter_audio_files ON DELETE SET NULL;
 CREATE FUNCTION public.fixture_touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
 CREATE TRIGGER touch_article BEFORE UPDATE ON public.newsletter_articles FOR EACH ROW EXECUTE FUNCTION public.fixture_touch();
 CREATE TRIGGER touch_audio BEFORE UPDATE ON public.newsletter_audio_files FOR EACH ROW EXECUTE FUNCTION public.fixture_touch();`);
  const sql=fs.readFileSync('supabase/schema_v1_46_manual_audio_links.sql','utf8');
  await t.test('explicit DDL guard; one service-only function, no new table/column',()=>{
   assert.throws(()=>q(sql),/explicit manual audio schema approval required/);
   const before=q("SELECT count(*) FROM information_schema.columns WHERE table_schema='public';");
   q('ALTER TABLE public.newsletter_articles DROP COLUMN tts_generation_state;');
   assert.throws(()=>q("SET app.manual_audio_schema_target='explicitly-approved';"+sql),/schema prerequisites missing/);
   q('ALTER TABLE public.newsletter_articles ADD COLUMN tts_generation_state text;');
   q("SET app.manual_audio_schema_target='explicitly-approved';"+sql);
   assert.equal(q("SELECT count(*) FROM information_schema.columns WHERE table_schema='public';"),before);
   assert.equal(q("SELECT count(*) FROM pg_tables WHERE schemaname='public';"),'3');
   assert.equal(q("SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog'] FROM pg_proc WHERE proname='manage_newsletter_manual_audio_link';"),'t');
   seed();for(const role of ['anon','authenticated'])assert.throws(()=>q(`SET ROLE ${role};`+rpc()),/permission denied/);
  });
  await t.test('GET state has no row mutation',()=>{seed();const before=saved();assert.match(state().revision,/^[a-f0-9]{32}$/);assert.equal(saved(),before);});
  await t.test('first link selects manual source and stores both directions atomically',()=>{
   seed();call(f,a,state().revision,{});assert.equal(state().articleId,a);
   assert.deepEqual(JSON.parse(q(`SELECT jsonb_build_array(audio_id,audio_source) FROM public.newsletter_articles WHERE id='${a}';`)),[f,'uploaded']);
  });
  await t.test('replace preserves old metadata/file and new transcript, then unlink selects none',()=>{
   attach();const oldBefore=q(`SELECT to_jsonb(x)-'article_id'-'updated_at' FROM public.newsletter_audio_files x WHERE id='${old}';`);
   call(f,a,state().revision,{});assert.equal(state(old).articleId,null);assert.equal(state().transcriptText,'new script');
   assert.equal(q(`SELECT to_jsonb(x)-'article_id'-'updated_at' FROM public.newsletter_audio_files x WHERE id='${old}';`),oldBefore);
   call(f,null,state().revision,{});assert.equal(state().articleId,null);assert.equal(q(`SELECT audio_source FROM public.newsletter_articles WHERE id='${a}';`),'none');
  });
  await t.test('moving a file clears only its previous manual edge',()=>{seed();call(f,a,state().revision,{});call(f,b,state().revision,{});assert.equal(q(`SELECT audio_source FROM public.newsletter_articles WHERE id='${a}';`),'none');assert.equal(state().articleId,b);});
  await t.test('explicit metadata update and omitted fields preserved',()=>{seed();call(f,null,state().revision,{transcriptText:'edited'});const s=state();assert.equal(s.transcriptText,'edited');assert.equal(s.transcriptReviewNote,'new note');assert.equal(s.transcriptType,'custom_script');});
  await t.test('failure after old detach rolls back every row',()=>{
   attach();const rev=state().revision,before=saved();
   q(`CREATE FUNCTION public.fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${f}' THEN RAISE EXCEPTION 'mock middle failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail BEFORE UPDATE ON public.newsletter_audio_files FOR EACH ROW EXECUTE FUNCTION public.fixture_fail();`);
   try{assert.throws(()=>call(f,a,rev,{transcriptText:'no commit'}),/mock middle failure/);assert.equal(saved(),before);}finally{q('DROP TRIGGER fail ON public.newsletter_audio_files;DROP FUNCTION public.fixture_fail();');}
  });
  await t.test('failure on final article link also rolls back transcript and old connection',()=>{
   attach();const rev=state().revision,before=saved();q(`CREATE FUNCTION public.fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.audio_id='${f}' THEN RAISE EXCEPTION 'mock final failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail BEFORE UPDATE ON public.newsletter_articles FOR EACH ROW EXECUTE FUNCTION public.fixture_fail();`);
   try{assert.throws(()=>call(f,a,rev,{}),/mock final failure/);assert.equal(saved(),before);}finally{q('DROP TRIGGER fail ON public.newsletter_articles;DROP FUNCTION public.fixture_fail();');}
  });
  await t.test('cross-project article/file and wrong assignee rejected without changes',()=>{
   seed();const rev=state().revision,before=saved();for(const args of [[f,foreignArticle,rev,{}],[f,a,rev,{},p2],[f,a,rev,{},p,'other']])assert.throws(()=>call(...args),/manual_audio_not_found|manual_audio_forbidden/);assert.equal(saved(),before);
  });
  await t.test('AI file and AI-selected article reject; AI fields remain unchanged',()=>{
   seed();q(`UPDATE public.newsletter_articles SET audio_source='ai_tts',ai_audio_id='${ai}',tts_generation_state='ready' WHERE id='${a}';`);
   const rev=state().revision,before=saved();assert.throws(()=>call(f,a,rev,{}),/manual_audio_ai_selected/);assert.throws(()=>call(ai,a,rev,{}),/manual_audio_invalid/);assert.equal(saved(),before);
  });
  await t.test('explicit prior source change allows manual link but retains AI metadata/id',()=>{
   seed();q(`UPDATE public.newsletter_articles SET audio_source='uploaded',ai_audio_id='${ai}',tts_generation_state='ready' WHERE id='${a}';`);
   call(f,a,state().revision,{});assert.deepEqual(JSON.parse(q(`SELECT jsonb_build_array(ai_audio_id,tts_generation_state) FROM public.newsletter_articles WHERE id='${a}';`)),[ai,'ready']);
  });
  await t.test('unlinking old manual reference never disables selected AI',()=>{
   seed();call(f,a,state().revision,{});q(`UPDATE public.newsletter_articles SET audio_source='ai_tts',ai_audio_id='${ai}' WHERE id='${a}';`);
   call(f,null,state().revision,{});assert.deepEqual(JSON.parse(q(`SELECT jsonb_build_array(audio_source,ai_audio_id,audio_id) FROM public.newsletter_articles WHERE id='${a}';`)),['ai_tts',ai,null]);
  });
  await t.test('stale connection or transcript revision conflicts; no arbitrary overwrite',()=>{
   seed();const rev=state().revision;call(old,a,state(old).revision,{});let before=saved();assert.throws(()=>call(f,a,rev,{}),/manual_audio_conflict/);assert.equal(saved(),before);
   const newer=state().revision;call(f,null,newer,{transcriptText:'someone else'});before=saved();assert.throws(()=>call(f,a,newer,{transcriptText:'stale'}),/manual_audio_conflict/);assert.equal(saved(),before);
  });
  await t.test('processing TTS and inconsistent legacy edges fail closed',()=>{
   seed();q(`UPDATE public.newsletter_articles SET tts_generation_state='processing' WHERE id='${a}';`);assert.throws(()=>call(f,a,state().revision,{}),/manual_audio_conflict/);
   seed();q(`UPDATE public.newsletter_audio_files SET article_id='${a}';`);assert.throws(()=>state(),/manual_audio_conflict/);
  });
  await t.test('response loss replay is no-op; later change cannot be reversed by old retry',()=>{
   seed();const rev=state().revision;call(f,a,rev,{transcriptText:'saved'});const before=saved();assert.equal(call(f,a,rev,{transcriptText:'saved'}).duplicate,true);assert.equal(saved(),before);
   call(f,b,state().revision,{transcriptText:'later'});const after=saved();assert.throws(()=>call(f,a,rev,{transcriptText:'saved'}),/manual_audio_conflict/);assert.equal(saved(),after);
  });
  await t.test('concurrent identical requests perform one mutation',async()=>{
   seed();const rev=state().revision;const first=asyncQ('SET ROLE service_role;BEGIN;'+rpc(f,a,rev,{})+"SELECT pg_sleep(0.3);COMMIT;");
   // Wait for the first transaction to be in its post-write pause, not an arbitrary client delay.
   for(let i=0;i<100;i++){if(q("SELECT count(*) FROM pg_stat_activity WHERE wait_event='PgSleep';")!=='0')break;await new Promise(r=>setTimeout(r,10));if(i===99)assert.fail('first transaction not ready');}
   const second=asyncQ('SET ROLE service_role;'+rpc(f,a,rev,{}));await first;assert.equal(JSON.parse(await second).duplicate,true);assert.equal(state().articleId,a);
  });
  await t.test('concurrent competing targets have one winner and one conflict',async()=>{
   seed();const rev=state().revision;const results=await Promise.allSettled([asyncQ('SET ROLE service_role;'+rpc(f,a,rev,{})),asyncQ('SET ROLE service_role;'+rpc(f,b,rev,{}))]);
   assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/manual_audio_conflict/);
  });
 } finally {if(started)exec('pg_ctl',['-D',data,'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
