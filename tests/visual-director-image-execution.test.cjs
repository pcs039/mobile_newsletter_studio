/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server contracts; no provider traffic. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const load=loader(),spec=load('src/lib/visual-director-image-spec.ts'),real=load('src/lib/article-image-generation.ts');
const project='11111111-1111-4111-8111-111111111111',articleId='22222222-2222-4222-8222-222222222222';
const article={title:'가을 문화와 계절의 감성',summary:'가을 분위기와 상징적인 개념으로 문화 이야기를 전합니다.',body:'생활정보와 계절 분위기를 소개합니다. 상징과 개념을 활용한 편안한 배경으로 문화 이야기를 전합니다.',articleType:'general',publicInfo:{},blocks:[],links:[]};
function harness(patch={}){
 let job=null,asset=null,claimCount=0;const calls={provider:0,registration:0,dimensions:null};
 const repo={readImageProcessingJob:async()=>job,claimImageProcessingJob:async(p,id,a,key)=>{claimCount++;if(job)return false;job={id,project_id:p,status:'processing',started_at:new Date().toISOString(),request_payload:{articleId:a,generationKey:key},result_payload:{}};return true;},
 finishImageProcessingJob:async(p,id,assetId,unknown)=>{job.status=assetId?'succeeded':'failed';job.result_payload=assetId?{assetId}:{};job.error_code=unknown?'unknown':null;}};
 const execution=loader({'@/lib/article-image-generation':{...real,imageGenerationEnabled:()=>true,validateGeneratedImage:(b,r,d)=>{calls.dimensions=d;return{bytes:Buffer.from('png')};}},
 '@/lib/article-image-provider':{guardedImageGeneration:async(a,k,h,run)=>run(),requestArticleImage:async()=>{calls.provider++;if(patch.error)throw patch.error;return'png';}},
 '@/lib/generated-image-asset-repository':{findGeneratedImageAsset:async(proof,provenance)=>asset?.projectId===proof.projectId&&asset?.key===provenance.generationKey?{id:asset.id,name:asset.name}:null,
 registerGeneratedImageAsset:async(proof,bytes,name,provenance)=>{calls.registration++;asset={id:proof.assetId,name,projectId:proof.projectId,key:provenance.generationKey,provenance};return{id:asset.id,name,duplicate:false};}},
 '@/lib/design-processing/repository':repo,...patch.overrides})('src/lib/visual-director-image-execution.ts');
 const input={projectId:project,articleId,article,adminId:'admin',palette:['#092046'],action:'prepare'};
 return{module:execution,input,calls,repo,get job(){return job;},set job(v){job=v;},get asset(){return asset;},get claims(){return claimCount;},async generate(){const prepared=await execution.executeDirectorImage(input);return execution.executeDirectorImage({...input,action:'generate',expectedKey:prepared.generationKey});}};
}
test('pure conceptual spec bounded, deterministic, text-free public/mobile default4:5; original copy unchanged',()=>{
 const before=JSON.stringify(article),a=spec.buildDirectorImageSpec(article);assert.deepEqual(a,spec.buildDirectorImageSpec(article));assert.equal(a.aspectRatio,'4:5');assert.equal(a.textInImage,false);assert.equal(a.factualityMode,'conceptual');assert.equal(a.subject,article.title);assert.equal(a.context,article.summary);assert(a.reasons.length);assert.equal(JSON.stringify(article),before);
 const prompt=spec.buildDirectorImagePrompt(a,['#092046']);assert(prompt.includes('Absolutely no text'));assert(!prompt.includes(article.body));assert(prompt.includes('public institution'));assert(prompt.includes('central 60%'));
 assert.equal(spec.buildDirectorImageSpec({...article,articleType:'life_civil'}).aspectRatio,'1:1');assert.equal(spec.buildDirectorImageSpec({...article,articleType:'government_major'}).aspectRatio,'16:9');
});
test('real person/place, institution and urgent HTML are not eligible even if supplied strategy says conceptual',async()=>{
 for(const copy of [{title:'김민수 시장 인터뷰',body:'기관장 인터뷰로 질문과 답변, 실제 주민 의견을 소개합니다.'},{title:'중앙도서관 개관',body:'시설 내부와 외관을 방문하여 실제 현장 사진을 촬영합니다.'},{title:'긴급 교통 통제',body:'즉시 우회하세요. 도로 통제 구간과 변경 내용을 안내합니다.',urgency:'urgent'}]){
  const a={...article,...copy};assert.equal(spec.buildDirectorImageSpec(a),null);const h=harness();await assert.rejects(h.module.executeDirectorImage({...h.input,article:a}),e=>e.status===409);assert.equal(h.calls.provider,0);
 }
 assert(!spec.directorImageEligible({primaryStrategy:'ai_generated_image',needsGeneratedImage:true,humanInputRequired:true,needsRealPhoto:false}));
});
test('stable generation key excludes private/temporary URLs, changes on source, director/project/article/palette inputs',()=>{
 const h=harness(),p=h.module.prepareDirectorImage(project,articleId,article,['#092046']);assert.deepEqual(p,h.module.prepareDirectorImage(project,articleId,article,['#092046']));
 assert.equal(p.generationKey,h.module.prepareDirectorImage(project,articleId,{...article,privateMetadata:'SECRET',previewUrl:'temporary'},['#092046']).generationKey);
 for(const q of [h.module.prepareDirectorImage('other',articleId,article,['#092046']),h.module.prepareDirectorImage(project,'other',article,['#092046']),h.module.prepareDirectorImage(project,articleId,{...article,title:article.title+' 이야기'},['#092046']),h.module.prepareDirectorImage(project,articleId,article,['#abcdef'])])assert.notEqual(p.generationKey,q.generationKey);
 assert(!JSON.stringify(p.payload).includes(article.body));assert.equal(p.payload.n,1);assert.equal(p.payload.size,'1536x1920');
});
test('prepare/status do not generate or register; fresh key mismatch blocks provider',async()=>{
 const h=harness(),p=await h.module.executeDirectorImage(h.input);assert.equal(p.status,'ready');await h.module.executeDirectorImage({...h.input,action:'status',expectedKey:p.generationKey});assert.equal(h.claims,0);assert.equal(h.calls.provider,0);
 await assert.rejects(h.module.executeDirectorImage({...h.input,action:'generate',expectedKey:'0'.repeat(64)}),e=>e.status===409);assert.equal(h.calls.provider,0);
});
test('one generation registers draft provenance via shared repository; success reuses asset and private-ID thumbnail; original unchanged',async()=>{
 const h=harness(),before=JSON.stringify(article),r=await h.generate();assert.equal(r.status,'success');assert.equal(h.calls.provider,1);assert.equal(h.calls.registration,1);assert.deepEqual(h.calls.dimensions,{width:1536,height:1920});assert.equal(h.asset.provenance.visualStrategy,'ai_generated_image');assert.equal(h.asset.provenance.factualityMode,'conceptual');assert.equal(h.asset.provenance.generatedForArticleId,articleId);assert(!r.asset.previewHref.includes('projects/'));assert.equal(JSON.stringify(article),before);
 const repeat=await h.module.executeDirectorImage({...h.input,action:'generate',expectedKey:r.generationKey});assert.equal(repeat.duplicate,true);assert.equal(repeat.asset.id,r.asset.id);assert.equal(h.calls.provider,1);
});
for(const status of ['processing','failed','unknown'])test(status+' never triggers additional provider request; processing only polls',async()=>{
 const h=harness(),p=await h.module.executeDirectorImage(h.input);h.job={status:status==='unknown'?'failed':status,started_at:new Date().toISOString(),request_payload:{articleId,generationKey:p.generationKey},result_payload:{},error_code:status==='unknown'?'unknown':null};
 const r=await h.module.executeDirectorImage({...h.input,action:'generate',expectedKey:p.generationKey});assert.equal(r.status,status==='processing'?'in_progress':status);assert.equal(h.calls.provider,0);assert.equal(h.claims,0);
});
test('stalled processing becomes unknown, not regenerated',async()=>{const h=harness(),p=await h.module.executeDirectorImage(h.input);h.job={status:'processing',started_at:new Date(0).toISOString(),request_payload:{articleId,generationKey:p.generationKey},result_payload:{}};assert.equal((await h.generate()).status,'unknown');assert.equal(h.calls.provider,0);});
test('timeout retained terminal unknown; explicit retry does not issue new POST',async()=>{const h=harness({error:new real.ImageGenerationError(504,'timeout')}),r=await h.generate();assert.equal(r.status,'unknown');assert.equal((await h.generate()).status,'unknown');assert.equal(h.calls.provider,1);assert.equal(h.calls.registration,0);});
test('concurrent claims allow only one provider call, other returns existing in-progress',async()=>{
 const h=harness(),p=await h.module.executeDirectorImage(h.input);const results=await Promise.all([1,2].map(()=>h.module.executeDirectorImage({...h.input,action:'generate',expectedKey:p.generationKey})));assert.equal(h.calls.provider,1);assert(results.some(r=>r.status==='success'));
});
test('wrong article persisted receipt cannot reuse or regenerate',async()=>{const h=harness(),p=await h.module.executeDirectorImage(h.input);h.job={status:'succeeded',request_payload:{articleId:'other',generationKey:p.generationKey},result_payload:{assetId:'wrong'}};await assert.rejects(h.generate(),e=>e.status===409);assert.equal(h.calls.provider,0);});
test('claim persistence failure stops before provider; registration ambiguity cannot re-generate',async()=>{
 const h=harness({overrides:{'@/lib/design-processing/repository':{readImageProcessingJob:async()=>null,claimImageProcessingJob:async()=>{throw new Error('timeout');}}}});await assert.rejects(h.generate());assert.equal(h.calls.provider,0);
 const k=harness({overrides:{'@/lib/generated-image-asset-repository':{findGeneratedImageAsset:async()=>null,registerGeneratedImageAsset:async()=>{throw new Error('unknown');}}}});assert.equal((await k.generate()).status,'unknown');assert.equal((await k.generate()).status,'unknown');assert.equal(k.calls.provider,1);
});
test('bounded metadata extension validates provenance and rejects arbitrary keys/text; source openai retained',()=>{
 const m=load('src/lib/design-asset-metadata.ts');const p={generatedForArticleId:articleId,visualStrategy:'ai_generated_image',generationPurpose:'article_visual',promptVersion:'v1',generationKey:'a'.repeat(64),factualityMode:'conceptual',textInImage:false};assert(m.validateDesignAssetMetadata({source:'openai',imageGeneration:p}).ok);
 for(const q of [{...p,textInImage:true},{...p,extra:'PRIVATE'},{...p,generatedForArticleId:'wrong'},{...p,factualityMode:'documentary'}])assert(!m.validateDesignAssetMetadata({source:'openai',imageGeneration:q}).ok);assert(!m.validateDesignAssetMetadata({source:'manual',imageGeneration:p}).ok);
});
test('shared asset registration director policy is draft/active/openai, legacy approval unchanged; JSONB order independent reuse',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test';let row=null,writes=0,uploads=0;
 const provenance={generatedForArticleId:articleId,visualStrategy:'ai_generated_image',generationPurpose:'article_visual',promptVersion:'v1',generationKey:'a'.repeat(64),factualityMode:'conceptual',textInImage:false};
 const repo=loader({'@/lib/article-image-generation':{...real,imageGenerationEnabled:()=>true},'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://test'+p,getSupabaseStorageEndpoint:p=>'https://test'+p},
 '@/lib/project-design-asset-write':{uploadProjectDesignAssetFile:async()=>{uploads++;return new Response(null,{status:200});},insertProjectDesignAssetRecord:async r=>{writes++;row=r;row.metadata.imageGeneration=Object.fromEntries(Object.entries(row.metadata.imageGeneration).reverse());return new Response(null,{status:201});}}})('src/lib/generated-image-asset-repository.ts');
 const proof={assetId:articleId,projectId:project,articleId,role:'hero_background',pattern:'event',model:'gpt-image-2.5-flare'};
 global.fetch=async url=>url.includes('/bucket/')?Response.json({public:false}):Response.json(row?[row]:[]);
 try{const a=await repo.registerGeneratedImageAsset(proof,Buffer.from('PNG'),'concept',provenance);assert.equal(row.approval_status,'draft');assert.equal(row.is_active,true);assert.equal(row.metadata.source,'openai');assert.equal(row.metadata.imageGeneration.generatedForArticleId,articleId);assert.equal(row.asset_type,'background');assert.equal((await repo.registerGeneratedImageAsset(proof,Buffer.from('PNG'),'concept',provenance)).duplicate,true);assert.equal(writes,1);assert.equal(uploads,1);assert.equal(a.id,articleId);row.is_active=false;await assert.rejects(repo.findGeneratedImageAsset(proof,provenance),e=>e.status===409);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
test('durable claim and terminal update scope project/id/provider/operation; request payload contains no prompt/secrets',async()=>{
 const oldFetch=global.fetch;const calls=[];const repo=loader({'@/lib/supabase-config':{getSupabaseConfigStatus:()=>({isConfigured:true,hasServiceRoleKey:true}),getSupabaseRestEndpoint:p=>'https://test'+p}})('src/lib/design-processing/repository.ts');const oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 global.fetch=async(url,o)=>{calls.push({url,o});return Response.json(o.method==='POST'?[{id:articleId}]:o.method==='PATCH'?[{id:articleId}]:[]);};
 try{assert.equal(await repo.claimImageProcessingJob(project,articleId,articleId,'a'.repeat(64)),true);await repo.finishImageProcessingJob(project,articleId,articleId);await repo.readImageProcessingJob(project,articleId);const body=JSON.parse(calls[0].o.body);assert.equal(body.status,'processing');assert.deepEqual(Object.keys(body.request_payload).sort(),['articleId','generationKey']);assert(calls[0].o.headers.Prefer.includes('ignore-duplicates'));for(const c of calls.slice(1)){const u=new URL(c.url);assert.equal(u.searchParams.get('project_id'),'eq.'+project);assert.equal(u.searchParams.get('provider'),'eq.ai');assert.equal(u.searchParams.get('operation'),'eq.ai_generate_asset');}assert.equal(new URL(calls[1].url).searchParams.get('status'),'eq.processing');
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
test('director route reuses admin/project/origin gates and strict server-only spec request; no client strategy accepted',async()=>{
 let calls=0,role='admin',authorized=true;const route=loader({'@/lib/staging-environment':{requireStagingE2E:r=>{if(new URL(r.url).hostname!=='canva-staging.datadiction.co.kr')throw new real.ImageGenerationError(403,'blocked');}},
 '@/lib/article-image-generation':{...real,imageGenerationEnabled:()=>true},'@/lib/project-api-access':{requireProjectApiAccess:async()=>authorized?{ok:true,user:{id:'admin',role},project:{id:project,slug:'test',primaryColor:'#092046'}}:{ok:false,response:new Response(null,{status:401})}},
 '@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:[{...article,id:articleId}]})},
 '@/lib/visual-director-image-execution':{executeDirectorImage:async p=>{calls++;assert.equal(p.article.title,article.title);assert.equal(p.projectId,project);return{status:'ready'};}}})('src/app/api/project-content/visual-asset-generation/route.ts');
 const p={projectSlug:'test',articleId,action:'director_prepare'},req=(body,origin='https://canva-staging.datadiction.co.kr')=>new Request(origin+'/api/project-content/visual-asset-generation',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
 assert.equal((await route.POST(req(p))).status,200);assert.equal(calls,1);assert.equal((await route.POST(req({...p,concept:{},role:'hero_background'}))).status,400);assert.equal((await route.POST(req({...p,articleId:project}))).status,404);
 role='client_review';assert.equal((await route.POST(req(p))).status,403);authorized=false;assert.equal((await route.POST(req(p))).status,401);authorized=true;role='admin';assert.equal((await route.POST(req(p,'https://production.test'))).status,403);assert.equal(calls,1);
});
test('admin ID thumbnail mapper refuses anonymous/review/cross-project without returning path or Storage bytes',async()=>{
 let user={role:'admin'},access=true,storage=0;const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 const route=loader({'@/lib/app-auth':{requireApiUser:async()=>user,unauthorizedJsonResponse:()=>new Response(null,{status:401})},'@/lib/project-api-access':{requireProjectApiAccess:async()=>access?{ok:true}:{ok:false,response:new Response(null,{status:403})}},'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://test'+p,getSupabaseStorageEndpoint:p=>'https://test/storage'+p}})('src/app/api/project-files/preview/route.ts');
 global.fetch=async url=>{if(url.includes('/storage/')){storage++;return new Response('PNG',{headers:{'Content-Type':'image/png'}});}return Response.json([{project_id:project,storage_bucket:'design-production-assets',storage_path:'projects/private/file.png',mime_type:'image/png'}]);};
 const req=()=>new Request('https://staging.test/api/project-files/preview?designAssetId='+articleId);
 try{let r=await route.GET(req());assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(await r.text(),'PNG');assert.equal(storage,1);access=false;assert.equal((await route.GET(req())).status,403);user={role:'client_review'};assert.equal((await route.GET(req())).status,403);user=null;assert.equal((await route.GET(req())).status,401);assert.equal(storage,1);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
