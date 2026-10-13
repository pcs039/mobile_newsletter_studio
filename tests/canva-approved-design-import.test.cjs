/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server route contract tests. */
const test=require('node:test'), assert=require('node:assert/strict'), loader=require('./canva-test-loader.cjs');
const base=loader(), {digest,CanvaConnectError}=base('src/lib/canva-connect-contract.ts');
const {buildCanonicalCanvaAutofillPayload:build}=base('src/lib/canva-autofill-payload.ts');
const values=require('./fixtures/canva-content-fit-calibration.json').samples.short.values;
const articleId='11111111-1111-4111-8111-111111111111', templateId='event_festival_02';
function fixture(options={}) {
 let article={id:articleId,title:values.TITLE,summary:values.EVENT_SUMMARY,body:'unchanged source',articleType:'event_festival',blocks:[],links:[{id:'cta',isVisible:true,label:values.CTA}],publicInfo:{dateTime:values.EVENT_DATE,place:values.EVENT_PLACE}};
 const project={id:'project',slug:'fixture',title:'project',issue:'issue'};
 const upload={sourceAssetId:'asset',sourceHash:'a'.repeat(64),assetId:'IMAGE',status:'success',jobId:'upload'};
 const prepared=build({templateId,project,article,images:[{field:'MAIN_IMAGE',sourceHash:upload.sourceHash,upload,asset:{id:'asset',projectId:project.id,approvalStatus:'approved',isActive:true,mimeType:'image/png'}}]});
 assert(prepared.isReady);
 let row={execution:{key:'request',hash:digest(JSON.stringify(prepared.payload)),articleSnapshotHash:digest(JSON.stringify(article)),articleId,templateId,status:'success',job:{id:'autofill',status:'success',designId:'D123'},backgroundUpload:upload}};
 const calls=[], writes=[]; let stored=null, lock=false, exportPolls=0;
 const load=loader({
  '@/lib/staging-environment':{requireStagingE2E(){if(options.preview)throw new CanvaConnectError(403,'staging');},stagingRequestAllowed:()=>!options.preview},
  '@/lib/canva-api-access':{sameOrigin(r){if(options.csrf || r.headers.get('origin')!=='https://canva-staging.datadiction.co.kr')throw new CanvaConnectError(403,'origin');},canvaAdmin:async()=>options.anon?{ok:false,response:Response.json({}, {status:403})}:{ok:true,project,user:{id:'admin'}},canvaJson:Response.json,canvaFailure:e=>Response.json({message:e.message},{status:e.status||502})},
  '@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:options.crossProject?[]:[article]})},
  '@/lib/canva-background-repository':{readCanvaBackground:async(p,id)=>{assert.equal(p,project.id);assert.equal(id,'asset');if(options.unapproved)throw new CanvaConnectError(404,'asset');return{id,hash:upload.sourceHash};}},
  '@/lib/canva-confirmation':{createCanvaConfirmation:digest,verifyCanvaConfirmation:(c,b)=>c===digest(b)},
  '@/lib/canva-connection-repository':{getConnection:async()=>row,withConnectionLock:async(p,u,fn)=>{assert.equal(p,project.id);assert.equal(u,'admin');if(lock)throw new CanvaConnectError(409,'locked');lock=true;try{return await fn(row,async patch=>{writes.push(structuredClone(patch));Object.assign(row,patch);return row;});}finally{lock=false;}}},
  '@/lib/canva-connect-server':{accessToken:async()=>{calls.push('token');return 'mock';},connectedCanvaRequest:async(path,_token,_update,body)=>{calls.push({path,body});if(path.endsWith('export-formats'))return{formats:{png:{page_numbers:[1]}}};if(path.startsWith('/designs/'))return{design:{id:'D123',page_count:1}};if(path==='/exports'){if(options.waitExport)await options.waitExport;if(options.failExport)throw new CanvaConnectError(504,'timeout');return{job:{id:'export1',status:options.async?'in_progress':'success',urls:['https://export-download.canva.com/test']}};}exportPolls++;return{job:{id:'export1',status:'success',urls:['https://export-download.canva.com/test']}};}},
  '@/lib/canva-png-export':{...base('src/lib/canva-png-export.ts'),canvaPngImportEnabled:()=>!options.preview,downloadCanvaPng:async()=>{calls.push('download');return{file:new File(['mock bytes'],'export.png',{type:'image/png'})};}},
  '@/lib/canva-png-asset-repository':{findCanvaPngAsset:async()=>stored,registerCanvaPngAsset:async input=>{calls.push({register:input});stored={id:input.assetId,name:input.name};return stored;}},
 });
 const route=load('src/app/api/canva/png-import/route.ts');
 const send=async patch=>{const r=await route.POST(new Request('https://canva-staging.datadiction.co.kr/api/canva/png-import',{method:'POST',headers:{origin:'https://canva-staging.datadiction.co.kr'},body:JSON.stringify({projectSlug:'fixture',articleId,templateId,designId:'D123',assetType:'card_frame',action:'start',...patch})}));return{status:r.status,value:await r.json()};};
 const candidate=async()=>{const r=await route.GET(new Request('https://canva-staging.datadiction.co.kr/api/canva/png-import?'+new URLSearchParams({projectSlug:'fixture',articleId,templateId,designId:'D123'})));return{status:r.status,value:await r.json()};};
 return{row,calls,writes,send,candidate,change:p=>{article={...article,...p};},source:()=>JSON.stringify(article),approve:async()=>send({action:'approve',confirmation:(await candidate()).value.confirmation}),polls:()=>exportPolls};
}
test('created/reviewing/needs_revision or forged local approved flag cannot export; explicit signed snapshot approval performs no Canva call',async()=>{
 for(const status of [undefined,'created','reviewing','needs_revision']){const f=fixture();if(status)f.row.execution.designReview={status};assert.equal((await f.send()).status,409);assert.equal(f.calls.length,0);}
 const f=fixture();assert.equal((await f.send({action:'approve',confirmation:'forged'})).status,409);assert.equal((await f.approve()).status,200);assert.equal(f.row.execution.designReview.status,'approved');assert.equal(f.calls.length,0);
});
test('approval binds current article, template, design and execution; stale/changed source and incompatible image gate export before provider calls',async()=>{
 for(const patch of [{designId:'D_other'},{articleId:'22222222-2222-4222-8222-222222222222'},{templateId:'event_festival_01'}]){const f=fixture();await f.approve();assert.notEqual((await f.send(patch)).status,200);assert.equal(f.calls.length,0);}
 const f=fixture();const c=await f.candidate();f.change({body:'changed source'});assert.equal((await f.send({action:'approve',confirmation:c.value.confirmation})).status,409);assert.equal((await f.send()).status,409);assert.equal(f.calls.length,0);
 const changed=fixture();await changed.approve();changed.row.execution.hash='different';assert.equal((await changed.send()).status,409);assert.equal(changed.calls.length,0);
 for(const options of [{anon:true},{preview:true},{crossProject:true},{unapproved:true},{csrf:true}]){const denied=fixture(options);assert.notEqual((await denied.send()).status,200);assert.equal(denied.calls.length,0);}
});
test('approved click starts exactly one first-page PNG export; ready then status imports once with provenance; repeat returns existing asset',async()=>{
 const f=fixture(), before=f.source();await f.approve();const started=await f.send();assert.equal(started.value.import.status,'ready');assert(!f.calls.includes('download'));
 const imported=await f.send({action:'status'});assert.equal(imported.value.import.status,'success');assert.deepEqual(imported.value.import.candidate,{assetId:imported.value.import.assetId,articleId,templateId,autoApplied:false});
 const exports=f.calls.filter(x=>x.path==='/exports');assert.equal(exports.length,1);assert.deepEqual(exports[0].body.format.pages,[1]);
 const saved=f.calls.find(x=>x.register).register;assert.equal(saved.articleId,articleId);assert.equal(saved.templateId,templateId);assert.equal(saved.designId,'D123');assert(!isNaN(Date.parse(saved.importedAt)));
 const n=f.calls.length;const reused=await f.send();assert(reused.value.duplicate);assert.equal(f.calls.length,n);assert.equal(f.source(),before);assert(!JSON.stringify(f.writes).includes('export-download'));
});
test('in_progress and ready status polling reuse job and never create a new export',async()=>{
 const f=fixture({async:true});await f.approve();assert.equal((await f.send()).value.import.status,'in_progress');assert.equal((await f.send({action:'status'})).value.import.status,'ready');assert.equal((await f.send({action:'status'})).value.import.status,'success');assert.equal(f.calls.filter(x=>x.path==='/exports').length,1);assert.equal(f.polls(),2);
});
test('uncertain/failed states cannot retry exports; parallel clicks are serialized under existing lease',async()=>{
 for(const status of ['unknown','sending','failed']){const f=fixture();await f.approve();f.row.execution.pngImport={status,designId:'D123',assetType:'card_frame'};assert.equal((await f.send()).status,409);assert.equal(f.calls.length,0);}
 const f=fixture({failExport:true});await f.approve();assert.equal((await f.send()).status,504);assert.equal(f.row.execution.pngImport.status,'unknown');const n=f.calls.length;assert.equal((await f.send()).status,409);assert.equal(f.calls.length,n);
 let release;const pending=new Promise(r=>{release=r;});const concurrent=fixture({waitExport:pending});await concurrent.approve();const first=concurrent.send();await new Promise(r=>setTimeout(r,5));assert.equal((await concurrent.send()).status,409);release();await first;assert.equal(concurrent.calls.filter(x=>x.path==='/exports').length,1);
});
test('revision revokes approved state without touching successful upload receipt/job; import must be reapproved',async()=>{
 const f=fixture();const original=JSON.stringify([f.row.execution.backgroundUpload,f.row.execution.job]);await f.approve();assert.equal((await f.send({action:'revoke'})).status,200);assert.equal(f.row.execution.designReview.status,'needs_revision');assert.equal((await f.send()).status,409);assert.equal(f.calls.length,0);assert.equal(JSON.stringify([f.row.execution.backgroundUpload,f.row.execution.job]),original);
});
test('extended metadata provenance is allowlisted and legacy PNG provenance remains readable',()=>{
 const {validateDesignAssetMetadata:validate}=base('src/lib/design-asset-metadata.ts');
 const m={source:'canva',canvaExport:{designId:'D123',format:'png',articleId,templateId,importedAt:'2026-10-13T05:00:00.000Z'}};assert.deepEqual(validate(m).metadata,m);
 for(const patch of [{articleId:'other'},{importedAt:'unknown'},{templateId:'../x'},{downloadUrl:'secret'}])assert(!validate({...m,canvaExport:{...m.canvaExport,...patch}}).ok);
 assert(validate({source:'canva',canvaExport:{designId:'D123',format:'png'}}).ok);
});
