/* eslint-disable @typescript-eslint/no-require-imports -- Isolated mock provider/DB/Storage, never remote keys. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const load=loader(),c=load('src/lib/hwaseong-marin-recovery-contract.ts'),engine=load('src/lib/hwaseong-marin-recovery-engine.ts');
const actor={id:'isolated-admin',role:'admin'},approval='approved local fixture only';
function mp3(){const bytes=Buffer.alloc(417*4,7);for(let i=0;i<4;i++){bytes[i*417]=255;bytes[i*417+1]=251;bytes[i*417+2]=144;bytes[i*417+3]=0;}return bytes;}
function parent(){return {id:c.marinParentId,project_id:c.marinProjectId,article_id:null,title:'[시연 TTS v1] 음질 비교 marin',pronunciation_note:null,duration_seconds:null,created_at:'2026-10-25T06:18:52.579765+00:00',updated_at:'2026-10-25T06:18:52.579765+00:00',source_type:'ai_tts',transcript_type:'custom_script',script_status:'pending',ai_tts_generated_at:null,ai_tts_voice:'marin',ai_tts_model:'gpt-4o-mini-tts',ai_tts_text_hash:c.marinRequestHash,script_text:'화성의 오늘을 더 가까이. 생활과 관광, 문화와 사람을 잇는 모바일 소식지입니다. 글자를 키우고, 편안한 속도로 소식을 들어 보세요.',file_path:c.marinOriginalPath,ai_tts_audio_paths:[c.marinOriginalPath]};}
function fixture(){
 const p=parent(),before=JSON.stringify(p),objects=new Map(),flags={},counts={claim:0,speech:0,put:0,complete:0};let row=null,token=null,child=null;
 const d={parent:async()=>structuredClone(p),receipt:async()=>row?structuredClone(row):null,
 object:async path=>{if(flags.readLoss)throw Error('read uncertain');return objects.get(path)??null;},
 claim:async(_actor,snapshot,t)=>{counts.claim++;if(row)return {won:false,receipt:structuredClone(row)};assert.equal(JSON.stringify(snapshot),before);token=t;child={id:c.marinAudioId,status:'pending'};row={parent_id:c.marinParentId,project_id:c.marinProjectId,audio_id:c.marinAudioId,request_key:c.marinAttemptKey,phase:'reserved',path:c.marinPath,byte_hash:null,byte_size:null,duration_seconds:null,provider_status:null,provider_request_id:null,last_error:null};if(flags.claimLoss)throw Error('claim committed, response lost');return {won:true,receipt:structuredClone(row)};},
 record:async(_actor,t,proof,status,id,error)=>{assert.equal(t,token);if(proof){row={...row,phase:'output_verified',byte_hash:proof.hash,byte_size:proof.size,duration_seconds:proof.duration,provider_status:status,provider_request_id:id};if(flags.recordLoss)throw Error('proof response lost');}else if(row.phase==='reserved'){row={...row,phase:'unknown',last_error:error,provider_status:status,provider_request_id:id};}return structuredClone(row);},
 complete:async(_actor,proof)=>{counts.complete++;if(flags.commitFail)throw Error('DB unavailable');assert.equal(JSON.stringify(p),before);assert.equal(proof.hash,row.byte_hash);row.phase='ready';child.status='approved';if(flags.commitLoss)throw Error('DB committed, response lost');return structuredClone(row);},
 speech:async()=>{counts.speech++;assert(row&&child);assert.equal(row.phase,'reserved');assert.equal(child.status,'pending');if(flags.providerThrow)throw Error('provider response lost');if(flags.providerFail)return {ok:false,httpStatus:401,providerRequestId:'req_fixture'};const bytes=flags.badMp3?Buffer.from('ID3 invalid'):mp3();return {ok:true,httpStatus:200,providerRequestId:'req_fixture',data:Uint8Array.from(bytes).buffer};},
 put:async(path,bytes)=>{counts.put++;assert.equal(row.phase,'output_verified');assert.equal(path,c.marinPath);assert(!objects.has(path));objects.set(path,flags.corrupt?Buffer.from('damaged'):bytes);if(flags.uploadLoss)throw Error('stored, response lost');},
 };
 return {d,p,before,objects,flags,counts,get row(){return row;},get child(){return child;}};
}
test('complete recovery reserves first, creates one new immutable file, keeps original pending and records provider receipt',async()=>{const f=fixture(),r=await engine.executeMarinRecovery(f.d,actor,approval);assert.equal(r.state,'ready');assert.equal(r.calls,1);assert.equal(f.counts.speech,1);assert.equal(f.objects.size,1);assert(f.objects.has(c.marinPath));assert.equal(JSON.stringify(f.p),f.before);assert.equal(f.p.script_status,'pending');assert.equal(f.row.provider_request_id,'req_fixture');assert.equal(f.child.status,'approved');});
test('parallel requests have only one winning claim and one provider invocation',async()=>{const f=fixture();await Promise.all(Array.from({length:8},()=>engine.executeMarinRecovery(f.d,actor,approval)));assert.equal(f.counts.speech,1);assert.equal(f.counts.put,1);assert.equal(f.row.phase,'ready');});
test('claim commits but response is lost: repeat and reconcile never call provider or clear the reservation',async()=>{const f=fixture();f.flags.claimLoss=true;assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'unknown');assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'unknown');assert.equal((await engine.reconcileMarinRecovery(f.d,actor)).state,'unknown');assert.equal(f.row.phase,'reserved');assert.equal(f.counts.speech,0);assert.equal(f.objects.size,0);});
for(const failure of ['providerFail','providerThrow','badMp3'])test(`${failure}: immutable failed attempt cannot dispatch again`,async()=>{const f=fixture();f.flags[failure]=true;const a=await engine.executeMarinRecovery(f.d,actor,approval);assert.equal(a.state,'unknown');await engine.executeMarinRecovery(f.d,actor,approval);await engine.reconcileMarinRecovery(f.d,actor);assert.equal(f.counts.speech,1);assert.equal(f.row.phase,'unknown');assert.equal(f.child.status,'pending');assert.equal(f.objects.size,0);assert.equal(JSON.stringify(f.p),f.before);});
test('proof DB response loss prevents upload; journaled hash alone does not mean an existing file',async()=>{const f=fixture();f.flags.recordLoss=true;await engine.executeMarinRecovery(f.d,actor,approval);assert.equal(f.row.phase,'output_verified');assert.equal(f.objects.size,0);await engine.executeMarinRecovery(f.d,actor,approval);assert.equal((await engine.reconcileMarinRecovery(f.d,actor)).state,'unknown');assert.equal(f.counts.speech,1);});
test('Storage success with lost response verifies saved bytes instead of uploading or generating twice',async()=>{const f=fixture();f.flags.uploadLoss=true;assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'ready');assert.equal(f.counts.put,1);assert.equal(f.counts.speech,1);});
test('Storage success / DB complete failure is recoverable by explicit reconcile without a speech/put call',async()=>{const f=fixture();f.flags.commitFail=true;assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'unknown');assert.equal(f.row.phase,'output_verified');assert.equal(f.child.status,'pending');await engine.executeMarinRecovery(f.d,actor,approval);f.flags.commitFail=false;assert.equal((await engine.reconcileMarinRecovery(f.d,actor)).state,'ready');assert.equal(f.counts.speech,1);assert.equal(f.counts.put,1);});
test('commit response loss reuses the same ready receipt on explicit reconcile',async()=>{const f=fixture();f.flags.commitLoss=true;assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'unknown');assert.equal(f.row.phase,'ready');f.flags.commitLoss=false;assert.equal((await engine.reconcileMarinRecovery(f.d,actor)).state,'ready');assert.equal(f.counts.speech,1);});
test('corrupt/truncated stored MP3, or valid framing with changed payload hash, never completes',async()=>{for(const mode of ['corrupt','payload']){const f=fixture();f.flags.commitFail=true;await engine.executeMarinRecovery(f.d,actor,approval);f.flags.commitFail=false;if(mode==='corrupt')f.objects.set(c.marinPath,Buffer.from('wrong'));else{const x=Buffer.from(f.objects.get(c.marinPath));x[10]^=1;f.objects.set(c.marinPath,x);}assert.equal((await engine.reconcileMarinRecovery(f.d,actor)).state,'unknown');assert.equal(f.row.phase,'output_verified');assert.equal(f.child.status,'pending');assert.equal(f.counts.speech,1);}});
test('pre-existing object or uncertain object read blocks claim, and changed parent blocks dispatch',async()=>{for(const mode of ['old','new','uncertain','parent']){const f=fixture();if(mode==='old')f.objects.set(c.marinOriginalPath,mp3());if(mode==='new')f.objects.set(c.marinPath,mp3());if(mode==='uncertain')f.flags.readLoss=true;if(mode==='parent')f.p.ai_tts_voice='cedar';assert.notEqual((await engine.executeMarinRecovery(f.d,actor,approval)).state,'ready');assert.equal(f.counts.claim,0);assert.equal(f.counts.speech,0);}});
test('engine requires admin actor and explicit execution approval before any I/O',async()=>{for(const [who,ref] of [[{id:'writer',role:'user'},approval],[actor,''],[{id:'',role:'admin'},approval]]){const f=fixture();assert.equal((await engine.executeMarinRecovery(f.d,who,ref)).state,'rejected');assert.equal(f.counts.claim,0);assert.equal(f.counts.speech,0);}});
test('MP3 framing checks inspect the entire bounded stream and preserve raw-byte SHA256',()=>{const bytes=mp3(),p=c.inspectMarinMp3(bytes);assert.equal(p.hash,c.bytesHash(bytes));assert.equal(p.size,bytes.length);assert.equal(p.duration,1);for(const b of [bytes.subarray(0,bytes.length-1),Buffer.alloc(200),Buffer.from('ID3'),Buffer.alloc(c.marinMaxBytes+1)])assert.throws(()=>c.inspectMarinMp3(b));});
test('offline-generated non-speech MP3 fixture passes framing; truncated real bytes fail',()=>{const bytes=require('node:fs').readFileSync('tests/fixtures/marin-recovery-tone.mp3');assert.equal(c.inspectMarinMp3(bytes).hash,c.bytesHash(bytes));assert.throws(()=>c.inspectMarinMp3(bytes.subarray(0,bytes.length-1)));});
test('production contract matches reviewed attempt key, not a new random identity',()=>{const prep=load('experiments/hwaseong-tts-recovery/contract.ts');assert.equal(c.marinParentId,prep.recoveryParentId);assert.equal(c.marinScriptHash,prep.recoveryScriptSha256);assert.equal(c.marinRequestHash,prep.recoveryRequestHash);assert.notEqual(c.marinAudioId,c.marinParentId);assert(!c.marinPath.includes('/sample-tts-v1/'));});

test('recovery route rejects OFF, wrong domain/project, unauthenticated, nonadmin, project mismatch and cross-origin before execution',async()=>{for(const mode of ['off','domain','slug','unauthorized','nonadmin','project','origin']){let calls=0;const route=loader({'@/lib/staging-environment':{stagingRequestAllowed:()=>mode!=='domain'},'@/lib/project-api-access':{requireProjectApiAccess:async()=>mode==='unauthorized'?{ok:false,response:new Response(null,{status:401})}:{ok:true,project:{id:mode==='project'?'other':c.marinProjectId},user:{id:'admin',role:mode==='nonadmin'?'user':'admin'}}},'@/lib/canva-request-origin':{requireCanvaSameOrigin:()=>{if(mode==='origin')throw Error();}},'@/lib/hwaseong-marin-recovery-server':{marinRecoveryEnabled:()=>mode!=='off',runMarinRecovery:()=>{calls++;},finishMarinRecovery:()=>{calls++;},marinRecoveryStatus:()=>{calls++;}}})('src/app/api/projects/[projectId]/sample-tts/recovery/route.ts');const request=new Request('https://staging.invalid',{method:'POST',body:JSON.stringify({action:'execute',parentId:c.marinParentId,requestKey:c.marinAttemptKey,approvalReference:approval,acknowledgeUnknownPriorCost:true,confirmPriorInvocationFinished:true})});const r=await route.POST(request,{params:Promise.resolve({projectId:mode==='slug'?'other':'hwaseong-2026-10-samples'})});assert.equal(r.status,['off','domain','slug'].includes(mode)?404:mode==='unauthorized'?401:403);assert.equal(calls,0);}});
test('GET is status only; POST requires stable parent/key and acknowledgements; reconcile is explicit and speech-free',async()=>{let executes=0,reconciles=0,reads=0;const route=loader({'@/lib/staging-environment':{stagingRequestAllowed:()=>true},'@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:true,project:{id:c.marinProjectId},user:actor})},'@/lib/canva-request-origin':{requireCanvaSameOrigin:()=>{}},'@/lib/hwaseong-marin-recovery-server':{marinRecoveryEnabled:()=>true,marinRecoveryStatus:async()=>{reads++;return {receipt:null};},runMarinRecovery:async()=>{executes++;return {};},finishMarinRecovery:async()=>{reconciles++;return {};}}})('src/app/api/projects/[projectId]/sample-tts/recovery/route.ts'),ctx={params:Promise.resolve({projectId:'hwaseong-2026-10-samples'})};const post=body=>route.POST(new Request('https://staging.invalid',{method:'POST',body:JSON.stringify(body)}),ctx);assert.equal((await route.GET(new Request('https://staging.invalid'),ctx)).status,200);assert.equal(reads,1);assert.equal(executes,0);const valid={action:'execute',parentId:c.marinParentId,requestKey:c.marinAttemptKey,approvalReference:approval,acknowledgeUnknownPriorCost:true,confirmPriorInvocationFinished:true};for(const patch of [{requestKey:'other'},{parentId:'other'},{acknowledgeUnknownPriorCost:false},{confirmPriorInvocationFinished:false},{approvalReference:''}])assert.equal((await post({...valid,...patch})).status,400);assert.equal(executes,0);assert.equal((await post(valid)).status,200);assert.equal(executes,1);assert.equal((await post({...valid,action:'reconcile'})).status,200);assert.equal(executes,1);assert.equal(reconciles,1);});

test('paired OFF check requires existing authenticated status 200, then recovery GET 404 without DB/Storage/provider I/O',async()=>{
 let accessCalls=0,statusCalls=0,external=0;
 const common={'@/lib/staging-environment':{stagingRequestAllowed:()=>true},'@/lib/project-api-access':{requireProjectApiAccess:async()=>{accessCalls++;return {ok:true,project:{id:c.marinProjectId},user:actor};}},'@/lib/hwaseong-sample-tts-server':{sampleProjectId:c.marinProjectId,sampleTtsStatus:async()=>{statusCalls++;return {plans:[]};}},'@/lib/hwaseong-marin-recovery-server':{marinRecoveryEnabled:()=>false,marinRecoveryStatus:async()=>{external++;throw Error();}}};
 const load=loader(common),existing=load('src/app/api/projects/[projectId]/sample-tts/route.ts'),recovery=load('src/app/api/projects/[projectId]/sample-tts/recovery/route.ts'),ctx={params:Promise.resolve({projectId:'hwaseong-2026-10-samples'})};
 const base='https://canva-staging.datadiction.co.kr/api/projects/hwaseong-2026-10-samples/sample-tts';assert.equal((await existing.GET(new Request(base),ctx)).status,200);assert.equal(accessCalls,1);assert.equal((await recovery.GET(new Request(base+'/recovery'),ctx)).status,404);assert.equal(statusCalls,1);assert.equal(external,0);
});

const diagnosticsModule=load('src/lib/tts-request-diagnostics.ts');
function diagnosticFixture() {
 const f=fixture(),events=[];let at=0;
 f.d.diagnostics=diagnosticsModule.createTtsDiagnostics(event=>events.push(event),()=>at+=5);
 return {...f,base:f,events};
}
test('mock speech success traces headers, MP3 verification, Storage and DB completion in order',async()=>{
 const f=diagnosticFixture(),old=global.fetch;
 try {
  let posts=0;
  global.fetch=async(_url,init)=>{posts++;assert.equal(init.headers['X-Client-Request-Id'],f.d.diagnostics.clientRequestId);return new Response(mp3(),{headers:{'x-request-id':'req_pipeline'}});};
  const speech=load('src/lib/article-tts-audio.ts').requestOpenAiSpeech;
  f.d.speech=(text,diagnostics)=>speech(text,'marin','gpt-4o-mini-tts',{apiKey:'mock-only',captureReceipt:true,maxBytes:c.marinMaxBytes,diagnostics});
  assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'ready');
  const completed=f.events.filter(e=>e.state==='completed').map(e=>e.phase);
  assert.deepEqual(completed,['db_claim','headers','body','request','validation','db_record','storage','storage_verification','db_complete']);
  assert.equal(posts,1);assert.equal(f.base.row.provider_request_id,'req_pipeline');
  assert.equal(JSON.stringify(f.p),f.before);
  assert(!JSON.stringify(f.events).includes(f.p.script_text));assert(!JSON.stringify(f.events).includes('mock-only'));
 } finally {global.fetch=old;}
});
for(const [failure,error] of [['body_read',new TypeError('private interrupted body')],['timeout',new DOMException('private timeout','TimeoutError')]]) {
 test(`${failure} after headers persists receipt in existing unknown journal and cannot regenerate`,async()=>{
  const f=diagnosticFixture(),old=global.fetch;let posts=0;
  try {
   global.fetch=async()=>{posts++;return new Response(new ReadableStream({start(controller){controller.error(error);}}),{headers:{'x-request-id':'req_before_body_loss'}});};
   const speech=load('src/lib/article-tts-audio.ts').requestOpenAiSpeech;
   f.d.speech=(text,diagnostics)=>speech(text,'marin','gpt-4o-mini-tts',{apiKey:'mock-only',captureReceipt:true,maxBytes:c.marinMaxBytes,diagnostics});
   const result=await engine.executeMarinRecovery(f.d,actor,approval);
   assert.equal(result.code,'query_same_attempt_no_retry');assert.equal(result.state,'unknown');
   assert.equal(f.base.row.phase,'unknown');assert.equal(f.base.row.last_error,'provider_unknown');
   assert.equal(f.base.row.provider_status,200);assert.equal(f.base.row.provider_request_id,'req_before_body_loss');
   assert(f.events.some(e=>e.phase==='body'&&e.state==='failed'&&e.failure===failure));
   const snapshot=JSON.stringify(f.base.row);
   assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).calls,0);
   assert.equal((await engine.reconcileMarinRecovery(f.d,actor)).state,'unknown');
   assert.equal(JSON.stringify(f.base.row),snapshot);assert.equal(posts,1);assert.equal(f.counts.put,0);assert.equal(f.objects.size,0);
   assert.equal(JSON.stringify(f.p),f.before);
  } finally {global.fetch=old;}
 });
}
test('response loss before provider headers leaves null receipt and retains duplicate lock',async()=>{
 const f=diagnosticFixture(),old=global.fetch;let posts=0;
 try {
  global.fetch=async()=>{posts++;throw TypeError('private network details');};
  const speech=load('src/lib/article-tts-audio.ts').requestOpenAiSpeech;
  f.d.speech=(text,diagnostics)=>speech(text,'marin','gpt-4o-mini-tts',{apiKey:'mock-only',captureReceipt:true,diagnostics});
  assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'unknown');
  assert.equal(f.base.row.provider_status,null);assert.equal(f.base.row.provider_request_id,null);
  assert(f.events.some(e=>e.phase==='headers'&&e.failure==='network'));
  await engine.executeMarinRecovery(f.d,actor,approval);assert.equal(posts,1);assert.equal(f.counts.put,0);
 } finally {global.fetch=old;}
});
test('Storage response loss is visible but verified bytes can still complete without re-upload',async()=>{
 const f=diagnosticFixture();f.flags.uploadLoss=true;
 assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'ready');
 assert(f.events.some(e=>e.phase==='storage'&&e.state==='failed'));
 assert(f.events.some(e=>e.phase==='storage_verification'&&e.state==='completed'));
 assert(f.events.some(e=>e.phase==='db_complete'&&e.state==='completed'));
 assert.equal(f.counts.speech,1);assert.equal(f.counts.put,1);
});
test('DB completion response loss is logged at DB stage and does not erase ready receipt',async()=>{
 const f=diagnosticFixture();f.flags.commitLoss=true;
 assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'unknown');
 assert.equal(f.base.row.phase,'ready');assert(f.events.some(e=>e.phase==='db_complete'&&e.state==='failed'));
 f.flags.commitLoss=false;
 assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).calls,0);
 assert.equal(f.counts.speech,1);assert.equal(f.counts.put,1);
});
test('proof response loss and invalid MP3 identify their own stages',async()=>{
 for(const [flag,phase] of [['recordLoss','db_record'],['badMp3','validation']]) {
  const f=diagnosticFixture();f.flags[flag]=true;
  assert.equal((await engine.executeMarinRecovery(f.d,actor,approval)).state,'unknown');
  assert(f.events.some(e=>e.phase===phase&&e.state==='failed'));assert.equal(f.counts.put,0);
  await engine.executeMarinRecovery(f.d,actor,approval);assert.equal(f.counts.speech,1);
 }
});
