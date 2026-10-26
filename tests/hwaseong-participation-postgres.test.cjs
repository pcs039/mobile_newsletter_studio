/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in socket-only PostgreSQL; no remote app credentials. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,execFile}=require('node:child_process');
const bin=process.env.SAMPLE_PARTICIPATION_PG_BIN,project='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',article='b48352e0-dbbe-4cca-bbcc-f88988b27d32',survey='11111111-1111-4111-8111-111111111111',question='22222222-2222-4222-8222-222222222222',actor='a'.repeat(64);
test('Staging participation SQL: actual PostgreSQL access, moderation, isolated survey and duplicate races',{skip:!bin,timeout:60000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mns-participation-')),data=path.join(dir,'db'),socket=path.join(dir,'socket');fs.mkdirSync(socket,{mode:0o700});let started=false;
 const exe=(name,args)=>execFileSync(path.join(bin,name),args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000});
 const args=['-h',socket,'-p','54337','-U','fixture_root','-d','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
 const sql=s=>exe('psql',[...args,'-c',s]),run=s=>new Promise((resolve,reject)=>execFile(path.join(bin,'psql'),[...args,'-c',s],{encoding:'utf8',timeout:15000},(err,out)=>err?reject(err):resolve(out)));
 const service=`set role service_role;set request.jwt.claim.role='service_role';`;
 const submit=(id='33333333-3333-4333-8333-333333333333',kind='private',body='의견',a=article,answers='{}',sid='null')=>`select public.sample_participation_submit('${id}','${project}','${a}','${actor}','${kind}',${body===null?'null':"'"+body+"'"},'${answers}',${sid==='null'?'null':"'"+sid+"'"})`;
 const manage=(action,id='null',enabled='null',sid='null')=>`select public.sample_participation_manage('${project}','${action}',${id==='null'?'null':"'"+id+"'"},${enabled},${sid==='null'?'null':"'"+sid+"'"},'${actor}')`;
 try{
  exe('initdb',['-D',data,'--username=fixture_root','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  exe('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-k ${socket} -p 54337 -c listen_addresses=''`,'-w','start']);started=true;
  sql(`create role anon;create role authenticated;create role service_role nologin bypassrls;create schema auth;create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
   create table newsletter_projects(id uuid primary key,slug text,status text,deleted_at timestamptz);create table newsletter_articles(id uuid primary key,project_id uuid references newsletter_projects(id));
   insert into newsletter_projects values('${project}','hwaseong-2026-10-samples','draft',null),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other','draft',null);insert into newsletter_articles values('${article}','${project}'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');`);
  sql(fs.readFileSync(path.join(__dirname,'../supabase_survey_event_management.sql'),'utf8'));
  await t.test('target guard refuses unapproved execution',()=>assert.throws(()=>sql(fs.readFileSync(path.join(__dirname,'../supabase/schema_v1_44_sample_participation.sql'),'utf8'))));
  sql(`set app.sample_participation_target='mvrkpmffuhcqwisqvpqi';`+fs.readFileSync(path.join(__dirname,'../supabase/schema_v1_44_sample_participation.sql'),'utf8'));
  sql(`insert into newsletter_sample_participation_settings(project_id) values('${project}');insert into newsletter_surveys(id,project_id,title,status) values('${survey}','${project}','간단 설문','open');insert into newsletter_survey_questions(id,project_id,survey_id,title,options) values('${question}','${project}','${survey}','도움이 되었나요?',array['도움','보완']);`);
  await t.test('anon/authenticated have neither direct reads nor RPC execution; service has no direct writes',()=>{
   for(const role of ['anon','authenticated']){assert.throws(()=>sql(`set role ${role};select * from newsletter_sample_participation`));assert.throws(()=>sql(`set role ${role};`+submit()));}
   assert.throws(()=>sql(service+`insert into newsletter_sample_participation_settings(project_id) values('${project}')`));
  });
  await t.test('private receipt is durable; same key recovers and changed input rejects',()=>{
   const r=JSON.parse(sql(service+submit()));assert.equal(r.state,'private');assert.deepEqual(JSON.parse(sql(service+submit())),r);assert.throws(()=>sql(service+submit(undefined,'private','changed')));
  });
  await t.test('cross-project article is refused and comments are OFF by default',()=>{
   assert.throws(()=>sql(service+submit('44444444-4444-4444-8444-444444444444','private','의견','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')));
   assert.throws(()=>sql(service+submit('44444444-4444-4444-8444-444444444444','comment')));
  });
  await t.test('admin enables comments, new comment is pending, private remains private, rejection hides an approved comment',()=>{
   sql(service+manage('settings','null','true',survey));const id='44444444-4444-4444-8444-444444444444';assert.equal(JSON.parse(sql(service+submit(id,'comment'))).state,'pending');
   assert.throws(()=>sql(service+manage('approve','33333333-3333-4333-8333-333333333333')));sql(service+manage('approve',id));assert.equal(sql(`select state from newsletter_sample_participation where id='${id}'`).trim(),'approved');
   sql(service+manage('reject',id));assert.equal(sql(`select state from newsletter_sample_participation where id='${id}'`).trim(),'rejected');
  });
  await t.test('reviewed survey copy resists anonymous changes to legacy definitions; choices stay validated',()=>{
   sql(`update newsletter_survey_questions set options=array['poisoned'] where id='${question}'`);
   const answers=JSON.stringify({[question]:'도움'});const r=JSON.parse(sql(service+submit('55555555-5555-4555-8555-555555555555','survey',null,article,answers,survey)));assert.equal(r.state,'recorded');
   assert.throws(()=>sql(service+submit('66666666-6666-4666-8666-666666666666','survey',null,article,JSON.stringify({[question]:'poisoned'}),survey)));
   assert.equal(sql('select count(*) from newsletter_survey_responses').trim(),'0');
  });
  await t.test('two PostgreSQL connections racing the same key create exactly one entry',async()=>{
   const id='77777777-7777-4777-8777-777777777777',first=run(service+`begin;${submit(id)};select pg_sleep(0.6);commit;`),second=run(service+submit(id));await Promise.all([first,second]);assert.equal(sql(`select count(*) from newsletter_sample_participation where id='${id}'`).trim(),'1');
  });
  await t.test('durable rate limit rejects the sixth recent response for this article',()=>{
   sql(service+submit('88888888-8888-4888-8888-888888888888'));
   assert.throws(()=>sql(service+submit('99999999-9999-4999-8999-999999999999')));
   assert.equal(sql('select count(*) from newsletter_sample_participation').trim(),'5');
  });
 }finally{if(started)exe('pg_ctl',['-D',data,'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
