/* eslint-disable @typescript-eslint/no-require-imports -- Isolated PostgreSQL runtime, never a deployed database. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const runtime=process.env.CANVA_SQL_TEST_RUNTIME;
test('AI image atomic RPC: approval, ownership, CAS, hero replacement, body ordering, duplicate and revoke preserve source/assets',{skip:!runtime},async()=>{
 const {PGlite}=require(runtime),db=new PGlite();
 const p='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',asset='33333333-3333-4333-8333-333333333333',second='33333333-3333-4333-8333-333333333334',block='44444444-4444-4444-8444-444444444444',link='55555555-5555-4555-8555-555555555555',key='a'.repeat(64);
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;set request.jwt.claim.role='service_role';
 create table newsletter_articles(id uuid primary key,project_id uuid,title text,body text,updated_at timestamptz default now());
 create table newsletter_project_design_assets(id uuid primary key,project_id uuid,asset_type text,mime_type text,storage_bucket text,is_active boolean,approval_status text,metadata jsonb);
 create table newsletter_link_actions(id uuid primary key,article_id uuid,label text,target_value text);
 create table newsletter_content_blocks(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid,block_type text,title text,body text,asset_id uuid,sort_order integer,is_visible boolean,metadata jsonb default '{}',created_at timestamptz default now());
 insert into newsletter_articles values('${a}','${p}','원문 제목','원문 본문',now());
 insert into newsletter_link_actions values('${link}','${a}','CTA','https://example.com');
 insert into newsletter_content_blocks(id,project_id,article_id,block_type,body,sort_order,is_visible) values('${block}','${p}','${a}','paragraph','보존 문단',0,true);
 insert into newsletter_content_blocks(project_id,article_id,block_type,body,sort_order,is_visible) values('${p}','${a}','quote','보존 인용',1,true);
 insert into newsletter_project_design_assets values('${asset}','${p}','background','image/png','design-production-assets',true,'approved','{"source":"openai","imageGeneration":{"generatedForArticleId":"${a}","visualStrategy":"ai_generated_image","generationKey":"${key}"}}');
 insert into newsletter_project_design_assets select '${second}',project_id,asset_type,mime_type,storage_bucket,is_active,approval_status,metadata from newsletter_project_design_assets;`);
 await db.exec(fs.readFileSync('supabase/schema_v1_37_ai_image_article_atomic.sql','utf8'));
 const rows=async(q,args=[])=>(await db.query(q,args)).rows;
 const rpc=async(action,role='hero',id=asset,expected=null)=>(await rows('select apply_newsletter_ai_image_article_atomic($1,$2,$3,$4,$5,$6,$7,$8) r',[p,a,action,role,id,expected,key,1]))[0].r;
 const source=await rows('select * from newsletter_articles'),links=await rows('select * from newsletter_link_actions'),assets=await rows('select * from newsletter_project_design_assets order by id');
 const original=await rows('select id,body from newsletter_content_blocks order by id');
 const snapshot=async()=>(await rpc('snapshot')).snapshot;
 for(const [column,value] of [['approval_status','draft'],['is_active',false],['project_id',a],['storage_bucket',null]]){
   const old=(await rows(`select ${column} from newsletter_project_design_assets where id=$1`,[asset]))[0][column];
   await db.query(`update newsletter_project_design_assets set ${column}=$1 where id=$2`,[value,asset]);
   await assert.rejects(rpc('apply','hero',asset,await snapshot()));
   await db.query(`update newsletter_project_design_assets set ${column}=$1 where id=$2`,[old,asset]);
 }
 await db.query("update newsletter_project_design_assets set metadata=jsonb_set(metadata,'{imageGeneration,generatedForArticleId}',to_jsonb($1::text)) where id=$2",[p,asset]);
 await assert.rejects(rpc('apply','hero',asset,await snapshot()));
 await db.query("update newsletter_project_design_assets set metadata=jsonb_set(metadata,'{imageGeneration,generatedForArticleId}',to_jsonb($1::text)) where id=$2",[a,asset]);
 await assert.rejects(rpc('apply','hero',asset,'0'.repeat(32)));
 const applied=await rpc('apply','hero',asset,await snapshot());
 const managed=(await rows('select * from newsletter_content_blocks where id=$1',[applied.blockId]))[0];
 assert.equal(managed.asset_id,null);assert.equal(managed.metadata.applied_role,'hero');assert.equal(managed.metadata.generation_key,key);
 assert.equal((await rpc('apply','hero',asset,await snapshot())).duplicate,true);
 const replaced=await rpc('apply','hero',second,await snapshot());assert.equal(replaced.blockId,applied.blockId);
 assert.equal((await rows("select count(*)::int n from newsletter_content_blocks where metadata->>'applied_role'='hero'"))[0].n,1);
 await assert.rejects(rpc('revoke','hero',asset,await snapshot())); // Old variant cannot remove its replacement.
 const stale=await snapshot();await db.exec("update newsletter_articles set title='외부 변경'");
 await assert.rejects(rpc('revoke','hero',second,stale));
 await rpc('revoke','hero',second,await snapshot()); // Explicitly refreshed state can remove only its own connection.
 await db.exec("update newsletter_articles set title='원문 제목'");
 await db.exec(`create function fail_ai_marker() returns trigger language plpgsql as $$begin if new.metadata->>'managed_by'='ai_image_article_v1' then raise exception 'mid_failure';end if;return new;end$$;create trigger fail_ai before update on newsletter_content_blocks for each row execute function fail_ai_marker();`);
 const rollbackSnapshot=await snapshot();await assert.rejects(rpc('apply','body',asset,rollbackSnapshot));assert.equal(await snapshot(),rollbackSnapshot);
 await db.exec('drop trigger fail_ai on newsletter_content_blocks');
 const body=await rpc('apply','body',asset,await snapshot());assert(body.applied);
 assert.equal((await rows('select sort_order from newsletter_content_blocks where id=$1',[body.blockId]))[0].sort_order,1);
 assert.equal((await rpc('apply','body',asset,await snapshot())).duplicate,true);
 await rpc('revoke','body',asset,await snapshot());assert.equal((await rpc('revoke','body',asset,await snapshot())).notFound,true);
 assert.deepEqual(await rows('select * from newsletter_articles'),source);assert.deepEqual(await rows('select * from newsletter_link_actions'),links);
 assert.deepEqual(await rows('select id,body from newsletter_content_blocks order by id'),original);assert.deepEqual(await rows('select * from newsletter_project_design_assets order by id'),assets);
 await db.exec(`insert into newsletter_content_blocks(project_id,article_id,block_type,metadata,is_visible) values('${p}','${a}','image','{"presentation_mode":"full_layout"}',true)`);
 await assert.rejects(rpc('apply','hero',asset,await snapshot()));
 await db.exec("set request.jwt.claim.role='authenticated'");await assert.rejects(rpc('snapshot'));
 }finally{await db.close();}
});
