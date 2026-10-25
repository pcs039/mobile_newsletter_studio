/* eslint-disable @typescript-eslint/no-require-imports -- Entire provider/DB/Storage transport is mocked. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
async function run(mode){
 const names=['OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'],saved=Object.fromEntries(names.map(n=>[n,process.env[n]])),oldFetch=global.fetch;
 Object.assign(process.env,{OPENAI_API_KEY:'mock-general',SUPABASE_SERVICE_ROLE_KEY:'mock-service'});
 const article={id:'article',project_id:'project',title:'본문',body:'실제 낭독 원문',summary:'',display_title:'',audio_id:null,audio_source:'ai_tts',ai_audio_id:'audio'},oldPath='ai-tts/project/article/old/000.mp3';
 let row={id:'audio',source_type:'ai_tts',transcript_type:'article_full',script_text:'',ai_tts_audio_paths:[oldPath]},calls=[];
 global.fetch=async(url,init={})=>{
  const u=new URL(url),method=init.method??'GET';calls.push({url,method,body:init.body});
  if(u.hostname==='api.openai.com'){assert.equal(init.headers.Authorization,'Bearer mock-general');return new Response(new Uint8Array([73,68,51,...Array(200).fill(7)]));}
  if(u.hostname==='storage.invalid')return new Response(null,{status:200});
  if(u.pathname.endsWith('newsletter_projects'))return Response.json([{id:'project',slug:'fixture'}]);
  if(u.pathname.endsWith('newsletter_content_blocks'))return Response.json([]);
  if(u.pathname.endsWith('newsletter_articles'))return method==='PATCH'?new Response(null,{status:mode==='article-failure'?503:200}):Response.json([article]);
  assert(u.pathname.endsWith('newsletter_audio_files'));
  if(method==='PATCH'){
   if(mode==='metadata-rejected')return new Response(null,{status:503});
   row={...row,...JSON.parse(init.body)};
   return Response.json(mode==='metadata-response-loss'?[]:[{id:'audio'}]);
  }
  if(u.searchParams.has('id'))return Response.json([row]);
  if(mode==='reference-read-failure')return new Response(null,{status:503});
  const target=u.searchParams.get('file_path')?.slice(3)??JSON.parse(u.searchParams.get('ai_tts_audio_paths').slice(3))[0];
  return Response.json(row.ai_tts_audio_paths.includes(target)||(mode==='shared-old'&&target===oldPath)?[{id:'referencing-row'}]:[]);
 };
 try{
  const m=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p,getSupabaseStorageEndpoint:p=>'https://storage.invalid'+p}})('src/lib/article-tts-audio.ts');
  const result=await m.generateArticleTtsAudio('fixture','article','marin',true);
  assert.equal(calls.filter(c=>c.url.startsWith('https://api.openai.com')).length,1);
  return {result,calls,oldPath};
 }finally{global.fetch=oldFetch;for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}}
}
test('general TTS metadata response loss and article link failure retain DB-referenced new segments',async()=>{for(const mode of ['metadata-response-loss','article-failure']){const {result,calls}=await run(mode);assert.equal(result.ok,false);assert(!calls.some(c=>c.method==='DELETE'));}});
test('general TTS cleanup retains shared old segments and unconfirmed reference reads',async()=>{for(const mode of ['shared-old','reference-read-failure']){const {result,calls}=await run(mode);assert.equal(result.ok,true);assert(!calls.some(c=>c.method==='DELETE'));}});
test('normal replacement deletes only unreferenced old bytes; rejected metadata permits unreferenced new-file cleanup',async()=>{for(const mode of ['normal','metadata-rejected']){const {result,calls,oldPath}=await run(mode);assert.equal(result.ok,mode==='normal');const removals=calls.filter(c=>c.method==='DELETE');assert.equal(removals.length,1);const paths=JSON.parse(removals[0].body).prefixes;assert.equal(paths.length,1);assert.equal(paths[0]===oldPath,mode==='normal');}});
