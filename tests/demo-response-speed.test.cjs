/* eslint-disable @typescript-eslint/no-require-imports -- Request-local read-only mocks, no provider or remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./canva-test-loader.cjs');
test('resolved workspace is reused only for the exact slug, never cached across calls',async()=>{
 const prev=global.fetch,old={...process.env};Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://db.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture'});let projects=0;
 global.fetch=async input=>{const u=new URL(input);if(u.pathname.endsWith('/newsletter_projects')){projects++;return Response.json([]);}return Response.json([]);};
 try{const m=load()('src/lib/newsletter-repository.ts'),workspace={ok:true,source:'supabase',project:{id:'p',slug:'sample'}};
  assert.equal((await m.getProjectContent('sample',workspace)).source,'supabase');assert.equal(projects,0);
  await m.getProjectContent('foreign',workspace);assert.equal(projects,1);
  await m.getProjectContent('sample');assert.equal(projects,2);
 }finally{global.fetch=prev;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}
});
test('request timing diagnostics contain only allowlisted names, numbers and correlation ID, including failure',async()=>{
 const prev=console.info,logs=[];console.info=x=>logs.push(x);
 try{const m=load()('src/lib/demo-share-diagnostics.ts'),t=m.createDemoTrace('render');
  assert.equal(await m.demoTimed(t,'access',async()=>7),7);
  await assert.rejects(m.demoTimed(t,'cover',async()=>{throw Error('secret-cookie-original-text');}));
  assert.equal(logs.length,2);for(const x of logs){assert.deepEqual(Object.keys(x),['requestId','phase','durationMs']);assert(Number.isFinite(x.durationMs));assert(x.durationMs>=0);}
  assert.match(m.demoTimingHeader(t),/^access;dur=\d+(\.\d+)?, cover;dur=\d+(\.\d+)?$/);assert(!JSON.stringify(logs).includes('secret'));
 }finally{console.info=prev;}
});
