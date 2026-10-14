/* eslint-disable @typescript-eslint/no-require-imports -- Pure contracts and mocked file access; no deployed writes. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const load=loader(),helper=load('src/lib/ai-image-article.ts');
const project='11111111-1111-4111-8111-111111111111',articleId='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',blockId='44444444-4444-4444-8444-444444444444',key='a'.repeat(64);
const block={id:blockId,type:'image',assetId:null,title:'개념 이미지',body:'',isVisible:true,metadata:{managed_by:'ai_image_article_v1',source:'openai',source_asset_id:id,generated_for_article_id:articleId,visual_strategy:'ai_generated_image',generation_key:key,variant_index:1,applied_role:'hero'}};
const article={id:articleId,title:'제목',blocks:[block,{id:'paragraph',type:'paragraph',body:'보존 원문',metadata:{}}],status:'published',publicationKind:'monthly'};
const asset={id,projectId:project,isActive:true,approvalStatus:'approved',assetType:'background',mimeType:'image/png',storageBucket:'design-production-assets',storagePath:`projects/${project}/production/openai/generated.png`,metadata:{source:'openai',imageGeneration:{generatedForArticleId:articleId,visualStrategy:'ai_generated_image',generationKey:key}}};
test('strict managed block discriminates ordinary images and preserves source copy',()=>{
 assert.equal(helper.readAiImageBlock(block).role,'hero');assert.equal(helper.readAiImageBlock({...block,assetId:id}),null);
 for(const patch of [{source:'canva'},{source_asset_id:'invalid'},{generated_for_article_id:'bad'},{applied_role:'hero_background'},{generation_key:'bad'},{variant_index:'1'}])assert.equal(helper.readAiImageBlock({...block,metadata:{...block.metadata,...patch}}),null);
 const before=JSON.stringify(article),source=helper.aiImageSourceArticle(article);assert.equal(source.blocks.length,1);assert.equal(source.blocks[0].body,'보존 원문');assert.equal(JSON.stringify(article),before);
 assert.equal(helper.aiImageHero(article),null);assert.equal(helper.aiImageHero({...article,blocks:[{...block,body:'/api/public-files/preview?aiImageBlock='+blockId}]}).id,blockId);
});
for(const [name,patch] of [['same article',{}],['other project',{projectId:'other'}],['other article',{metadata:{...asset.metadata,imageGeneration:{...asset.metadata.imageGeneration,generatedForArticleId:'other'}}}],['inactive',{isActive:false}],['archived',{approvalStatus:'archived'}],['Canva',{metadata:{source:'canva'}}]])test('candidate ownership: '+name,()=>assert.equal(helper.isArticleAiImageAsset({...asset,...patch},project,articleId),name==='same article'));

function serverFixture(patch={}){
 const calls=[],oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='mock';
 global.fetch=async url=>{calls.push(url);return new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/png'}});};
 const server=loader({'@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:[article]}),getProjectDesignAssets:async()=>({ok:true,assets:[{...asset,...patch}]})},'@/lib/supabase-config':{getSupabaseStorageEndpoint:p=>'https://storage.invalid'+p,getSupabaseRestEndpoint:p=>'https://rest.invalid'+p}})('src/lib/ai-image-article-server.ts');
 return{server,calls,close(){global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}};
}
test('file proxy maps block reference only, streams PNG, keeps HTML and never exposes private path',async()=>{
 const f=serverFixture();try{const mapped=await f.server.mapAiImageArticles(project,'slug',[article],'preview');assert(mapped[0].blocks[0].body.includes('aiImageBlock='+blockId));assert(!JSON.stringify(mapped).includes('production/openai'));assert.equal(mapped[0].blocks[1].body,'보존 원문');assert.equal((await f.server.serveAiArticleImage(project,'slug',articleId,blockId,true)).status,200);}finally{f.close();}
});
for(const patch of [{approvalStatus:'draft'},{isActive:false},{projectId:'other'},{storagePath:'projects/other/private.png'},{metadata:{...asset.metadata,imageGeneration:{...asset.metadata.imageGeneration,generatedForArticleId:'other'}}}])test('file proxy denies unsafe asset '+JSON.stringify(patch),async()=>{
 const f=serverFixture(patch);try{assert.equal((await f.server.serveAiArticleImage(project,'slug',articleId,blockId,true)).status,404);assert.equal(f.calls.length,0);}finally{f.close();}
});
test('apply route: fixed Staging/admin/origin, stale confirmation and approval before atomic call; no auto approval',async()=>{
 let gate=true,origin=true,admin=true,approval='draft',stale=true,conflict=false,calls=0;
 const route=loader({'@/lib/staging-environment':{requireStagingE2E(){if(!gate)throw Error();}},'@/lib/article-image-api-origin':{requireImageSameOrigin(){if(!origin)throw Error();}},'@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:true,user:{role:admin?'admin':'reviewer'},project:{id:project,slug:'fixture',primaryColor:'#092046'}})},'@/lib/ai-image-article-server':{getAiImageApplyState:async()=>({snapshot:'b'.repeat(32),conflict,connections:[],candidates:[{id,generationKey:key,approvalStatus:approval,stale}]}),aiImageArticleRpc:async()=>{calls++;return{applied:true};}}})('src/app/api/project-content/ai-image-apply/route.ts');
 const request=(patch={})=>new Request('https://test.invalid/api/project-content/ai-image-apply',{method:'POST',body:JSON.stringify({projectSlug:'fixture',articleId,assetId:id,role:'hero',action:'apply',expected:'b'.repeat(32),generationKey:key,...patch})});
 gate=false;assert.equal((await route.POST(request())).status,502);gate=true;origin=false;assert.equal((await route.POST(request())).status,502);origin=true;admin=false;assert.equal((await route.POST(request())).status,403);admin=true;
 assert.equal((await route.POST(request())).status,403);approval='approved';assert.equal((await route.POST(request())).status,409);assert.equal(calls,0);
 assert.equal((await route.POST(request({confirmedStale:true}))).status,200);assert.equal(calls,1);
 stale=false;conflict=true;assert.equal((await route.POST(request())).status,409);assert.equal(calls,1);
});
test('migration remains function-only and independent of Canva RPC',()=>{
 const sql=require('node:fs').readFileSync('supabase/schema_v1_37_ai_image_article_atomic.sql','utf8');
 assert(!/create\s+(table|index|policy)|alter\s+table|delete from public.newsletter_project_design_assets/i.test(sql));
 assert(!sql.includes('apply_newsletter_canva_full_layout_atomic'));assert(sql.includes('for update'));assert(sql.includes('for share'));assert(sql.includes('from public,anon,authenticated'));
});
test('managed article application alone preserves the original generation key and quality spec',()=>{
 const e=load('src/lib/visual-director-image-execution.ts');
 const source={title:'계절의 가을 문화',summary:'계절 분위기를 표현하는 개념 생활문화 이미지',body:'가을의 상징과 감성을 개념 이미지로 전달합니다.',articleType:'general',publicInfo:{},blocks:[],links:[]};
 const first=e.prepareDirectorImage(project,articleId,source,['#092046']);
 const attached=e.prepareDirectorImage(project,articleId,{...source,blocks:[block]},['#092046']);
 assert.equal(first.generationKey,attached.generationKey);assert.deepEqual(first.specification,attached.specification);
});
test('private file routes enforce project/admin and pending review access for AI references',async()=>{
 let served=0,admin=false,published=false,review='pending';
 const overrides={'@/lib/ai-image-article-server':{serveAiArticleImage:async()=>{served++;return Response.json({});}},'@/lib/newsletter-repository':{getProjectWorkspace:async()=>({ok:true,project:{id:project,statusCode:published?'published':'draft'}})},'@/lib/project-api-access':{requireProjectApiAccess:async()=>admin?{ok:true}:{ok:false,response:Response.json({}, {status:401})}},'@/lib/client-review-render':{clientReviewResponseHeaders:{},clientReviewAccessStatus:()=>401,getClientReviewSession:async()=>({status:admin?'ok':'expired',message:'denied',data:{project:{id:project},review:{status:review}}})}};
 const url='https://example.com/api/public-files/preview?project=fixture&articleId='+articleId+'&aiImageBlock='+blockId;
 const publicRoute=loader(overrides)('src/app/api/public-files/preview/route.ts');
 assert.equal((await publicRoute.GET(new Request(url))).status,404);assert.equal((await publicRoute.GET(new Request(url+'&preview=admin'))).status,401);assert.equal(served,0);
 admin=true;assert.equal((await publicRoute.GET(new Request(url+'&preview=admin'))).status,200);published=true;assert.equal((await publicRoute.GET(new Request(url))).status,200);
 const reviewRoute=loader(overrides)('src/app/api/client-review/files/route.ts');admin=false;assert.equal((await reviewRoute.GET(new Request(url))).status,401);admin=true;review='approved';assert.equal((await reviewRoute.GET(new Request(url))).status,409);review='pending';assert.equal((await reviewRoute.GET(new Request(url))).status,200);assert.equal(served,3);
});
