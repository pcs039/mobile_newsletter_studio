/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic quality/variant contracts, no provider traffic. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs'),load=loader();
const spec=load('src/lib/visual-director-image-spec.ts'),quality=load('src/lib/director-image-quality.ts'),execution=load('src/lib/visual-director-image-execution.ts');
const base={title:'행정서비스 생활정보 안내',summary:'공공서비스와 민원 이용을 단정하게 소개합니다.',body:'실제 장소가 아닌 추상적인 개념 배경과 상징적인 분위기로 생활정보를 전달합니다.',articleType:'general',publicInfo:{},blocks:[],links:[],urgency:'normal',publicationKind:'monthly'};
const fixtures=[
 ['public_editorial',base],
 ['public_illustration',{...base,title:'디지털 교육 서비스',summary:'온라인 학습을 설명하는 교육 안내입니다.'}],
 ['civic_lifestyle',{...base,title:'고령층 복지와 돌봄',summary:'어르신 건강과 가족의 생활을 돕는 주민 안내',articleType:'welfare_health'}],
 ['culture_visual',{...base,title:'계절을 느끼는 문화 여행',summary:'가을 문화와 관광 체험 분위기를 전합니다.',articleType:'tourism_place'}],
 ['conceptual_policy',{...base,title:'AI 데이터 도시 정책',summary:'추상적인 정책 구조와 데이터의 개념을 소개합니다.'}],
];
for(const [preset,article] of fixtures)test(preset+' deterministic spec; original unchanged',()=>{
 const before=JSON.stringify(article),s=spec.buildDirectorImageSpec(article);assert(s);assert.equal(s.stylePreset,preset);assert.deepEqual(s,spec.buildDirectorImageSpec(article));assert.equal(s.textInImage,false);assert.equal(s.factualityMode,'conceptual');assert.equal(s.variantIndex,1);assert.equal(s.headlineSafeArea,'top');assert.equal(JSON.stringify(article),before);
});
test('one isolated keyword does not override stronger combined signals',()=>{
 assert.equal(quality.chooseDirectorStyle({...base,title:'AI 디지털 교육 서비스',summary:'온라인 학습 이용 방법 설명'},[]),'public_illustration');
 assert.equal(quality.chooseDirectorStyle({...base,title:'문화',summary:''},[]),'public_editorial');
});
test('real person and urgent records remain outside image generation',()=>{
 assert.equal(spec.buildDirectorImageSpec({...base,urgency:'urgent'}),null);
 assert.equal(spec.buildDirectorImageSpec({...base,title:'김민수 시장 인터뷰',body:'기관장 인터뷰로 실제 인물의 사진을 제공합니다.'}),null);
});
test('supported size mapping: exact ratio, 1536 width, nonexperimental 16-multiple bounds',()=>{
 const square=spec.buildDirectorImageSpec({...base,articleType:'life_civil'}),wide=spec.buildDirectorImageSpec({...base,articleType:'government_major'});
 assert.equal(spec.buildDirectorImageSpec(base).aspectRatio,'4:5');assert.equal(square.aspectRatio,'1:1');assert.equal(square.headlineSafeArea,'center');assert.equal(wide.aspectRatio,'16:9');
 for(const [ratio,size] of Object.entries(quality.directorImageSizes)){assert(size.width>=1536);assert.equal(size.width%16,0);assert.equal(size.height%16,0);assert(size.width*size.height<=3686400);const [w,h]=ratio.split(':').map(Number);assert.equal(size.width/size.height,w/h);}
});
test('composed prompt has public safety rules, brand accent, separate HTML safe area, no source body/private URL',()=>{
 const a={...base,title:base.title+' https://private.test/SECRET',summary:base.summary+' storage/SECRET'},s=spec.buildDirectorImageSpec(a),prompt=spec.buildDirectorImagePrompt(s,['#092046','SECRET']);
 for(const rule of ['Absolutely no text','Korean/English','numbers','dates','phone numbers','URLs','CTA','logos','watermarks','neon/glossy','specific real people','mobile clarity','1536x1920','#092046','Headline safe area: top'])assert(prompt.includes(rule),rule);
 assert(!prompt.includes('SECRET'));assert(!prompt.includes(base.body));assert.equal(spec.buildDirectorImagePrompt(s,['#092046']),[spec.buildBasePrompt(s),spec.buildStylePrompt(s,['#092046']),spec.buildCompositionPrompt(s),spec.buildSafetyPrompt()].join('\n'));
});
test('same source/variant same key, different variant different key/job/asset, invalid variants refused',()=>{
 const prepare=(index)=>execution.prepareDirectorImage('project','article',base,['#092046'],undefined,index),first=prepare(1),second=prepare(2);
 assert.equal(first.generationKey,prepare(1).generationKey);assert.notEqual(first.generationKey,second.generationKey);assert.notEqual(first.jobId,second.jobId);assert.notEqual(first.assetId,second.assetId);assert.equal(second.payload.n,1);
 for(const i of [0,4,1.5,'2'])assert.equal(spec.buildDirectorImageSpec(base,undefined,i),null);
});
test('variant requires previous successful durable result, preserves jobs and reuses exact successful key',async()=>{
 const jobs=new Map(),assets=new Map();let calls=0;const real=load('src/lib/article-image-generation.ts');
 const e=loader({'@/lib/article-image-generation':{...real,imageGenerationEnabled:()=>true,validateGeneratedImage:()=>({bytes:Buffer.from('png')})},
 '@/lib/article-image-provider':{guardedImageGeneration:async(a,k,h,run)=>run(),requestArticleImage:async()=>{calls++;return'png';}},
 '@/lib/design-processing/repository':{readImageProcessingJob:async(p,id)=>jobs.get(id),claimImageProcessingJob:async(p,id,a,key)=>{if(jobs.has(id))return false;jobs.set(id,{status:'processing',started_at:new Date().toISOString(),request_payload:{articleId:a,generationKey:key},result_payload:{}});return true;},finishImageProcessingJob:async(p,id,assetId)=>{const j=jobs.get(id);j.status='succeeded';j.result_payload={assetId};}},
 '@/lib/generated-image-asset-repository':{findGeneratedImageAsset:async proof=>assets.get(proof.assetId),registerGeneratedImageAsset:async proof=>{const a={id:proof.assetId,name:'draft fixture'};assets.set(a.id,a);return a;}}})('src/lib/visual-director-image-execution.ts');
 const input={projectId:'project',articleId:'article',article:base,adminId:'admin',palette:['#092046'],action:'prepare'};
 await assert.rejects(e.executeDirectorImage({...input,variantIndex:2}),err=>err.status===409);assert.equal(calls,0);
 const p=await e.executeDirectorImage(input);const first=await e.executeDirectorImage({...input,action:'generate',expectedKey:p.generationKey});
 const secondPlan=await e.executeDirectorImage({...input,variantIndex:2});const second=await e.executeDirectorImage({...input,variantIndex:2,action:'generate',expectedKey:secondPlan.generationKey});assert.equal(calls,2);assert.equal(jobs.size,2);assert.notEqual(first.asset.id,second.asset.id);
 assert.equal((await e.executeDirectorImage({...input,variantIndex:2,action:'generate',expectedKey:secondPlan.generationKey})).duplicate,true);assert.equal(calls,2);
});
module.exports={fixtures};
test('article/project changes remount image session instead of leaking previous result or variant',()=>{
 const {VisualDirectorImageControls}=loader({'./staging-e2e-status':{},'./ai-image-article-controls':{AiImageArticleControls:()=>null}})('src/components/design/visual-director-image-controls.tsx');
 const p={article:base,articleId:'saved',projectSlug:'test',disabled:false,onBusy(){}};
 const first=VisualDirectorImageControls(p);assert.equal(first.key,VisualDirectorImageControls({...p}).key);
 for(const changed of [{...p,article:{...base,title:base.title+' 변경'}},{...p,articleId:'other'},{...p,projectSlug:'other'}])assert.notEqual(first.key,VisualDirectorImageControls(changed).key);
});
