/* eslint-disable @typescript-eslint/no-require-imports -- In-memory DB/Storage and mocked speech; no network/keys. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const load=loader(),{executeArticleTts}=load('src/lib/article-tts-job.ts'),{createTtsDiagnostics}=load('src/lib/tts-request-diagnostics.ts');
const p='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const input={requestId:id,previousRequestId:null,force:false,voice:'marin'};
function mp3(){const b=Buffer.alloc(1668,7);for(let i=0;i<4;i++)b.set([255,251,144,0],i*417);return b;}
function fixture(){
 const objects=new Map([['old-path',Buffer.from('old bytes')]]),oldAudio={id:'old',file:'old-path'},events=[],flags={};let link='old',state='idle',requestId=null;
 const count={speech:0,claim:0,put:0,complete:0,finish:0,cleanup:0};
 const d={
  status:async()=>({state,requestId,current:!!flags.current,audioId:link,audioState:flags.unconfirmed?'unconfirmed':flags.current||flags.oldPlayable?'present':'missing'}),
  claim:async(i)=>{count.claim++;if(requestId)return {won:false,state,requestId};requestId=i.requestId;state='processing';if(flags.claimLoss)throw Error('commit lost');return {won:true,state,requestId,fingerprint:'f'.repeat(64),article:{id:a,project_id:p,body:'원문'},blocks:[]};},
  speech:async(text,diagnostics,timeout)=>{count.speech++;assert.equal(state,'processing');assert.equal(text,'원문');assert(timeout>0&&timeout<=90000);diagnostics.start('request');if(flags.speechLoss)throw TypeError('unconfirmed provider');if(flags.rejected)return {ok:false,httpStatus:401};return {ok:true,httpStatus:200,data:Uint8Array.from(flags.badMp3?Buffer.from('bad'):mp3()).buffer};},
  put:async(path,bytes)=>{count.put++;assert(path.includes('/'+id+'/'));assert(!objects.has(path));if(flags.uploadFail)throw Error('upload failed');objects.set(path,bytes);if(flags.uploadLoss)throw Error('response lost');},
  object:async(path)=>{if(flags.readFail)throw Error('read failed');return objects.get(path)??null;},
  complete:async(_i,_snapshot,_hash,parts)=>{count.complete++;assert(parts.every(part=>objects.has(part.path)));if(flags.dbFail)throw Error('DB failed');if(flags.sourceChanged){state='failed';return {ok:false,state,code:'source_changed'};}link=id;state='ready';if(flags.commitLoss)throw Error('committed, response lost');return {ok:true,state,audioId:link,segments:parts.length,cleanupPaths:['old-path']};},
  finish:async(_id,next)=>{count.finish++;if(state==='processing')state=next;},
  cleanup:async()=>{count.cleanup++;assert.equal(state,'ready');assert.equal(link,id);if(flags.cleanupFail)throw Error('cleanup failed');objects.delete('old-path');},
  diagnostics:()=>createTtsDiagnostics(e=>events.push(e)),
 };
 return {d,flags,count,objects,oldAudio,get link(){return link;},get state(){return state;},get requestId(){return requestId;}};
}
test('normal generation verifies new bytes, links first and then cleans old file',async()=>{
 const f=fixture(),r=await executeArticleTts(f.d,p,a,input);assert.equal(r.state,'ready');assert.equal(f.link,id);assert.equal(f.count.speech,1);assert.equal(f.count.cleanup,1);assert(!f.objects.has('old-path'));assert.deepEqual(f.oldAudio,{id:'old',file:'old-path'});
});
test('existing verified audio is reused without claim/provider/write',async()=>{const f=fixture();f.flags.current=true;const r=await executeArticleTts(f.d,p,a,input);assert(r.reused);assert.equal(f.count.claim,0);assert.equal(f.count.speech,0);assert.equal(f.count.cleanup,0);});
test('explicit regeneration does not reuse current audio and uses an attempt-specific new path',async()=>{const f=fixture();f.flags.current=true;assert.equal((await executeArticleTts(f.d,p,a,{...input,force:true})).state,'ready');assert.equal(f.count.speech,1);assert([...f.objects.keys()].some(path=>path.includes('/'+id+'/000.mp3')));});
test('concurrent identical calls have one dispatch owner',async()=>{const f=fixture();await Promise.all(Array.from({length:8},()=>executeArticleTts(f.d,p,a,input)));assert.equal(f.count.speech,1);assert.equal(f.count.put,1);});
for(const flag of ['claimLoss','speechLoss','rejected','badMp3','uploadFail','readFail','dbFail','sourceChanged'])test(`${flag}: old audio/link survives and automatic retry is absent`,async()=>{
 const f=fixture();f.flags[flag]=true;const r=await executeArticleTts(f.d,p,a,input);assert(!r.ok);assert.equal(f.link,'old');assert(f.objects.has('old-path'));assert.equal(f.count.cleanup,0);const calls=f.count.speech;await executeArticleTts(f.d,p,a,input);assert.equal(f.count.speech,calls);
});
test('successful upload with lost response is read/verified and not uploaded again',async()=>{const f=fixture();f.flags.uploadLoss=true;assert.equal((await executeArticleTts(f.d,p,a,input)).state,'ready');assert.equal(f.count.put,1);assert.equal(f.count.speech,1);});
test('complete commit response loss preserves new link and old file; GET observes completion',async()=>{const f=fixture();f.flags.commitLoss=true;assert.equal((await executeArticleTts(f.d,p,a,input)).state,'unknown');assert.equal(f.link,id);assert(f.objects.has('old-path'));assert.equal(f.count.finish,0);assert.equal(f.count.cleanup,0);f.flags.current=true;assert.equal((await executeArticleTts(f.d,p,a,input)).state,'ready');assert.equal(f.count.speech,1);});
test('cleanup failure cannot turn successful generation into failure or remove new data',async()=>{const f=fixture();f.flags.cleanupFail=true;assert.equal((await executeArticleTts(f.d,p,a,input)).state,'ready');assert.equal(f.link,id);assert(f.objects.has('old-path'));assert.equal(f.objects.size,2);});
test('unconfirmed existing file check does not start a provider request',async()=>{const f=fixture();f.flags.unconfirmed=true;assert.equal((await executeArticleTts(f.d,p,a,input)).code,'audio_check_unconfirmed');assert.equal(f.count.speech,0);});

test('playable old audio with changed text requires explicit regeneration before paid dispatch',async()=>{const f=fixture();f.flags.oldPlayable=true;const r=await executeArticleTts(f.d,p,a,input);assert.equal(r.code,'explicit_regeneration_required');assert.equal(f.count.claim,0);assert.equal(f.count.speech,0);assert.equal(f.link,'old');});
