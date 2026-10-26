/* eslint-disable @typescript-eslint/no-require-imports -- Mock Supabase/OpenAI transport; no real keys or network. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const p='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
function mp3(){const b=Buffer.alloc(1668,7);for(let i=0;i<4;i++)b.set([255,251,144,0],i*417);return b;}
async function fixture(mode,run){
 const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY,oldService=process.env.SUPABASE_SERVICE_ROLE_KEY,oldLog=console.info;
 process.env.OPENAI_API_KEY='fixture-only';process.env.SUPABASE_SERVICE_ROLE_KEY='service-fixture';console.info=()=>{};
 const paths=[],calls=[];let stored=false,ready=false,claims=0,provider=0;
 const load=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:s=>'https://db.invalid'+s,getSupabaseStorageEndpoint:s=>'https://storage.invalid'+s}});
 const shared=load('src/lib/article-tts-audio.ts');
 global.fetch=async(url,init={})=>{
  const u=new URL(url);calls.push({url,method:init.method||'GET'});
  if(u.hostname==='api.openai.com'){provider++;assert.equal(init.headers.Authorization,'Bearer fixture-only');assert(init.headers['X-Client-Request-Id']);assert.equal(JSON.parse(init.body).input,'본문');return new Response(mp3(),{headers:{'x-request-id':'req_mock'}});}
  if(u.hostname==='storage.invalid'){
   if(init.method==='POST'){assert.equal(init.headers['x-upsert'],'false');assert(!stored);stored=true;paths.push(u.pathname);return new Response(null,{status:200});}
   if(mode==='missing')return Response.json({statusCode:'404',message:'Object not found'},{status:400});
   if(mode==='denied')return new Response('',{status:403});
   return new Response(mp3(),{headers:{'Content-Type':'audio/mpeg'}});
  }
  if(u.pathname.includes('/rpc/')){
   const body=JSON.parse(init.body);assert.equal(body.p_actor_name,'writer');
   if(u.pathname.endsWith('article_tts_claim')){claims++;return Response.json({won:true,state:'processing',requestId:id,fingerprint:'f'.repeat(64),article:{id:a,project_id:p,body:'본문'},blocks:[]});}
   if(u.pathname.endsWith('article_tts_complete')){assert(stored);assert.equal(body.p_segments[0].size,1668);ready=true;return Response.json({ok:true,state:'ready',audioId:id,segments:1,cleanupPaths:[]});}
   return Response.json({state:'unknown'});
  }
  if(u.pathname.endsWith('newsletter_articles')){
   if(mode==='unapplied')return new Response('column does not exist 42703',{status:400});
   return Response.json([{id:a,project_id:p,body:'본문',article_tts_voice:'marin',audio_source:'ai_tts',ai_audio_id:mode==='normal'?null:'old',tts_request_id:ready?id:null,tts_generation_state:ready?'ready':null,tts_started_at:null}]);
  }
  if(u.pathname.endsWith('newsletter_projects'))return Response.json([{article_tts_voice:'marin'}]);
  if(u.pathname.endsWith('newsletter_content_blocks'))return Response.json([]);
  if(u.pathname.endsWith('newsletter_audio_files'))return Response.json([{id:'old',project_id:p,source_type:'ai_tts',ai_tts_text_hash:shared.hashNarrationText('본문'),ai_tts_voice:'marin',ai_tts_model:'gpt-4o-mini-tts',ai_tts_audio_paths:[`ai-tts/${p}/${a}/${'a'.repeat(64)}/000.mp3`],ai_tts_generated_at:'2026-01-01'}]);
  throw Error('unexpected request');
 };
 try{await run(load('src/lib/article-tts-server.ts'),()=>({claims,provider,paths,calls,ready}));}
 finally{global.fetch=oldFetch;console.info=oldLog;for(const [key,value] of [['OPENAI_API_KEY',oldKey],['SUPABASE_SERVICE_ROLE_KEY',oldService]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
const input={requestId:id,previousRequestId:null,force:false,voice:'marin'},actor={id:'writer-id',name:'writer',role:'user'};
test('wired normal attempt has one provider call, unique non-upsert upload, verified bytes and atomic completion',()=>fixture('normal',async(m,count)=>{const r=await m.generateSafeArticleTts(p,a,actor,input);assert.equal(r.state,'ready');assert.equal(count().provider,1);assert.equal(count().claims,1);assert(count().paths[0].endsWith(`/${id}/000.mp3`));assert(count().ready);}));
test('existing normal bytes are read and reused without provider or metadata writes',()=>fixture('current',async(m,count)=>{const r=await m.generateSafeArticleTts(p,a,actor,input);assert(r.reused);assert.equal(count().provider,0);assert(count().calls.every(c=>c.method==='GET'));}));
test('missing/denied file checks are distinct and do not call provider on GET',async()=>{for(const mode of ['missing','denied'])await fixture(mode,async(m,count)=>{const s=await m.articleTtsStatus(p,a);assert.equal(s.current,false);assert.equal(s.audioState,mode==='missing'?'missing':'unconfirmed');assert.equal(count().provider,0);});});
test('missing migration fails closed without provider/Storage mutation',()=>fixture('unapplied',async(m,count)=>{await assert.rejects(m.generateSafeArticleTts(p,a,actor,input),e=>e.code==='schema_not_ready');assert.equal(count().provider,0);assert(count().calls.every(c=>c.method==='GET'));}));
test('explicit regeneration overrides reuse but never overwrites old file path',()=>fixture('current',async(m,count)=>{assert.equal((await m.generateSafeArticleTts(p,a,actor,{...input,force:true})).state,'ready');assert.equal(count().provider,1);assert(!count().paths[0].includes('/'+ 'a'.repeat(64)+'/'));}));
test('unsaved voice mismatch rejects without paid request',()=>fixture('normal',async(m,count)=>{await assert.rejects(m.generateSafeArticleTts(p,a,actor,{...input,voice:'cedar'}),e=>e.code==='settings_changed');assert.equal(count().provider,0);}));
