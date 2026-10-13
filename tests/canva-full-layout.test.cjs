/* eslint-disable @typescript-eslint/no-require-imports -- Existing isolated contract harness. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs'), React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const load=loader(),helper=load('src/lib/article-full-layout.ts');
const assetId='33333333-3333-4333-8333-333333333333',articleId='22222222-2222-4222-8222-222222222222',blockId='44444444-4444-4444-8444-444444444444';
const block={id:blockId,type:'image',title:'행사',body:'/api/public-files/preview?fullLayoutBlock='+blockId,isVisible:true,assetId:null,metadata:{managed_by:'canva_full_layout_v1',presentation_mode:'full_layout',design_source:'canva',design_asset_id:assetId,template_id:'event_festival_02',source_snapshot:'a'.repeat(32),applied_snapshot:'b'.repeat(32)}};
const article={id:articleId,title:'원문 제목',summary:'원문 요약',body:'원문 본문',articleType:'event_festival',publicInfo:{dateTime:'10월 25일',place:'시청광장'},contentPresentation:'image',showPublicTitle:false,blocks:[block,{id:'paragraph',type:'paragraph',body:'원문 문단',title:'문단',isVisible:true,metadata:{presentation_mode:'text',show_public_title:true}}],links:[{id:'link',label:'신청하기',isVisible:true,targetValue:'https://example.com',actionType:'url'}]};
test('full-layout discriminator is strict; ordinary image articles and invalid metadata cannot activate suppression',()=>{
 assert(helper.readFullLayout(block));assert(helper.activeFullLayout(article));
 for(const patch of [{presentation_mode:'image'},{design_source:'manual'},{design_asset_id:'other'},{template_id:'unknown'}])assert.equal(helper.readFullLayout({...block,metadata:{...block.metadata,...patch}}),null);
 assert.equal(helper.activeFullLayout({...article,blocks:[{...block,body:''}]}),null);assert.deepEqual(helper.originalFullLayoutPresentation(article),{contentPresentation:'text',showPublicTitle:true});
 const source={title:'原文',showPublicTitle:true,blocks:[article.blocks[1]]};assert.equal(helper.fullLayoutSourceVersion(source),helper.fullLayoutSourceVersion({...source,showPublicTitle:false,blocks:[...source.blocks,block]}));
});
test('shared full-layout renderer places text in collapsed companion only, actual safe CTA outside, resize targets and hidden heading remain',()=>{
 const component=loader({'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>React.createElement('button',{},'크게')}})('src/components/article-full-layout.tsx').ArticleFullLayout;
 const html=renderToStaticMarkup(React.createElement(component,{article,block}));const before=html.split('<details')[0],companion=html.split('<details')[1];
 assert(before.includes('class="sr-only"'));assert(before.includes('https://example.com'));assert(!before.includes('원문 요약'));assert(!before.includes('시청광장'));assert(!before.includes('원문 문단'));
 for(const text of ['텍스트로 읽기','원문 제목','원문 요약','시청광장','원문 문단','data-public-text-scale-target','크게'])assert(companion.includes(text));assert(!html.includes('hero_background'));assert(html.includes('h-auto w-full object-contain'));
});
function serverFixture(options={}){
 const target={...article,blocks:article.blocks.map(b=>({...b}))};const asset={id:assetId,projectId:'project',isActive:true,approvalStatus:'approved',assetType:'card_frame',mimeType:'image/png',storageBucket:'design-production-assets',storagePath:'projects/private/image.png',metadata:{source:'canva',canvaExport:{articleId,templateId:'event_festival_02',format:'png'}} ,...options.asset};
 const calls=[];const fakeFetch=async(url,opts)=>{calls.push({url,opts});if(url.endsWith('apply_newsletter_canva_full_layout_atomic'))return Response.json({snapshot:'b'.repeat(32),blockId,applied:!options.stale});return new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/png'}});};
 const original=global.fetch;global.fetch=fakeFetch;const old=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='mock';
 const l=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://test.invalid'+p,getSupabaseStorageEndpoint:p=>'https://storage.invalid'+p},'@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:[target]}),getProjectDesignAssets:async()=>({assets:[asset]})}});
 return{server:l('src/lib/article-full-layout-server.ts'),calls,target,cleanup(){global.fetch=original;if(old===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=old;}};
}
test('file mapper verifies approved ownership/provenance/snapshot; URLs contain block IDs and never Storage paths',async()=>{
 const f=serverFixture();try{const mapped=await f.server.mapFullLayouts('project','slug',[f.target],'preview');assert(mapped[0].blocks[0].body.includes('preview=admin'));assert(!JSON.stringify(mapped).includes('projects/private'));assert.equal((await f.server.serveFullLayout('project','slug',articleId,blockId,true)).status,200);}finally{f.cleanup();}
 for(const asset of [{projectId:'other'},{isActive:false},{approvalStatus:'draft'},{metadata:{source:'canva',canvaExport:{articleId:'other',templateId:'event_festival_02',format:'png'}}}]){const g=serverFixture({asset});try{assert.equal((await g.server.serveFullLayout('project','slug',articleId,blockId,true)).status,404);assert.equal(g.calls.filter(c=>c.url.startsWith('https://storage.invalid')).length,0);}finally{g.cleanup();}}
 const stale=serverFixture({stale:true});try{const fallback=await stale.server.mapFullLayouts('project','slug',[stale.target],'public');assert.equal(fallback[0].blocks[0].isVisible,false);assert.equal(fallback[0].showPublicTitle,true);}finally{stale.cleanup();}
});
test('function migration contains no table/column/index/policy changes; service-only, snapshot and ownership gates remain explicit',()=>{
 const sql=require('node:fs').readFileSync('supabase/schema_v1_36_canva_full_layout_atomic.sql','utf8');assert(!/create\s+(table|index|policy)|alter\s+table/i.test(sql));for(const token of ['for update','for share',"'source_snapshot'","'applied_snapshot'","asset.approval_status <> 'approved'","'full_layout_conflict'","from public,anon,authenticated"])assert(sql.includes(token));
});

test('public/preview/review routes enforce existing project/admin and valid pending review access before full-layout file serving',async()=>{
 let served=0,published=false,admin=false,status='ok',review='pending';
 const shared={'@/lib/article-full-layout-server':{serveFullLayout:async()=>{served++;return Response.json({ok:true});}},'@/lib/project-api-access':{requireProjectApiAccess:async()=>admin?{ok:true}:{ok:false,response:Response.json({}, {status:401})}},'@/lib/newsletter-repository':{getProjectWorkspace:async()=>({ok:true,project:{id:'project',statusCode:published?'published':'draft'}})},'@/lib/client-review-render':{clientReviewResponseHeaders:{},clientReviewAccessStatus:()=>410,getClientReviewSession:async()=>({status,message:'denied',data:{review:{status:review},project:{id:'project'}}})}};
 const pub=loader(shared)('src/app/api/public-files/preview/route.ts');
 const url='https://example.com/api/public-files/preview?project=slug&articleId='+articleId+'&fullLayoutBlock='+blockId;
 assert.equal((await pub.GET(new Request(url))).status,404);assert.equal((await pub.GET(new Request(url+'&preview=admin'))).status,401);assert.equal(served,0);
 admin=true;assert.equal((await pub.GET(new Request(url+'&preview=admin'))).status,200);published=true;assert.equal((await pub.GET(new Request(url))).status,200);
 const rev=loader(shared)('src/app/api/client-review/files/route.ts');for(const blocked of ['expired','revoked']){status=blocked;assert.equal((await rev.GET(new Request(url))).status,410);}status='ok';review='approved';assert.equal((await rev.GET(new Request(url))).status,409);review='pending';assert.equal((await rev.GET(new Request(url))).status,200);assert.equal(served,3);
});

test('apply endpoint requires fixed Staging, same origin and project admin before RPC; canonical template allowlist remains enforced',async()=>{
 let allowed=true,origin=true,admin=true,rpcCalls=0;
 const route=loader({'@/lib/staging-environment':{requireStagingE2E(){if(!allowed)throw Error('blocked');}},'@/lib/canva-api-access':{sameOrigin(){if(!origin)throw Error('blocked');},canvaAdmin:async()=>admin?{ok:true,project:{id:'project'}}:{ok:false,response:Response.json({}, {status:401})},canvaJson:Response.json,canvaFailure:()=>Response.json({}, {status:403})},'@/lib/article-full-layout-server':{fullLayoutRpc:async()=>{rpcCalls++;return{snapshot:'a'.repeat(32),applied:true};}}})('src/app/api/canva/article-apply/route.ts');
 const input={projectSlug:'slug',articleId,assetId,templateId:'event_festival_02',action:'apply',expected:'a'.repeat(32)};
 const request=p=>new Request('https://canva-staging.datadiction.co.kr/api/canva/article-apply',{method:'POST',body:JSON.stringify(p)});
 allowed=false;assert.equal((await route.POST(request(input))).status,403);allowed=true;origin=false;assert.equal((await route.POST(request(input))).status,403);origin=true;admin=false;assert.equal((await route.POST(request(input))).status,401);admin=true;
 assert.equal((await route.POST(request({...input,templateId:'unknown'}))).status,403);assert.equal(rpcCalls,0);assert.equal((await route.POST(request(input))).status,200);assert.equal(rpcCalls,1);
});
