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
 let connectionNumber=0;
 const startConnection=()=>{
  const name=`manual_fixture_${++connectionNumber}`;
  const c=spawn(path.join(bin,'psql'),args,{stdio:['pipe','pipe','pipe']});
  let out='',err='',readyResolve,readyReject,doneResolve,doneReject;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
  const done=new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject;});done.catch(()=>{});
  c.stdout.on('data',d=>{out+=d;if(out.includes('__READY__'))readyResolve();});
  c.stderr.on('data',d=>err+=d);
  c.on('error',e=>{readyReject(e);doneReject(e);});
  c.on('close',code=>{if(code){const e=new Error(err);readyReject(e);doneReject(e);}else{readyResolve();doneResolve(out.trim());}});
  c.stdin.write(`SET application_name='${name}';SET statement_timeout='5s';SET deadlock_timeout='100ms';SET ROLE service_role;BEGIN;\n`);
  return {name,ready,done,send:sql=>c.stdin.write(sql+"\n"),finish:sql=>{c.stdin.end(sql+"\n");return done;},output:()=>out};
 };
 const hold=async sql=>{const c=startConnection();c.send(sql+"SELECT '__READY__';");await c.ready;return c;};
 const waitBlocked=async name=>{for(let i=0;i<100;i++){if(q(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND cardinality(pg_blocking_pids(pid))>0;`)!=='0')return;await new Promise(r=>setTimeout(r,10));}assert.fail('expected a blocked connection');};
 const settle=promise=>promise.then(value=>({value}),error=>({error}));
 const rpc=(audio=f,article=null,revision=null,changes=null,project=p,actor='writer',role='user')=>`SELECT public.manage_newsletter_manual_audio_link(${[project,audio,article,revision,changes===null?null:JSON.stringify(changes),'writer-id',actor,role].map(quote).join(',')});`;
 const call=(...x)=>JSON.parse(q('SET ROLE service_role;'+rpc(...x)));
 const state=(audio=f)=>call(audio).state;
 const saved=()=>q(`SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.newsletter_articles x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.newsletter_audio_files x));`);
 const seed=()=>q(`TRUNCATE public.newsletter_projects CASCADE;
 INSERT INTO public.newsletter_projects(id,assignee_name,status,deleted_at) VALUES('${p}','writer','private',null),('${p2}','other','private',null);
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
 CREATE TRIGGER touch_audio BEFORE UPDATE ON public.newsletter_audio_files FOR EACH ROW EXECUTE FUNCTION public.fixture_touch();
 GRANT SELECT,UPDATE ON public.newsletter_projects,public.newsletter_articles,public.newsletter_audio_files TO service_role;`);
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

  await t.test('GET works inside READ ONLY and holds no tuple/write relation locks',async()=>{
   seed();const before=saved(),reader=await hold('SET TRANSACTION READ ONLY;'+rpc());
   try{
    assert.equal(q(`SELECT count(*) FROM pg_locks WHERE pid IN (SELECT pid FROM pg_stat_activity WHERE application_name='${reader.name}') AND (locktype='tuple' OR (locktype='relation' AND mode<>'AccessShareLock'));`),'0');
    const writer=await asyncQ("SET statement_timeout='1s';SET ROLE service_role;"+rpc(f,a,state().revision,{}));assert.equal(JSON.parse(writer).duplicate,false);
   }finally{await reader.finish('ROLLBACK;');}
   assert.notEqual(saved(),before);assert.equal(state().articleId,a);
  });
  // Install the existing production authoring/TTS function bodies against synthetic
  // fixture tables. No OpenAI call, actual MP3 or remote database is involved.
  const extraText='display_title summary body text_alignment title_alignment summary_alignment body_alignment article_type urgency publication_kind article_tts_voice contact_name contact_phone motion_preset motion_speed title_motion_effect title_motion_speed text_box_motion_effect text_box_motion_speed image_motion_effect image_motion_speed link_motion_effect link_motion_speed status'.split(' ');
  q(`ALTER TABLE public.newsletter_projects ADD COLUMN article_tts_voice text DEFAULT 'marin';
    ALTER TABLE public.newsletter_articles ${extraText.map(c=>`ADD COLUMN ${c} text`).join(',')},ADD COLUMN page_id uuid,ADD COLUMN sort_order integer DEFAULT 0,ADD COLUMN interest_tags text[],ADD COLUMN institution_priority smallint,ADD COLUMN valid_from timestamptz,ADD COLUMN valid_until timestamptz,ADD COLUMN public_info jsonb,ADD COLUMN survey_id uuid,ADD COLUMN title_font_asset_id uuid,ADD COLUMN body_font_asset_id uuid,ADD COLUMN caption_font_asset_id uuid,ADD COLUMN button_font_asset_id uuid,ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN tts_request_id uuid,ADD COLUMN tts_request_fingerprint text,ADD COLUMN tts_started_at timestamptz;
    ALTER TABLE public.newsletter_audio_files ADD COLUMN duration_seconds integer,ADD COLUMN ai_tts_audio_paths jsonb DEFAULT '[]',ADD COLUMN ai_tts_text_hash text,ADD COLUMN ai_tts_voice text,ADD COLUMN ai_tts_model text,ADD COLUMN ai_tts_generated_at timestamptz;
    CREATE TYPE public.content_block_type AS ENUM('paragraph','image','button_group');CREATE TYPE public.link_action_type AS ENUM('url');CREATE TYPE public.link_display_style AS ENUM('button');
    CREATE TABLE public.newsletter_pages(id uuid PRIMARY KEY,project_id uuid);CREATE TABLE public.newsletter_surveys(id uuid PRIMARY KEY,project_id uuid);CREATE TABLE public.newsletter_assets(id uuid PRIMARY KEY,project_id uuid);
    CREATE TABLE public.newsletter_link_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES public.newsletter_projects ON DELETE CASCADE,article_id uuid REFERENCES public.newsletter_articles ON DELETE CASCADE,label text,action_type public.link_action_type,target_value text,display_style public.link_display_style,sort_order integer,is_visible boolean);
    CREATE TABLE public.newsletter_content_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES public.newsletter_projects ON DELETE CASCADE,article_id uuid REFERENCES public.newsletter_articles ON DELETE CASCADE,block_type public.content_block_type,title text,body text,text_alignment text,asset_id uuid,link_action_id uuid,sort_order integer,metadata jsonb,is_visible boolean);`);
  q(fs.readFileSync('supabase/schema_v1_38_article_order_atomic.sql','utf8'));
  const tts=fs.readFileSync('supabase/schema_v1_43_article_tts_safety.sql','utf8');q(tts.slice(tts.indexOf('create function public.article_tts_claim')));
  const save=(title='changed',source='uploaded')=>`SELECT public.save_newsletter_article_atomic('${p}','${a}',${quote(JSON.stringify({title,body:'edited body',summary:'summary',audio_source:source,article_tts_voice:'marin',interest_tags:[],status:'draft'}))},'[]');`;
  const job=id(90);
  const claim=()=>{
   seed();q(`UPDATE public.newsletter_articles SET audio_source='ai_tts',ai_audio_id='${ai}',article_tts_voice='marin' WHERE id='${a}';`);
   return JSON.parse(q(`SET ROLE service_role;SELECT public.article_tts_claim('${p}','${a}','${job}',null,false,'marin','gpt-4o-mini-tts','writer-id','writer','user');`));
  };
  const complete=fingerprint=>`SELECT public.article_tts_complete('${p}','${a}','${job}',${quote(fingerprint)},'marin','gpt-4o-mini-tts','${'b'.repeat(64)}',${quote(JSON.stringify([{path:`ai-tts-v2/${p}/${a}/${job}/000.mp3`,hash:'a'.repeat(64),size:1668,duration:1}]))},'writer-id','writer','user');`;
  await t.test('GET sees committed snapshot during real article save; waiting manual CAS conflicts after commit',async()=>{
   attach();const before=state(),writer=await hold(save());
   try{
    const read=JSON.parse(q("SET statement_timeout='500ms';SET ROLE service_role;BEGIN READ ONLY;"+rpc()+"COMMIT;"));assert.equal(read.state.revision,before.revision);
    const waiting=startConnection(),result=settle(waiting.done);waiting.send(rpc(f,a,before.revision,{})+"COMMIT;");waiting.finish('');await waitBlocked(waiting.name);await writer.finish('COMMIT;');
    assert.match((await result).error.message,/manual_audio_conflict/);assert.equal(state().articleId,null);assert.equal(state(old).articleId,a);
   }finally{await writer.done;}
  });
  await t.test('article save rollback leaves old revision and permits waiting manual commit',async()=>{
   attach();const rev=state().revision,writer=await hold(save('discarded')),waiting=startConnection();const result=settle(waiting.done);
   waiting.send(rpc(f,a,rev,{})+'COMMIT;');waiting.finish('');await waitBlocked(waiting.name);await writer.finish('ROLLBACK;');assert(!(await result).error);assert.equal(state().articleId,a);assert.equal(q(`SELECT title FROM public.newsletter_articles WHERE id='${a}';`),'one');
  });
  await t.test('project-first manual then actual article save serializes without deadlock; connection remains',async()=>{
   attach();const writer=await hold(rpc(f,a,state().revision,{})),waiting=startConnection();const result=settle(waiting.done);waiting.send(save('body after link')+'COMMIT;');waiting.finish('');await waitBlocked(waiting.name);await writer.finish('COMMIT;');assert(!(await result).error);assert.equal(state().articleId,a);assert.equal(q(`SELECT audio_id FROM public.newsletter_articles WHERE id='${a}';`),f);
  });
  await t.test('real TTS completion holds project SHARE; GET remains nonblocking and stale manual conflicts',async()=>{
   const claimed=claim(),rev=state().revision,writer=await hold(complete(claimed.fingerprint));
   const read=JSON.parse(q("SET statement_timeout='500ms';SET ROLE service_role;BEGIN READ ONLY;"+rpc()+"COMMIT;"));assert.equal(read.state.revision,rev);
   const waiting=startConnection(),result=settle(waiting.done);waiting.send(rpc(f,b,rev,{})+'COMMIT;');waiting.finish('');await waitBlocked(waiting.name);await writer.finish('COMMIT;');assert.match((await result).error.message,/manual_audio_conflict/);assert.equal(state().articleId,null);assert.equal(q(`SELECT ai_audio_id FROM public.newsletter_articles WHERE id='${a}';`),job);
  });
  await t.test('manual then real TTS completion on another article serializes and preserves both links',async()=>{
   const claimed=claim(),writer=await hold(rpc(f,b,state().revision,{})),waiting=startConnection();const result=settle(waiting.done);waiting.send(complete(claimed.fingerprint)+'COMMIT;');waiting.finish('');await waitBlocked(waiting.name);await writer.finish('COMMIT;');assert(!(await result).error);assert.equal(state().articleId,b);assert.equal(q(`SELECT ai_audio_id FROM public.newsletter_articles WHERE id='${a}';`),job);
  });
  await t.test('adversarial reversed row order deadlocks one transaction; rollback never leaves half a link',async()=>{
   attach();const rev=state().revision,before=saved(),legacy=await hold(`SELECT id FROM public.newsletter_audio_files WHERE id='${f}' FOR UPDATE;`),manual=startConnection();
   const manualResult=settle(manual.done);manual.send(rpc(f,a,rev,{})+'COMMIT;');manual.finish('');await waitBlocked(manual.name);
   const legacyResult=settle(legacy.finish(`UPDATE public.newsletter_projects SET status=status WHERE id='${p}';COMMIT;`));
   const [m,l]=await Promise.all([manualResult,legacyResult]);assert.equal([m,l].filter(x=>x.error).length,1);assert.match((m.error||l.error).message,/deadlock detected/);
   if(m.error)assert.equal(saved(),before);else{assert.equal(state().articleId,a);assert.equal(state(old).articleId,null);}
  });
  await t.test('repeatable-read stale writer gets serialization abort; committed connection is preserved',async()=>{
   attach();const rev=state().revision,stale=await hold('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;'+rpc());
   call(f,b,rev,{});const after=saved();
   await assert.rejects(stale.finish(rpc(f,a,rev,{})+'COMMIT;'),/could not serialize access/);
   assert.equal(saved(),after);assert.equal(state().articleId,b);assert.equal(state(old).articleId,a);
  });
 } finally {if(started)exec('pg_ctl',['-D',data,'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
