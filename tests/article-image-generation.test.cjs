/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const loader=require('./canva-test-loader.cjs'),load=loader();
const g=load('src/lib/article-image-generation.ts');
const concept={name:'PRIVATE',description:'PRIVATE',rationale:'PRIVATE',pattern:'event',visualTone:'friendly',layoutDirection:'friendly',colorDirection:'brand',assetRole:'both'};
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+data.length)),8+data.length);return b;}
function png(role,transparent=true){const w=1152,h=role==='hero_background'?1536:768,head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=6;const pixels=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels[y*(w*4+1)+1+x*4+3]=transparent?0:255;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
test('deterministic prompts separate independent roles, share style family and do not send free text or private data',()=>{
 const bg=g.buildImageGenerationRequest(concept,'hero_background',['#092046']);const ill=g.buildImageGenerationRequest(concept,'hero_illustration',['#092046']);
 assert.deepEqual(bg.family,ill.family);assert.equal(bg.payload.background,'opaque');assert.equal(ill.payload.background,'transparent');assert.equal(bg.payload.n,1);
 for(const p of [bg,ill]){assert(!p.payload.prompt.includes('PRIVATE'));assert(p.payload.prompt.includes('textInImage'));assert(p.payload.prompt.includes('safeArea'));assert(p.payload.prompt.includes('NO letters'));assert.equal(p.payload.output_format,'png');}
 assert.throws(()=>g.buildImageGenerationRequest({...concept,assetRole:'none'},'hero_background',[]));
});
test('PNG bytes/resolution/actual alpha and signed approval content integrity',()=>{
 const old=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test-secret';
 try{const b=g.validateGeneratedImage(png('hero_illustration'),'hero_illustration');assert(b.size>0);assert.throws(()=>g.validateGeneratedImage(png('hero_illustration',false),'hero_illustration'));
 const proof=g.signImageProof({projectId:'p',articleId:'a',adminId:'u',role:'hero_illustration',pattern:'event',hash:g.imageHash(b.bytes)});assert.equal(g.readImageProof(proof).hash,g.imageHash(b.bytes));assert.throws(()=>g.readImageProof(proof+'x'));assert.throws(()=>g.validateGeneratedImage('bad','hero_background'));
 }finally{if(old===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=old;}
});
test('generation guard joins identical requests, rejects changed/in-flight requests, never retries provider failure',async()=>{
 const {guardedImageGeneration}=load('src/lib/article-image-provider.ts');let calls=0,finish;
 const one=guardedImageGeneration('actor','key','fp',()=>{calls++;return new Promise(resolve=>finish=resolve);});
 const two=guardedImageGeneration('actor','key','fp',()=>{calls++;});
 await assert.rejects(guardedImageGeneration('actor','key','changed',async()=>{}));await assert.rejects(guardedImageGeneration('actor','other','fp',async()=>{}));finish('ok');assert.equal(await one,'ok');assert.equal(await two,'ok');assert.equal(calls,1);
 await assert.rejects(guardedImageGeneration('other','key','fp',async()=>{calls++;throw Error('fail');}));await assert.rejects(guardedImageGeneration('other','key','fp',async()=>{calls++;}));assert.equal(calls,2);
});
test('admin/project/Staging gates, generation write zero, proof approval dedup and tamper/anon/review rejection',async()=>{
 const extraNames=['APP_ENV','NEXT_PUBLIC_SITE_URL','SITE_URL','CANVA_REDIRECT_URI'];const extraOld=extraNames.map(k=>process.env[k]);Object.assign(process.env,{APP_ENV:'staging',NEXT_PUBLIC_SITE_URL:'https://canva-staging.datadiction.co.kr',SITE_URL:'https://canva-staging.datadiction.co.kr',CANVA_REDIRECT_URI:'https://canva-staging.datadiction.co.kr/api/canva/callback'});
 const old={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,vercel:process.env.VERCEL,env:process.env.VERCEL_ENV};
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://mvrkpmffuhcqwisqvpqi.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',VERCEL:'',VERCEL_ENV:''});
 let writes=0,calls=0,role='admin',accessOk=true;
 const {POST}=loader({'@/lib/project-api-access':{requireProjectApiAccess:async()=>accessOk?{ok:true,user:{id:'u',role},project:{id:'p',slug:'s',primaryColor:'#092046'}}:{ok:false,response:new Response(null,{status:401})}},
 '@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:[{id:'11111111-1111-4111-8111-111111111111',title:'PRIVATE ARTICLE'}]})},
 '@/lib/article-composition-repository':{getProjectArticleComposition:async()=>({status:'ok',data:{assets:[]}})},
 '@/lib/article-image-provider':{guardedImageGeneration:async(a,k,f,run)=>run(),requestArticleImage:async payload=>{calls++;assert(!payload.prompt.includes('PRIVATE'));return png('hero_background');}},
 '@/lib/generated-image-asset-repository':{registerGeneratedImageAsset:async proof=>{writes++;return {id:proof.assetId,name:'saved'};}}
 })('src/app/api/project-content/visual-asset-generation/route.ts');
 const input={action:'generate',projectSlug:'s',articleId:'11111111-1111-4111-8111-111111111111',role:'hero_background',concept,requestKey:'22222222-2222-4222-8222-222222222222'};
 const req=p=>new Request('https://canva-staging.datadiction.co.kr/api',{method:'POST',headers:{Origin:'https://canva-staging.datadiction.co.kr'},body:JSON.stringify(p)});
 try{const r=await POST(req(input));assert.equal(r.status,200);const b=await r.json();assert.equal(writes,0);assert.equal(calls,1);
 assert.equal((await POST(req({...input,role:'decoration'}))).status,400);
 assert.equal((await POST(req({...input,articleId:'33333333-3333-4333-8333-333333333333'}))).status,404);
 assert.equal((await POST(req({action:'approve',projectSlug:'s',articleId:input.articleId,proof:b.proof,base64:png('hero_background',false)}))).status,403);
 assert.equal((await POST(req({action:'approve',projectSlug:'s',articleId:input.articleId,proof:b.proof,base64:b.base64}))).status,200);assert.equal(writes,1);
 role='user';assert.equal((await POST(req(input))).status,403);accessOk=false;assert.equal((await POST(req(input))).status,401);
 accessOk=true;role='admin';process.env.VERCEL_ENV='production';assert.equal((await POST(req(input))).status,403);
 }finally{extraNames.forEach((k,i)=>extraOld[i]===undefined?delete process.env[k]:process.env[k]=extraOld[i]);for(const [k,v]of Object.entries({NEXT_PUBLIC_SUPABASE_URL:old.url,SUPABASE_SERVICE_ROLE_KEY:old.key,VERCEL:old.vercel,VERCEL_ENV:old.env})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('provider failure/timeout never retries or exposes raw error bodies',async()=>{
 const {requestArticleImage}=load('src/lib/article-image-provider.ts');const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test';
 try{for(const status of [400,401,429,500]){let calls=0;global.fetch=async()=>{calls++;return Response.json({error:{message:'PRIVATE SECRET BODY',param:'background'}},{status});};await assert.rejects(requestArticleImage({n:1}),e=>{assert(!e.message.includes('PRIVATE'));return true;});assert.equal(calls,1);}
 let calls=0;global.fetch=async()=>{calls++;throw Error('PRIVATE TIMEOUT');};await assert.rejects(requestArticleImage({n:1}),e=>e.status===504&&!e.message.includes('PRIVATE'));assert.equal(calls,1);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
});
