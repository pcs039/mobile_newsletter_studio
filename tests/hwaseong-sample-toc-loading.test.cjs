/* eslint-disable @typescript-eslint/no-require-imports -- Protected thumbnail preparation uses local image and Storage mocks only. */
const test=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp'),loader=require('./canva-test-loader.cjs');
const project='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',slug='hwaseong-2026-10-samples';
const kinds=['policy','tourism','event','cartoon','accessible','interview','video'];
const path=i=>`projects/${project}/production/illustration/${i}.png`;
const samples=kinds.map((kind,i)=>({kind,artDirectionVersion:3,article:{id:String(i)},cover:`/api/project-files/preview?${new URLSearchParams({bucket:'design-production-assets',path:path(i)})}`}));
async function fixture(run){const previousFetch=global.fetch,previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';
 const original=await sharp({create:{width:64,height:96,channels:3,background:'#125e7c'}}).png().toBuffer();
 let rows=samples.map((s,i)=>({project_id:project,storage_path:path(i),storage_bucket:'design-production-assets',mime_type:'image/png',file_size_bytes:original.length,is_active:true})),enabled=true,body=original;
 const requests=[];global.fetch=async(url,options)=>{requests.push({url,options});return url.includes('/rest/v1/')?Response.json(rows):new Response(body);};
 const load=loader({'@/lib/staging-environment':{stagingOrigin:'https://canva-staging.datadiction.co.kr',stagingEnvironmentConfigured:()=>enabled},'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://fixture.invalid'+p,getSupabaseStorageEndpoint:p=>'https://fixture.invalid/storage/v1'+p}});
 const contract=load('src/lib/hwaseong-sample-toc-server.ts');
 try{await run({...contract,requests,original,rows:set=>rows=set,enabled:v=>enabled=v,body:v=>body=v});}finally{global.fetch=previousFetch;if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;}}
test('all seven crops stay within their originals; first comic scene and portrait top remain intact',async()=>fixture(async f=>{
 const dimensions=[[1000,800],[1024,700],[1000,920],[1024,1536],[1000,729],[690,518],[1280,720]];
 dimensions.forEach(([w,h],i)=>{const c=f.sampleTocCrop(w,h,kinds[i],3);assert(c.left>=0&&c.top>=0&&c.width>0&&c.height>0);assert(c.left+c.width<=w&&c.top+c.height<=h);assert(Math.abs(c.width/c.height-16/9)<0.01);if(['cartoon','interview'].includes(kinds[i]))assert.equal(c.top,0);});
}));
test('one project metadata lookup produces bounded inline WebP frames; source objects and private access stay unchanged',async()=>fixture(async f=>{
 const result=await f.prepareSampleToc(project,slug,samples);assert.equal(Object.keys(result).length,7);
 for(const value of Object.values(result)){const bytes=Buffer.from(value.split(',')[1],'base64'),meta=await sharp(bytes).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,768);assert.equal(meta.height,432);assert(bytes.length<=48*1024);assert(!value.includes('fixture-only'));}
 assert.equal(f.requests.filter(r=>r.url.includes('/rest/v1/')).length,1);assert.equal(f.requests.length,8);
 for(const {options} of f.requests){assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert(!options.method||options.method==='GET');}
}));
test('Production, unknown projects and foreign image URLs never reach Storage',async()=>fixture(async f=>{
 f.enabled(false);assert.deepEqual(await f.prepareSampleToc(project,slug,samples),{});f.enabled(true);
 assert.deepEqual(await f.prepareSampleToc(project,'other',samples),{});
 assert.deepEqual(await f.prepareSampleToc(project,slug,samples.map(s=>({...s,cover:'https://external.invalid'+s.cover}))),{});
 assert.equal(f.requests.length,0);
}));
test('inactive or mismatched ownership is rechecked even after derived bytes were cached',async()=>fixture(async f=>{
 await f.prepareSampleToc(project,slug,samples);f.requests.length=0;
 f.rows(samples.map((s,i)=>({project_id:i?'other':project,storage_path:path(i),storage_bucket:'design-production-assets',mime_type:'image/png',file_size_bytes:f.original.length,is_active:false})));
 assert.deepEqual(await f.prepareSampleToc(project,slug,samples),{});assert.equal(f.requests.length,1);
}));
test('truncated or corrupt source files fall back without returning unverified frames',async()=>fixture(async f=>{
 f.body(Buffer.alloc(20));assert.deepEqual(await f.prepareSampleToc(project,slug,samples),{});
}));
