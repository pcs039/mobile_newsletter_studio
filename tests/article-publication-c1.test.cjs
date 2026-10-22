/* eslint-disable @typescript-eslint/no-require-imports -- No remote IO, env or live keys. */
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const fixture=require('./article-publication-c1-fixture.cjs'),load=require('./canva-test-loader.cjs')();
const {SupabasePublicationStore}=load('src/lib/article-publication-supabase-store.ts');
const {isPublicationStorageReference,publicationPreservationBucket:bucket}=load('src/lib/article-publication-storage-policy.ts');
test('C1 private copy, canonical path, exact bytes; source delete/upsert cannot alter pinned copy',async()=>{
 const f=await fixture(),r=await f.store.preserve(f.i,f.ledger);f.state.pinned=true;
 f.objects.set(`${f.source.bucket}/${f.source.path}`,Buffer.from('replacement'));f.objects.delete(`${f.source.bucket}/${f.source.path}`);
 assert.deepEqual(await f.store.read(f.file,f.ledger),f.original);assert.equal(f.state.posts,1);
 assert.match(r.path,/^independent-publications\/v1\/projects\//);
 const upload=f.state.calls.find(c=>c.method==='POST');assert.equal(upload.headers['x-upsert'],'false');assert.equal(upload.redirect,'error');assert.equal(upload.cache,'no-store');
 await assert.rejects(f.store.gc(f.i.fileId,f.ledger),/pinned/);assert.equal(f.state.deletes,0);
});
test('C1 duplicate copies and lost upload response re-download verified object without overwrite',async()=>{
 const f=await fixture();let once=true;f.state.afterUpload=async()=>{if(once){once=false;throw Error('response lost');}};
 const r=await f.store.preserve(f.i,f.ledger);f.objects.delete(`${f.source.bucket}/${f.source.path}`);
 assert.deepEqual(await f.store.preserve(f.i,f.ledger),r);assert.equal(f.state.posts,1);
});
test('C1 Storage success / DB failure retains a durable reservation and reconciles after restart',async()=>{
 const f=await fixture();f.state.failVerified=true;
 await assert.rejects(f.store.preserve(f.i,f.ledger),/db_commit_failure/);assert.equal(f.state.posts,1);
 const restarted=new SupabasePublicationStore(f.options);await restarted.preserve(f.i,f.ledger);assert.equal(f.state.posts,1);
});
test('C1 existing corrupted destination fails closed and is never overwritten',async()=>{
 const f=await fixture(),r=await f.store.preserve(f.i,f.ledger);f.objects.set(`${bucket}/${r.path}`,Buffer.from('corrupted'));
 await assert.rejects(f.store.preserve(f.i,f.ledger));assert.equal(f.state.posts,1);
});
test('C1 MIME, declared length, truncated streams and oversized headers are rejected',async()=>{
 for(const headers of [{'content-type':'image/jpeg'},{'content-type':'image/png','content-length':'1'},{'content-type':'image/png','content-length':'16777217'},{'content-type':'image/png','content-range':'bytes 0-3/10'}]){
  const f=await fixture();f.state.override=async p=>p.includes('/authenticated/mobile-assets/')?new Response(f.original,{headers}):null;
  await assert.rejects(f.store.preserve(f.i,f.ledger));assert.equal(f.state.posts,0);
 }
 const f=await fixture();f.state.override=async p=>p.includes('/authenticated/mobile-assets/')?new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));c.error(Error('cut'));}}),{headers:{'content-type':'image/png'}}):null;
 await assert.rejects(f.store.preserve(f.i,f.ledger),/incomplete/);
});
test('C1 reservation hash/size/MIME mismatch cannot verify bytes',async()=>{
 for(const changed of [{sha256:'a'.repeat(64)},{bytes:1},{mime:'image/jpeg'}]){
  const f=await fixture(),reserve=f.ledger.reserve;f.ledger.reserve=async(s,d)=>reserve(s,{...d,...changed});
  await assert.rejects(f.store.preserve(f.i,f.ledger));
 }
});
test('C1 source, path, ownership, private bucket and URL origin fail before data writes',async()=>{
 for(const change of [{projectId:randomUUID()},{bucket},{path:'../unsafe'},{path:'https://evil.invalid/a'},{path:`projects/${randomUUID()}/a.png`}]){
  const f=await fixture();Object.assign(f.source,change);await assert.rejects(f.store.preserve(f.i,f.ledger));assert.equal(f.state.posts,0);
 }
 const f=await fixture();f.state.private=false;await assert.rejects(f.store.preserve(f.i,f.ledger),/not_private/);assert.equal(f.state.posts,0);
 for(const url of ['http://aaaaaaaaaaaaaaaaaaaa.supabase.co','https://evil.invalid','https://aaaaaaaaaaaaaaaaaaaa.supabase.co/?token=x'])assert.throws(()=>new SupabasePublicationStore({...f.options,url}),/origin/);
});
test('C1 anonymous/other-project/withdrawn revision denied before Storage and after slow download',async()=>{
 const f=await fixture();await f.store.preserve(f.i,f.ledger);let calls=f.state.calls.length;
 await assert.rejects(f.store.read(f.file,f.ledger),/denied/);assert.equal(f.state.calls.length,calls);
 f.state.pinned=true;await assert.rejects(f.store.read({...f.file,projectId:randomUUID()},f.ledger),/denied/);
 f.state.afterDownload=async key=>{if(key.startsWith(bucket+'/'))f.state.denied=true;};await assert.rejects(f.store.read(f.file,f.ledger),/denied/);
});
test('C1 simultaneous preserves share a reservation and one immutable object',async()=>{
 const f=await fixture();const results=await Promise.all([f.store.preserve(f.i,f.ledger),f.store.preserve(f.i,f.ledger)]);
 assert.equal(results[0].path,results[1].path);assert.equal(f.state.posts,1);
});
test('C1 incomplete upload stays reserved and retry succeeds; no eager delete',async()=>{
 const f=await fixture();let once=true;f.state.override=async(p,init)=>{if(init.method==='POST'&&once){once=false;return Response.json({error:'temporary'},{status:503});}return null;};
 await assert.rejects(f.store.preserve(f.i,f.ledger),/upload_failed/);assert(f.state.reservation);assert.equal(f.state.deleted,false);
 await f.store.preserve(f.i,f.ledger);assert.equal(f.state.posts,1);assert.equal(f.state.deletes,0);
});
test('C1 orphan GC verifies absence, retries uncertain delete and cannot resurrect a retired preparation',async()=>{
 const f=await fixture();await f.store.preserve(f.i,f.ledger);let once=true;
 f.state.override=async(p,init)=>{if(init.method==='DELETE'&&once){once=false;throw Error('lost delete');}return null;};
 await assert.rejects(f.store.gc(f.i.fileId,f.ledger),/unknown/);assert.equal(f.state.deleted,false);
 await f.store.gc(f.i.fileId,f.ledger);assert.equal(f.state.deleted,true);await assert.rejects(f.store.preserve(f.i,f.ledger),/denied/);
});
test('C1 credentials and provider error bodies never escape in errors; redirects forbidden',async()=>{
 const f=await fixture();f.state.override=async p=>p.includes('authenticated')?Response.json({secret:'do-not-print'},{status:302,headers:{location:'https://evil.invalid'}}):null;
 await assert.rejects(f.store.preserve(f.i,f.ledger),e=>!/do-not-print|fake-test/.test(e.message));
});
test('C1 source changes during copy fail before verification and leave a quarantined copy',async()=>{
 const f=await fixture();let verified=false;f.ledger.verified=async()=>{verified=true;};
 f.state.afterUpload=async()=>{f.objects.set(`${f.source.bucket}/${f.source.path}`,Buffer.from('changed'));};
 await assert.rejects(f.store.preserve(f.i,f.ledger));assert.equal(verified,false);assert.equal(f.state.posts,1);assert.equal(f.state.deletes,0);
});
test('C1 chunked bodies cannot bypass the byte cap',async()=>{
 const f=await fixture();f.state.override=async p=>p.includes('/authenticated/mobile-assets/')?new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(16*1024*1024));c.enqueue(new Uint8Array(1));c.close();}}),{headers:{'content-type':'image/png'}}):null;
 await assert.rejects(f.store.preserve(f.i,f.ledger),/incomplete/);assert.equal(f.state.posts,0);
});
test('C1 legacy endpoint blocks preservation references including encoded aliases; ordinary issue paths unchanged',()=>{
 const {getSupabaseStorageEndpoint}=load('src/lib/supabase-config.ts');
 for(const path of [`/object/${bucket}/x`,`/object/authenticated/${bucket}/x`,`/object/${encodeURIComponent(encodeURIComponent(bucket))}/x`,'/object/mobile-assets/independent-publications/v1/x']){
  assert.equal(isPublicationStorageReference(path),true);assert.equal(getSupabaseStorageEndpoint(path),null);
 }
 for(const path of ['/object/mobile-assets/projects/p/a.png','/object/audio-files/articles/a/1.mp3','/object/brand-assets/projects/p/a.png'])assert.equal(isPublicationStorageReference(path),false);
});
test('C1 legacy image deletion and Design Asset upload cannot reach preservation storage',async()=>{
 const originalFetch=global.fetch,prior=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const priorUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,priorAnon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 process.env.SUPABASE_SERVICE_ROLE_KEY='fake-test-only';process.env.NEXT_PUBLIC_SUPABASE_URL='https://aaaaaaaaaaaaaaaaaaaa.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fake-test-anon';
 const calls=[],project=randomUUID(),asset=randomUUID();
 global.fetch=async(url,init={})=>{
  calls.push({url:String(url),method:init.method});
  if(String(url).includes('/rest/v1/newsletter_projects'))return Response.json([{id:project,slug:'sample',title:'sample',page_count:1}]);
  if(String(url).includes('/rest/v1/newsletter_assets'))return Response.json([{id:asset}]);
  throw Error('unexpected transport');
 };
 try{
  const local=require('./canva-test-loader.cjs')(),files=local('src/lib/newsletter-file-storage.ts'),design=local('src/lib/project-design-asset-write.ts');
  const result=await files.deleteProjectFile({kind:'asset_image',projectSlug:'sample',recordId:asset,path:'independent-publications/v1/projects/protected.png'});
  assert.equal(result.ok,false);assert.equal(calls.some(c=>c.method==='DELETE'),false);
  assert.throws(()=>design.uploadProjectDesignAssetFile(bucket,'projects/x/file.png',new File(['x'],'x.png'),{}),/not configured/);
  assert.equal(calls.some(c=>c.url.includes('/storage/v1/')),false);
 }finally{
  global.fetch=originalFetch;
  for(const [k,v] of [['SUPABASE_SERVICE_ROLE_KEY',prior],['NEXT_PUBLIC_SUPABASE_URL',priorUrl],['NEXT_PUBLIC_SUPABASE_ANON_KEY',priorAnon]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});
