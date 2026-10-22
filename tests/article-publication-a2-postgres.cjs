/* eslint-disable @typescript-eslint/no-require-imports -- Local PostgreSQL fixture, no remote URLs or credentials. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {randomBytes}=require('node:crypto'),{pathToFileURL}=require('node:url');
const priorFiles = ['supabase/schema_v1_21_article_transactions.sql', 'supabase/schema_v1_38_article_order_atomic.sql',
  'supabase/schema_v1_29_client_review_workflow.sql', 'supabase/schema_v1_30_client_review_feedback.sql',
  'supabase/schema_v1_40_author_direct_publishing.sql'];

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


module.exports=async function createDatabase(runtime){
 const {default:EmbeddedPostgres}=await import(pathToFileURL(path.join(runtime,'embedded-postgres/dist/index.js')).href);
 const {Client}=require(path.join(runtime,'pg'));
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mns-a2-')),password=randomBytes(24).toString('hex');
 const server=new EmbeddedPostgres({databaseDir:path.join(directory,'db'),port,user:'postgres',password,persistent:false,postgresFlags:['-h','127.0.0.1','-k',directory],onLog(){},onError(){}});
 const clients=[];await server.initialise();await server.start();
 const connect=async database=>{const c=new Client({host:'127.0.0.1',port,user:'postgres',password,database});await c.connect();clients.push(c);await c.query("set statement_timeout='10s';set lock_timeout='6s';set timezone='UTC';set request.jwt.claim.role='service_role';set newsletter.a1_isolated_test='on'");return c;};
 try {
 const root=await connect('postgres');await root.query('create role anon;create role authenticated;create role service_role bypassrls');
 const database='mns_a1_a2_'+randomBytes(4).toString('hex');await root.query('create database '+database);
 const db=await connect(database);await fixture(db);
 await db.query(`alter table newsletter_articles add column audio_id uuid,add column ai_audio_id uuid;
 alter table newsletter_assets add column file_path text,add column mime_type text,add column is_approved boolean default false,add column storage_bucket text;
 create table newsletter_project_design_assets(id uuid primary key,project_id uuid,asset_type text,storage_bucket text,storage_path text,mime_type text,is_active boolean,approval_status text,updated_at timestamptz default now());
 create table font_families(id uuid primary key,css_family_name text,is_active boolean,webfont_allowed boolean);
 create table font_assets(id uuid primary key,family_id uuid,font_family text,font_file_path text,font_file_format text,font_weight text,font_style text,is_active boolean,webfont_allowed boolean,storage_bucket text,updated_at timestamptz default now());
 create table newsletter_audio_files(id uuid primary key,project_id uuid,article_id uuid,file_path text,script_text text,source_type text,script_status text,ai_tts_audio_paths jsonb,ai_tts_text_hash text,ai_tts_voice text,storage_bucket text,mime_type text,updated_at timestamptz default now());`);
 for(const name of ['schema_v1_41_article_independent_publication_a1.sql','schema_v1_42_article_publication_a2_isolated.sql'])await db.query(fs.readFileSync(path.join('supabase',name),'utf8'));
 return {db,second:await connect(database),observer:await connect(database),close:async()=>{for(const c of clients){try{await c.query('rollback');await c.end();}catch{}}await server.stop();fs.rmSync(directory,{recursive:true,force:true});}};
 }catch(e){for(const c of clients){try{await c.end();}catch{}}await server.stop();fs.rmSync(directory,{recursive:true,force:true});throw e;}
};
