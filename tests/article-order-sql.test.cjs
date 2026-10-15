/* eslint-disable @typescript-eslint/no-require-imports -- Isolated PostgreSQL runtime; no deployed DB access. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const runtime=process.env.CANVA_SQL_TEST_RUNTIME;
test('article order RPC: exact project set, CAS, rollback, row identity, append and stale editor order preservation',{skip:!runtime},async()=>{
 const {PGlite}=require(runtime),db=new PGlite();
 const p='11111111-1111-4111-8111-111111111111',other='11111111-1111-4111-8111-111111111112';
 const ids=[1,2,3].map(i=>`22222222-2222-4222-8222-22222222222${i}`),foreign='22222222-2222-4222-8222-222222222224';
 try{
 const textColumns='title display_title summary body text_alignment title_alignment summary_alignment body_alignment article_type urgency publication_kind audio_source article_tts_voice contact_name contact_phone motion_preset motion_speed title_motion_effect title_motion_speed text_box_motion_effect text_box_motion_speed image_motion_effect image_motion_speed link_motion_effect link_motion_speed status'.split(' ').map(c=>`${c} text`).join(',');
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;set request.jwt.claim.role='service_role';
 create type content_block_type as enum('paragraph','image','button_group');create type link_action_type as enum('url');create type link_display_style as enum('button');
 create table newsletter_projects(id uuid primary key);
 create table newsletter_pages(id uuid primary key,project_id uuid);create table newsletter_surveys(id uuid primary key,project_id uuid);create table newsletter_assets(id uuid primary key,project_id uuid);
 create table newsletter_articles(id uuid primary key default gen_random_uuid(),project_id uuid references newsletter_projects(id),page_id uuid,sort_order integer not null default 0,${textColumns},interest_tags text[],institution_priority smallint,valid_from timestamptz,valid_until timestamptz,public_info jsonb,survey_id uuid,title_font_asset_id uuid,body_font_asset_id uuid,caption_font_asset_id uuid,button_font_asset_id uuid,updated_at timestamptz default now(),created_at timestamptz default now());
 create table newsletter_link_actions(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid,label text,action_type link_action_type,target_value text,display_style link_display_style,sort_order integer,is_visible boolean);
 create table newsletter_content_blocks(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid,block_type content_block_type,title text,body text,text_alignment text,asset_id uuid,link_action_id uuid,sort_order integer,metadata jsonb,is_visible boolean);
 insert into newsletter_projects values('${p}'),('${other}');
 insert into newsletter_articles(id,project_id,title,body) values ${ids.map((id,i)=>`('${id}','${p}','기사${i}','원문${i}')`).join(',')},('${foreign}','${other}','다른 기사','다른 원문');
 insert into newsletter_content_blocks(project_id,article_id,block_type,body,metadata) values('${p}','${ids[0]}','paragraph','원문 문단','{"keep":true}');
 insert into newsletter_link_actions(project_id,article_id,label,target_value) values('${p}','${ids[0]}','원문 링크','https://example.com');`);
 await db.exec(fs.readFileSync('supabase/schema_v1_38_article_order_atomic.sql','utf8'));
 const rows=async(q,args=[])=>(await db.query(q,args)).rows;
 const rpc=async(order=null,snapshot=null,project=p)=>(await rows('select reorder_newsletter_articles_atomic($1,$2,$3) r',[project,order,snapshot]))[0].r;
 const initial=await rpc(),articles=await rows('select id,title,body,created_at from newsletter_articles order by id'),blocks=await rows('select * from newsletter_content_blocks'),links=await rows('select * from newsletter_link_actions');
 assert.equal(initial.articles.length,3);assert.match(initial.snapshot,/^[a-f0-9]{32}$/);
 assert.deepEqual(await rpc(),initial); // Read mode writes nothing.
 for(const bad of [[ids[0]], [ids[0],ids[0],ids[2]], [ids[0],ids[1],foreign], [ids[0],ids[1],null]]) await assert.rejects(rpc(bad,initial.snapshot),/article_order_ids_mismatch/);
 await assert.rejects(rpc(ids,'0'.repeat(32)),/article_order_stale/);
 const order=[ids[2],ids[0],ids[1]],changed=await rpc(order,initial.snapshot);
 assert.deepEqual(changed.articles.map(a=>a.id),order);assert.deepEqual(changed.articles.map(a=>a.sortOrder),[10,20,30]);assert.equal(changed.duplicate,false);
 assert.equal((await rpc(order,changed.snapshot)).duplicate,true);
 await assert.rejects(rpc(ids,initial.snapshot),/article_order_stale/); // Second writer must refresh.
 assert.deepEqual(await rows('select id,title,body,created_at from newsletter_articles order by id'),articles);
 assert.deepEqual(await rows('select * from newsletter_content_blocks'),blocks);assert.deepEqual(await rows('select * from newsletter_link_actions'),links);
 assert.equal((await rows('select sort_order from newsletter_articles where id=$1',[foreign]))[0].sort_order,0);
 await db.exec(`create function fail_order() returns trigger language plpgsql as $$begin if new.sort_order=20 then raise exception 'mid_failure';end if;return new;end$$;create trigger fail_reorder before update on newsletter_articles for each row execute function fail_order();`);
 await assert.rejects(rpc([order[1],order[2],order[0]],changed.snapshot),/mid_failure/);assert.equal((await rpc()).snapshot,changed.snapshot);
 await db.exec('drop trigger fail_reorder on newsletter_articles');
 const saved=async(id,sort,title)=>(await rows('select save_newsletter_article_atomic($1,$2,$3,$4) r',[p,id,{title,sort_order:sort,interest_tags:[],public_info:{},status:'draft'},[]]))[0].r;
 const created=await saved(null,0,'신규 기사');assert.equal(created.ok,true);
 assert.equal((await rows('select sort_order from newsletter_articles where id=$1',[created.article.id]))[0].sort_order,40);
 await saved(ids[2],999,'수정 기사');assert.equal((await rows('select sort_order from newsletter_articles where id=$1',[ids[2]]))[0].sort_order,10);
 await assert.rejects(rpc([...order,created.article.id],changed.snapshot),/article_order_stale/);
 const current=await rpc(),currentIds=current.articles.map(r=>r.id);
 const contenders=await Promise.allSettled([rpc([...currentIds].reverse(),current.snapshot),rpc([currentIds[1],currentIds[0],...currentIds.slice(2)],current.snapshot)]);
 assert.equal(contenders.filter(r=>r.status==='fulfilled').length,1);assert.equal(contenders.filter(r=>r.status==='rejected').length,1);
 const beforeDelete=await rpc();await db.query('delete from newsletter_articles where id=$1',[created.article.id]);
 await assert.rejects(rpc(beforeDelete.articles.map(r=>r.id),beforeDelete.snapshot),/article_order_stale/);
 const grants=await rows("select proname,has_function_privilege('service_role',oid,'EXECUTE') service,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated from pg_proc where proname in ('reorder_newsletter_articles_atomic','save_newsletter_article_atomic')");
 assert.equal(grants.length,2);for(const row of grants){assert.equal(row.service,true);assert.equal(row.anon,false);assert.equal(row.authenticated,false);}
 await db.exec("set request.jwt.claim.role='authenticated'");await assert.rejects(rpc(),/service_role_required/);
 }finally{await db.close();}
});
