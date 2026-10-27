/* eslint-disable @typescript-eslint/no-require-imports -- Socket-only PostgreSQL fixture; never remote. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync,execFile}=require('node:child_process');
const bin=process.env.SAMPLE_EDIT_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin',project='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',article='11111111-1111-4111-8111-111111111111',cover='22222222-2222-4222-8222-222222222222',body='33333333-3333-4333-8333-333333333333';
test('sample text edit: real PostgreSQL preservation, permission, rollback and concurrent writers',{timeout:60000,skip:!fs.existsSync(path.join(bin,'initdb'))},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mns-sample-edit-')),data=path.join(dir,'db'),socket=path.join(dir,'socket');fs.mkdirSync(socket,{mode:0o700});let started=false;
 const exe=(name,args)=>execFileSync(path.join(bin,name),args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000});
 const args=['-h',socket,'-p','54339','-U','fixture_root','-d','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
 const sql=s=>exe('psql',[...args,'-c',s]),run=s=>new Promise((resolve,reject)=>execFile(path.join(bin,'psql'),[...args,'-c',s],{encoding:'utf8',timeout:15000},(e,v)=>e?reject(e):resolve(v)));
 const lit=s=>"'"+String(s).replaceAll("'","''")+"'",service="set role service_role;set request.jwt.claim.role='service_role';",call=(revision=null,patch=null,id=article,p=project)=>`select save_hwaseong_sample_text_atomic('${p}','${id}',${revision?lit(revision):'null'},${patch?lit(JSON.stringify(patch))+'::jsonb':'null'})`;
 const read=()=>JSON.parse(sql(service+call())),patch=s=>({title:s.title,summary:s.summary,blocks:s.blocks,sections:s.sections});
 const records=()=>JSON.parse(sql(`select jsonb_build_object('article',(select to_jsonb(x) from newsletter_articles x where id='${article}'),'blocks',(select jsonb_agg(to_jsonb(x) order by id) from newsletter_content_blocks x),'links',(select jsonb_agg(to_jsonb(x) order by id) from newsletter_link_actions x),'composition',(select jsonb_agg(to_jsonb(x) order by id) from newsletter_article_compositions x),'audio',(select jsonb_agg(to_jsonb(x) order by id) from newsletter_audio_files x))`));
 try{
  exe('initdb',['-D',data,'--username=fixture_root','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);exe('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-k ${socket} -p 54339 -c listen_addresses=''`,'-w','start']);started=true;
  sql(`create role anon;create role authenticated;create role service_role nologin;create schema auth;create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    create table newsletter_projects(id uuid primary key,slug text,status text);
    create table newsletter_articles(id uuid primary key,project_id uuid,title text,summary text,body text,status text,sort_order int,audio_id uuid,ai_audio_id uuid,audio_source text,article_tts_voice text,tts_request_id uuid,tts_request_state text,representative_asset_id uuid);
    create table newsletter_content_blocks(id uuid primary key,project_id uuid,article_id uuid,block_type text,title text,body text,sort_order int,metadata jsonb,is_visible boolean,asset_id uuid,link_action_id uuid,text_alignment text);
    create table newsletter_link_actions(id uuid primary key,article_id uuid,target_value text);
    create table newsletter_article_compositions(id uuid primary key,article_id uuid,settings jsonb);
    create table newsletter_audio_files(id uuid primary key,file_path text,script_text text);
    insert into newsletter_projects values('${project}','hwaseong-2026-10-samples','private');
    insert into newsletter_articles values('${article}','${project}','원본 제목','원본 요약','보존 원문','draft',10,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'uploaded','marin',null,'idle',null);
    insert into newsletter_audio_files values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','existing.mp3','기존 대본');
    insert into newsletter_link_actions values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${article}','https://example.invalid/source');
    insert into newsletter_article_compositions values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','${article}','{"productionPattern":"policy","textDesign":{"label":"보존"}}');
    insert into newsletter_content_blocks values('${cover}','${project}','${article}','image','이미지','/api/project-files/preview?unchanged',10,'{"proposal_sample":{"version":1,"kind":"policy","headline":"시연 제목","summary":"시연 요약","sourceTitle":"출처"},"unknown":{"keep":true}}',true,null,null,'left'),
    ('${body}','${project}','${article}','paragraph','기존 10월호 원문 · 그대로 보존','보존 원문',20,'{"body_design":{"kind":"info"},"source":"official"}',true,null,null,'left'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${project}','${article}','paragraph','숨겨진 원본','숨김 본문',30,'{"archive":true}',false,null,null,'left');`);
  const migration=fs.readFileSync(path.join(__dirname,'../supabase/schema_v1_45_sample_text_edit.sql'),'utf8');
  await t.test('target guard refuses unapproved migration',()=>assert.throws(()=>sql(migration)));
  sql("set app.sample_text_edit_target='mvrkpmffuhcqwisqvpqi';"+migration);
  await t.test('public roles cannot execute; service cannot cross project or public project boundary',()=>{
    for(const role of ['anon','authenticated'])assert.throws(()=>sql(`set role ${role};`+call()));
    assert.throws(()=>sql(service+call(null,null,article,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')));
    sql(`update newsletter_projects set status='published'`);assert.throws(()=>read());sql(`update newsletter_projects set status='private'`);
  });
  const before=records();
  await t.test('snapshot is read only; title and summary come from actual sample presentation',()=>{const s=read();assert.equal(s.title,'시연 제목');assert.equal(s.blocks.length,1);assert.deepEqual(records(),before);});
  await t.test('title/body save retains every ID, hidden block, reference, source and immutable audio',()=>{
    const s=read(),p=patch(s);p.title='수정한 제목';p.blocks[0].body='수정한 본문';const saved=JSON.parse(sql(service+call(s.revision,p)));assert(saved.ok);assert.notEqual(saved.revision,s.revision);
    const after=records();assert.deepEqual(after.links,before.links);assert.deepEqual(after.composition,before.composition);assert.deepEqual(after.audio,before.audio);
    for(const k of Object.keys(before.article).filter(k=>!['title','summary','body'].includes(k)))assert.deepEqual(after.article[k],before.article[k]);
    assert.deepEqual(after.blocks.map(b=>b.id),before.blocks.map(b=>b.id));const c=after.blocks.find(b=>b.id===cover),b=after.blocks.find(b=>b.id===body);
    assert.deepEqual(c.metadata.unknown,{keep:true});assert.equal(c.metadata.proposal_sample.headline,p.title);assert.equal(c.metadata.proposal_original_article.body,'보존 원문');assert.equal(b.metadata.proposal_original_text.body,'보존 원문');assert.equal(b.metadata.source,'official');assert.deepEqual(after.blocks.find(b=>!b.is_visible),before.blocks.find(b=>!b.is_visible));
  });
  await t.test('second save preserves first source snapshot; no-op and stale revision never write',()=>{
    const s=read(),p=patch(s),snapshot=records();assert.equal(JSON.parse(sql(service+call(s.revision,p))).changed,false);assert.deepEqual(records(),snapshot);
    p.summary='수정 요약';sql(service+call(s.revision,p));assert.throws(()=>sql(service+call(s.revision,p)));assert.equal(records().blocks.find(b=>b.id===cover).metadata.proposal_original_article.body,'보존 원문');
  });
  await t.test('unknown keys, block omission, duplicate/foreign IDs and asset injection reject atomically',()=>{
    const s=read(),old=records();for(const mutate of [p=>p.status='published',p=>p.blocks=[],p=>p.blocks[0].id=cover,p=>p.blocks[0].asset_id='bad',p=>p.blocks.push(p.blocks[0])]){const p=structuredClone(patch(s));mutate(p);assert.throws(()=>sql(service+call(s.revision,p)));assert.deepEqual(records(),old);}
  });
  await t.test('failure after block update rolls the entire save back',()=>{
    sql(`create function force_failure() returns trigger language plpgsql as $$begin raise exception 'fixture_failure';end$$;create trigger fail_article before update on newsletter_articles for each row execute function force_failure();`);
    const s=read(),p=patch(s),old=records();p.blocks[0].body='실패할 본문';assert.throws(()=>sql(service+call(s.revision,p)));assert.deepEqual(records(),old);sql('drop trigger fail_article on newsletter_articles');
  });
  await t.test('two connections with one revision allow exactly one save',async()=>{
    const s=read(),p1=patch(s),p2=structuredClone(p1);p1.title='동시 요청 하나';p2.title='동시 요청 둘';const r=await Promise.allSettled([run(service+`begin;${call(s.revision,p1)};select pg_sleep(0.3);commit;`),run(service+call(s.revision,p2))]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
  });
  await t.test('interview section editing retains photo, attribution, Canva data and archived paragraph',()=>{
    sql(`update newsletter_content_blocks set metadata=jsonb_set(metadata,'{proposal_sample,kind}','"interview"')||'{"proposal_editorial":{"sections":[{"title":"소제목","text":"인터뷰 본문"}],"sourceUrl":"https://source.invalid","canvaCover":"unchanged.png","quote":"실제 발언"}}' where id='${cover}'`);
    const s=read(),p=patch(s),old=records();assert.equal(s.blocks.length,0);p.sections[0].text='편집한 인터뷰 본문';sql(service+call(s.revision,p));const now=records();assert.deepEqual(now.blocks.find(b=>b.id===body),old.blocks.find(b=>b.id===body));const c=now.blocks.find(b=>b.id===cover);assert.equal(c.metadata.proposal_editorial.sourceUrl,'https://source.invalid');assert.equal(c.metadata.proposal_editorial.canvaCover,'unchanged.png');assert.equal(c.metadata.proposal_original_editorial.sections[0].text,'인터뷰 본문');assert.deepEqual(now.audio,old.audio);
  });
 }finally{if(started)exe('pg_ctl',['-D',data,'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
