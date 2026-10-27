/* eslint-disable @typescript-eslint/no-require-imports -- Isolated cover rendering and Storage mocks; no remote requests. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),sharp=require('sharp');
const {renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const slug='hwaseong-2026-10-samples',id='4cd5297e-a0fd-434c-84d4-fa4d3baf9389';
const path=`projects/${id}/production/illustration/cover-mobile.webp`;
const source=`/api/project-files/preview?${new URLSearchParams({bucket:'design-production-assets',path})}`;
const config={getSupabaseRestEndpoint:p=>'https://fixture.invalid'+p,getSupabaseStorageEndpoint:p=>'https://fixture.invalid/storage/v1'+p};
async function withFixture(run){const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='mock-server-key';
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#125e7c'}}).webp({lossless:true}).toBuffer();
 const asset={project_id:id,storage_bucket:'design-production-assets',storage_path:path,mime_type:'image/webp',file_size_bytes:bytes.length,is_active:true};
 const requests=[];let enabled=true,metadata=asset,body=bytes,broken=false;
 global.fetch=async(url,options)=>{requests.push({url,options});if(broken)throw Error('network');return url.includes('/rest/v1/')?Response.json([metadata]):new Response(body,{headers:{'content-type':'image/webp'}});};
 const prepare=loader({'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>enabled,stagingOrigin:'https://canva-staging.datadiction.co.kr'},'@/lib/supabase-config':config})('src/lib/hwaseong-sample-cover-server.ts').prepareSampleCover;
 try{await run({prepare,requests,bytes,asset,enable:v=>enabled=v,metadata:v=>metadata=v,body:v=>body=v,break:()=>broken=true});}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}}
test('small existing WebP uses the identical bytes, only request-local authenticated reads and no exposed credentials',async()=>withFixture(async f=>{
 const result=await f.prepare(id,slug,source);assert(result.startsWith('data:image/webp;base64,'));assert.deepEqual(Buffer.from(result.split(',')[1],'base64'),f.bytes);assert(!result.includes('mock-server-key'));
 assert.equal(f.requests.length,2);for(const r of f.requests){assert.equal(r.options.cache,'no-store');assert.equal(r.options.redirect,'error');assert.equal(r.options.headers.Authorization,'Bearer mock-server-key');assert(r.options.signal);}
}));
test('Production, another project, external URLs, traversal and extra query controls never read Storage',async()=>withFixture(async f=>{
 f.enable(false);assert.equal(await f.prepare(id,slug,source),null);f.enable(true);
 for(const [project,name,url] of [[id,'other',source],['other',slug,source],[id,slug,'https://external.invalid'+source],[id,slug,source+'&download=1'],[id,slug,source.replace(encodeURIComponent(id),'another-project')],[id,slug,source.replace('cover-mobile','..%2Fcover-mobile')]])assert.equal(await f.prepare(project,name,url),null);
 assert.equal(f.requests.length,0);
}));
test('inactive, wrong-project and oversized metadata fall back before downloading; failures never break the reader',async()=>withFixture(async f=>{
 for(const patch of [{is_active:false},{project_id:'other'},{file_size_bytes:300000},{mime_type:'image/svg+xml'}]){f.metadata({...f.asset,...patch});assert.equal(await f.prepare(id,slug,source),null);}
 assert(f.requests.every(r=>r.url.includes('/rest/v1/')));f.metadata(f.asset);f.break();assert.equal(await f.prepare(id,slug,source),null);
}));
test('truncated, invalid and over-limit bodies preserve the existing URL fallback',async()=>withFixture(async f=>{
 f.body(f.bytes.subarray(0,12));assert.equal(await f.prepare(id,slug,source),null);
 f.body(Buffer.alloc(f.bytes.length));assert.equal(await f.prepare(id,slug,source),null);
 f.body(Buffer.alloc(256*1024+1));assert.equal(await f.prepare(id,slug,source),null);
}));
test('priority is opt-in, reserves the existing compact frame and leaves normal cover defaults untouched',()=>{
 const View=loader({'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null}})('src/components/public-mobile-article-reader.tsx').PublicNewsletterCoverView;
 for(const layout of ['image_info','image_overlay']){const props={coverImageSrc:'/original.webp',coverLayout:layout,coverFit:'cover',coverTitle:'제목',coverSubtitle:'부제',coverIssueText:'시연',hasArticles:true,slug,onOpenToc:()=>{},onStartReading:()=>{}};
  const normal=renderToStaticMarkup(React.createElement(View,props));assert(!normal.includes('fetchPriority="high"'));assert(!normal.includes('loading="eager"'));
  const sample=renderToStaticMarkup(React.createElement(View,{...props,compact:true,coverImagePriority:true}));assert.match(sample,/loading="eager"/);assert.match(sample,/fetchPriority="high"/);assert.match(sample,/decoding="sync"/);assert.match(sample,layout==='image_info'?/30svh/:/min-h-\[76vh\]/);
 }
});
test('cover preparation follows authorization, skips article/contents entries and never preloads the old URL alongside inline bytes',async()=>{
 let allowed=true,prepared=0;const hints=[];
 const load=loader({'react-dom':{preload:(url)=>hints.push(url)},'next/navigation':{notFound:()=>{throw Error('404');}},'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true},'@/lib/project-admin-preview-access':{requireProjectAdminPreviewAccess:async()=>allowed},'@/lib/hwaseong-sample-cover-server':{prepareSampleCover:async()=>{prepared++;return 'data:image/webp;base64,fixture';}},'@/lib/newsletter-repository':{getProjectWorkspace:async()=>({project:{id,coverEnabled:true,coverImageUrl:source}}),getProjectContent:async()=>({source:'supabase',articles:[]}),getFontAssets:async()=>({fonts:[]})},'@/lib/article-composition-repository':{getArticleHeroBackgrounds:async()=>({}),getArticleTextDesigns:async()=>({})},'@/lib/hwaseong-sample-tts-server':{sampleAudioIndex:async()=>({})}});
 const page=load('src/app/projects/[projectId]/samples/page.tsx').default;
 const render=query=>page({params:Promise.resolve({projectId:slug}),searchParams:Promise.resolve(query)});
 allowed=false;await assert.rejects(render({}));assert.equal(prepared,0);allowed=true;
 await render({view:'contents'});await render({articleId:'article'});assert.equal(prepared,0);
 const result=await render({});assert.equal(prepared,1);assert.equal(result.props.children[1].props.cover.coverImageSrc,'data:image/webp;base64,fixture');assert.equal(hints.length,0);
});
