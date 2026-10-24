/* eslint-disable @typescript-eslint/no-require-imports -- Isolated APIs and Storage faults; never contacts Supabase. */
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const sharp=require('sharp'),loader=require('./canva-test-loader.cjs');
const actor={id:'qa',name:'QA',role:'user'},project=randomUUID(),key=randomUUID();
const digest=b=>createHash('sha256').update(b).digest('hex');
const json=(data,status=200)=>Response.json(data,{status});
async function withFixture(run){
 const before={fetch:global.fetch,enabled:process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED='true';process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-fixture-only';
 const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#abc'}}).png().toBuffer();
 const requests=[],objects=new Map(),sessions=new Map();let inserts=0;
 const fault={};
 const load=loader({'@/lib/supabase-config':{getSupabaseConfigStatus:()=>({url:'https://fixture.supabase.co'})}});
 const contract=load('src/lib/design-asset-direct-upload-contract.ts');
 const {directUploadService}=load('src/lib/design-asset-direct-upload-server.ts');
 const input={projectId:project,requestKey:key,fileName:'fixture.png',assetType:'background',mime:'image/png',size:bytes.length,sha256:digest(bytes)};
 global.fetch=async(url,init={})=>{
  const u=new URL(url),body=init.body&&typeof init.body==='string'?JSON.parse(init.body):init.body;
  requests.push({url:u,method:init.method??'GET',body,headers:init.headers});
  if(u.pathname.startsWith('/rest/v1/rpc/')){
   const name=u.pathname.split('/').pop(); const s=sessions.get(body.p_id)||[...sessions.values()].find(x=>x.request_key===body.p_key);
   if(name==='prepare_design_asset_upload'){
    if(s)return json(s.id);
    const id=randomUUID();sessions.set(id,{id,project_id:project,actor_id:actor.id,request_key:key,phase:'prepared',generation:0,
     temp_bucket:'design-upload-quarantine',temp_path:`projects/${project}/design-upload-v1/${id}/input.png`,final_path:null,
     asset_type:'background',mime:input.mime,byte_size:input.size,byte_hash:input.sha256,policy_version:'b2-raster-v1',lease_until:null,
     intent_expires:new Date(Date.now()+1800000).toISOString(),receipt:null,asset_exists:false});return json(id);
   }
   if(name==='get_design_asset_upload_status')return json(s&&s.project_id===body.p_project&&s.actor_id===body.p_actor.id?s:null);
   if(name==='reserve_design_asset_upload_capability')return json(1);
   if(name==='claim_design_asset_upload'){
    if(fault.claimConflict||s.phase==='verifying')return json({code:'PT409',message:'not returned'},409);
    s.generation++;s.phase='verifying';s.lease_until=new Date(Date.now()+60000).toISOString();
    s.final_path=`projects/${project}/production/background/direct-v1/${s.id}/${s.generation}.png`;return json(s.generation);
   }
   if(name==='mark_design_asset_upload_stored'){
    if(fault.beforeDb)return json({code:'XX000'},500);
    s.phase='stored';if(fault.markLost){fault.markLost=false;throw Error('discarded');}return json(null);
   }
   if(name==='reject_design_asset_upload'){s.phase='rejected';return json(null);}
   if(name==='finalize_design_asset_upload'){
    if(!s.receipt){s.phase='registered';s.receipt={assetId:s.id,state:'registered'};s.asset_exists=true;inserts++;}
    if(fault.commitLost){fault.commitLost=false;throw Error('discarded');}
    return json(s.receipt);
   }
   throw Error('unknown fixture RPC');
  }
  if(u.pathname.includes('/bucket/'))return json({public:fault.publicBucket??false,file_size_limit:10485760,allowed_mime_types:['image/png','image/jpeg','image/webp']});
  if(u.pathname.includes('/upload/sign/'))return json({url:fault.signedUrl||`${u.pathname}?token=fixture-capability`});
  const m=u.pathname.match(/\/object\/(?:authenticated\/)?([^/]+)\/(.+)/);if(!m)throw Error('unexpected fixture URL');
  const objectKey=m[1]+'/'+decodeURIComponent(m[2]);
  if(init.method==='POST'){
   if(objects.has(objectKey))return json({error:'exists'},409);
   objects.set(objectKey,{bytes:Buffer.from(init.body),mime:'image/png'});
   if(fault.storageLost)throw Error('discarded');return json({});
  }
  const object=objects.get(objectKey);if(!object)return json({},404);
  return new Response(object.bytes,{headers:{'content-type':object.mime}});
 };
 const service=()=>directUploadService(actor,project,AbortSignal.timeout(15000));
 const stage=async()=>{const p=await service().prepare(input),s=sessions.get(p.sessionId);objects.set(s.temp_bucket+'/'+s.temp_path,{bytes:Buffer.from(bytes),mime:'image/png'});return s;};
 try{await run({load,contract,input,service,stage,requests,objects,sessions,fault,get inserts(){return inserts;},bytes});}
 finally{global.fetch=before.fetch;for(const [n,v]of [['DESIGN_ASSET_DIRECT_UPLOAD_ENABLED',before.enabled],['SUPABASE_SERVICE_ROLE_KEY',before.key]]){if(v===undefined)delete process.env[n];else process.env[n]=v;}}
}
test('all new routes OFF: 404, no auth, DB, Storage or verifier work',async()=>{
 const prior=process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED;delete process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED;
 const priorFetch=global.fetch;global.fetch=()=>{throw Error('OFF must not fetch');};
 let calls=0;const load=loader({'@/lib/project-api-access':{requireProjectApiAccess:async()=>{calls++;throw Error();}}});
 try{for(const [action,method]of [['prepare','POST'],['status','GET'],['finalize','POST']]){
  const route=load(`src/app/api/project-design-kit/uploads/${action}/route.ts`),r=await route[method](new Request(`https://qa.invalid/${action}`,{method}));
  assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'private, no-store');
 }assert.equal(calls,0);}finally{global.fetch=priorFetch;if(prior===undefined)delete process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED;else process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED=prior;}
});
test('route reuses origin/auth/project gates and rejects forbidden input',async()=>{
 const prior=process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED;process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED='true';let mode='unauth',calls=0;
 const load=loader({'@/lib/project-api-access':{requireProjectApiAccess:async()=>mode==='unauth'?{ok:false,response:json({},401)}:mode==='foreign'?{ok:false,response:json({},403)}:{ok:true,project:{id:project},user:actor}},
  '@/lib/design-asset-direct-upload-server':{directUploadService:()=>({prepare:async input=>{calls++;return {ok:true,requestKey:input.requestKey};},status:async()=>({ok:true})})}});
 const route=load('src/lib/design-asset-direct-upload-route.ts');const body={projectId:project,requestKey:key,fileName:'test.png',assetType:'background',mime:'image/png',size:10,sha256:'a'.repeat(64)};
 const request=(data=body,origin='https://qa.invalid')=>new Request('https://qa.invalid/prepare',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
 try{
  assert.equal((await route.handleDirectUpload(request(),'prepare')).status,401);mode='foreign';assert.equal((await route.handleDirectUpload(request(),'prepare')).status,403);
  mode='ok';assert.equal((await route.handleDirectUpload(request(body,'https://evil.invalid'),'prepare')).status,403);
  for(const patch of [{actor:{role:'admin'}},{bucket:'public'},{fileName:'file.svg'},{size:10485761}])assert.equal((await route.handleDirectUpload(request({...body,...patch}),'prepare')).status,400);
  assert.equal((await route.handleDirectUpload(request({...body,fileName:'a'.repeat(5000)}),'prepare')).status,413);
  assert.equal((await route.handleDirectUpload(request(),'prepare')).status,200);assert.equal(calls,1);
  const r=await route.handleDirectUpload(new Request(`https://qa.invalid/status?projectId=${project}&requestKey=${key}`,{headers:{'sec-fetch-site':'same-origin'}}),'status');assert.equal(r.status,200);
  const oldVercel=process.env.VERCEL,oldUrl=process.env.VERCEL_URL;
  try{
   process.env.VERCEL='1';process.env.VERCEL_URL='fixture-test.vercel.app';
   for(const [host,expected]of [['fixture-test.vercel.app',200],['evil.invalid',403]]){
    const proxied=new Request(`http://internal/status?projectId=${project}&requestKey=${key}`,{headers:{host,'x-forwarded-proto':'https','sec-fetch-site':'same-origin'}});
    assert.equal((await route.handleDirectUpload(proxied,'status')).status,expected);
   }
  }finally{for(const [n,v]of [['VERCEL',oldVercel],['VERCEL_URL',oldUrl]]){if(v===undefined)delete process.env[n];else process.env[n]=v;}}
 }finally{if(prior===undefined)delete process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED;else process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED=prior;}
});
test('normal finalize uses real child decoding, private paths, no upsert, one asset and sanitized receipt',async()=>withFixture(async f=>{
 const s=await f.stage(),result=await f.service().finalize(s.id);assert.equal(result.state,'registered');assert.equal(f.inserts,1);
 assert.deepEqual(await f.service().finalize(s.id),result);assert.equal(f.inserts,1);
 assert(!JSON.stringify(result).includes('isolated-fixture-only'));assert(!JSON.stringify(result).includes('temp_path'));
 const write=f.requests.find(r=>r.method==='POST'&&r.url.pathname.includes('/object/design-production-assets/'));
 assert.equal(write.headers['x-upsert'],'false');assert(!f.requests.some(r=>r.method==='DELETE'));
 s.asset_exists=false;assert.equal((await f.service().finalize(s.id)).assetExists,false);assert.equal(f.inserts,1);
}));
test('same request recovery and signed URL path/origin cannot widen capability',async()=>withFixture(async f=>{
 const p=await f.service().prepare(f.input);assert.equal((await f.service().status(undefined,key)).sessionId,p.sessionId);
 for(const signedUrl of ['https://evil.invalid/file?token=fixture','/object/upload/sign/public/wrong?token=fixture']){
  f.fault.signedUrl=signedUrl;await assert.rejects(f.service().prepare(f.input),e=>e.code==='capability_unknown');
 }
 f.fault.publicBucket=true;await assert.rejects(f.service().prepare(f.input),e=>e.code==='bucket_configuration');
}));
test('Storage success/lost response reconciles exact bytes, DB failure preserves objects without cleanup',async()=>withFixture(async f=>{
 const s=await f.stage();f.fault.storageLost=true;f.fault.beforeDb=true;
 await assert.rejects(f.service().finalize(s.id),e=>e.outcome==='unknown');assert.equal(f.inserts,0);assert.equal(f.objects.size,2);
 assert(!f.requests.some(r=>r.method==='DELETE'));assert.equal((await f.service().status(s.id)).state,'verifying');
}));
test('DB commit response loss recovers result without duplicate INSERT or re-upload',async()=>withFixture(async f=>{
 const s=await f.stage();f.fault.commitLost=true;await assert.rejects(f.service().finalize(s.id),e=>e.outcome==='unknown');
 assert.equal((await f.service().status(s.id)).state,'registered');await f.service().finalize(s.id);assert.equal(f.inserts,1);
}));
test('stored response loss resumes with preserved-byte verification, no second upload',async()=>withFixture(async f=>{
 const s=await f.stage();f.fault.markLost=true;await assert.rejects(f.service().finalize(s.id),e=>e.outcome==='unknown');
 assert.equal((await f.service().status(s.id)).state,'stored');await f.service().finalize(s.id);assert.equal(f.inserts,1);
 assert.equal(f.requests.filter(r=>r.method==='POST'&&r.url.pathname.includes('/object/design-production-assets/')).length,1);
}));
test('foreign or conflicting preserved path is never overwritten or cleaned up',async()=>withFixture(async f=>{
 const s=await f.stage();s.final_path=`projects/${project}/production/background/direct-v1/${s.id}/1.png`;
 f.objects.set('design-production-assets/'+s.final_path,{bytes:Buffer.from('different'),mime:'image/png'});
 await assert.rejects(f.service().finalize(s.id),e=>e.code==='preserved_object_conflict'&&e.outcome==='unknown');
 assert.equal(f.inserts,0);assert(!f.requests.some(r=>r.method==='DELETE'));
 s.project_id=randomUUID();await assert.rejects(f.service().status(s.id));
}));
test('new verifier decodes each supported format without changing original bytes',async()=>withFixture(async f=>{
 const {verifyDirectUploadImage}=f.load('src/lib/design-asset-direct-upload-verifier.ts');
 for(const [format,mime]of [['png','image/png'],['jpeg','image/jpeg'],['webp','image/webp']]){
  const bytes=await sharp({create:{width:8,height:9,channels:3,background:'#abc'}}).toFormat(format).toBuffer(),before=digest(bytes);
  assert.deepEqual(await verifyDirectUploadImage(bytes,mime,AbortSignal.timeout(5000)),{width:8,height:9});assert.equal(digest(bytes),before);
 }
}));
for(const mode of ['mime','bytes','decode','pixels'])test(`invalid uploaded ${mode} never registers`,async()=>withFixture(async f=>{
 const s=await f.stage(),object=f.objects.get(s.temp_bucket+'/'+s.temp_path);
 if(mode==='mime')object.mime='text/html';
 else{object.bytes=mode==='bytes'?Buffer.from('bad'):mode==='decode'?Buffer.from(f.bytes):await sharp({create:{width:4096,height:4096,channels:3,background:'#fff'}}).png().toBuffer();
  if(mode==='decode'){const at=object.bytes.indexOf(Buffer.from('IDAT'));object.bytes[at+4]^=255;}
  s.byte_size=object.bytes.length;s.byte_hash=digest(object.bytes);
 }
 await assert.rejects(f.service().finalize(s.id),e=>e.outcome==='rejected');assert.equal(f.inserts,0);assert.equal(s.phase,'rejected');
}));
test('concurrent finalize/expired session does not cause automatic retries',async()=>withFixture(async f=>{
 const s=await f.stage();f.fault.claimConflict=true;
 await assert.rejects(f.service().finalize(s.id),e=>e.status===409);assert.equal(f.inserts,0);
 s.phase='expired';await assert.rejects(f.service().finalize(s.id),e=>e.outcome==='rejected');
}));
