/* eslint-disable @typescript-eslint/no-require-imports -- Mock reference checks and Storage deletion only. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const p='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',file=`ai-tts/${p}/${a}/${'a'.repeat(64)}/000.mp3`;
async function fixture(mode){
 const old=global.fetch,calls=[];let deletes=0,metadataReads=0;
 global.fetch=async(url,init={})=>{calls.push(url);const u=new URL(url);if(init.method==='DELETE'){deletes++;return new Response(null,{status:mode==='deleteFail'?500:200});}
  if(mode==='uncertain')return new Response('',{status:503});
  if(u.pathname.endsWith('newsletter_audio_files'))metadataReads++;
  const matched=(mode==='shared'&&u.pathname.endsWith('newsletter_audio_files'))||(mode==='ebook'&&u.pathname.endsWith('newsletter_pages'))||(mode==='content'&&u.pathname.endsWith('newsletter_content_blocks'))||(mode==='newRef'&&metadataReads>=3&&u.pathname.endsWith('newsletter_audio_files'));
  return Response.json(matched?[{id:'other-project-reference'}]:[]);
 };
 const load=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p,getSupabaseStorageEndpoint:p=>'https://storage.invalid'+p}}),cleanup=load('src/lib/article-tts-cleanup.ts').cleanupReplacedArticleTts;
 try{const result=await cleanup(p,a,[file,file,'images/keep.png'],{apikey:'mock','Authorization':'Bearer mock'});return {result,calls,deletes};}finally{global.fetch=old;}
}
test('unreferenced retired ordinary TTS is deleted once, not images',async()=>{const r=await fixture('none');assert.equal(r.deletes,1);assert.equal(r.result.removed,1);assert.equal(r.result.retained,1);});
for(const mode of ['shared','ebook','content','newRef','uncertain','deleteFail'])test(`${mode} retains old bytes or tolerates cleanup failure`,async()=>{const r=await fixture(mode);assert.equal(r.result.removed,0);if(mode!=='deleteFail')assert.equal(r.deletes,0);assert(r.result.retained>=1);});
