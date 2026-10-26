/* eslint-disable @typescript-eslint/no-require-imports -- Local isolated PostgreSQL only. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {randomBytes}=require('node:crypto'),{pathToFileURL}=require('node:url');
module.exports=async function createDatabase(runtime) {
 const {default:EmbeddedPostgres}=await import(pathToFileURL(path.join(runtime,'embedded-postgres/dist/index.js')).href);
 const {Client}=require(path.join(runtime,'pg'));
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mns-b1-')),password=randomBytes(24).toString('hex');
 const server=new EmbeddedPostgres({databaseDir:path.join(directory,'db'),port,user:'postgres',password,persistent:false,postgresFlags:['-h','127.0.0.1','-k',directory],onLog(){},onError(){}});
 const clients=[];await server.initialise();await server.start();
 const connect=async database=>{const c=new Client({host:'127.0.0.1',port,user:'postgres',password,database});await c.connect();clients.push(c);await c.query("set statement_timeout='8s';set lock_timeout='5s';set timezone='UTC';set request.jwt.claim.role='service_role';set newsletter.b1_isolated='on'");return c;};
 const close=async()=>{for(const c of clients){try{await c.query('rollback');await c.end();}catch{}}await server.stop();fs.rmSync(directory,{recursive:true,force:true});};
 try {
  const root=await connect('postgres');await root.query('create role anon;create role authenticated;create role service_role bypassrls');
  const database='mns_b1_'+randomBytes(4).toString('hex');await root.query('create database '+database);
  const db=await connect(database);
  // Minimal faithful prerequisite fixture; not a claim of full remote schema parity.
  const textColumns='title display_title summary body text_alignment title_alignment summary_alignment body_alignment article_type urgency publication_kind audio_source article_tts_voice contact_name contact_phone motion_preset motion_speed title_motion_effect title_motion_speed text_box_motion_effect text_box_motion_speed image_motion_effect image_motion_speed link_motion_effect link_motion_speed status'.split(' ').map(c=>`${c} text`).join(',');
  await db.query(`create schema auth;create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
   create type project_status as enum('draft','in_review','published','private','archived');
   create type content_block_type as enum('paragraph','image','button_group');create type link_action_type as enum('url');create type link_display_style as enum('button');
   create table font_families(id uuid primary key,is_active boolean not null,webfont_allowed boolean not null);
   create table font_assets(id uuid primary key,family_id uuid references font_families(id) on delete set null,font_file_path text unique not null,font_file_format text not null,is_active boolean not null,webfont_allowed boolean not null);
   create table newsletter_projects(id uuid primary key,title text,slug text,assignee_name text,status project_status default 'draft',published_at timestamptz,deleted_at timestamptz,archived_at timestamptz,updated_at timestamptz default now(),
    title_font_asset_id uuid references font_assets(id) on delete set null,body_font_asset_id uuid references font_assets(id) on delete set null);
   create table newsletter_pages(id uuid primary key,project_id uuid);create table newsletter_surveys(id uuid primary key,project_id uuid);
   create table newsletter_assets(id uuid primary key,project_id uuid);
   create table newsletter_articles(id uuid primary key default gen_random_uuid(),project_id uuid references newsletter_projects(id) on delete cascade,
    page_id uuid,sort_order int not null default 0,${textColumns},interest_tags text[],institution_priority smallint,valid_from timestamptz,valid_until timestamptz,public_info jsonb,survey_id uuid,
    title_font_asset_id uuid references font_assets(id) on delete set null,body_font_asset_id uuid references font_assets(id) on delete set null,caption_font_asset_id uuid references font_assets(id) on delete set null,button_font_asset_id uuid references font_assets(id) on delete set null,
    updated_at timestamptz default now(),created_at timestamptz default now());
   create table newsletter_link_actions(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid references newsletter_articles(id) on delete cascade,
    label text,action_type link_action_type,target_value text,display_style link_display_style,sort_order int,is_visible boolean);
   create table newsletter_content_blocks(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid references newsletter_articles(id) on delete cascade,
    block_type content_block_type,title text,body text,text_alignment text,asset_id uuid,link_action_id uuid,sort_order int,metadata jsonb,is_visible boolean);
   create table newsletter_project_design_assets(id uuid primary key,project_id uuid references newsletter_projects(id) on delete cascade,asset_type text,storage_bucket text,storage_path text,mime_type text,is_active boolean,approval_status text);
   create table newsletter_audio_files(id uuid primary key,project_id uuid,article_id uuid);
   grant usage on schema public to service_role,anon,authenticated;`);
  for(const f of ['schema_v1_21_article_transactions.sql','schema_v1_38_article_order_atomic.sql','schema_v1_25_article_compositions.sql','schema_v1_26_composition_asset_delete_integrity.sql','schema_v1_27_article_composition_copy.sql','schema_v1_28_article_composition_batch_copy.sql'])await db.query(fs.readFileSync(path.join('supabase',f),'utf8'));
  return {db,root,second:await connect(database),observer:await connect(database),connect:()=>connect(database),close};
 } catch(e) {await close();throw e;}
};
