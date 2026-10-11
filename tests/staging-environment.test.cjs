/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server modules. */
const {test}=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const origin='https://canva-staging.datadiction.co.kr';
const settings={APP_ENV:'staging',NEXT_PUBLIC_SUPABASE_URL:'https://mvrkpmffuhcqwisqvpqi.supabase.co',NEXT_PUBLIC_SITE_URL:origin,SITE_URL:origin,CANVA_REDIRECT_URI:origin+'/api/canva/callback',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'mns-test.vercel.app'};
async function withEnv(fn){const old=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]]));Object.assign(process.env,settings);try{await fn();}finally{for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}}
const m=loader()('src/lib/staging-environment.ts');
const request=(host='canva-staging.datadiction.co.kr',extra={})=>new Request('https://mns-test.vercel.app/api',{headers:{host,'x-forwarded-host':host,'x-forwarded-proto':'https',...extra}});
test('all configuration gates required; deployment Preview origin remains blocked',()=>withEnv(()=>{
 assert(m.stagingEnvironmentConfigured());assert(m.stagingRequestAllowed(request()));
 assert(!m.stagingRequestAllowed(request('mns-test.vercel.app')));
 for(const [key,value]of Object.entries({APP_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://qmhvlbpedudpwtznletj.supabase.co',NEXT_PUBLIC_SITE_URL:'https://production.example',SITE_URL:'',CANVA_REDIRECT_URI:origin+'/wrong',VERCEL_ENV:'production'})){
  process.env[key]=value;assert(!m.stagingEnvironmentConfigured(),key);assert.throws(()=>m.requireStagingE2E(request()));process.env[key]=settings[key];
 }
}));
test('spoofed forwarded host/proto and local origin cannot enable E2E',()=>withEnv(()=>{
 for(const headers of [{'x-forwarded-host':'evil.example'},{'x-forwarded-proto':'http'}])assert(!m.stagingRequestAllowed(request(undefined,headers)));
 delete process.env.VERCEL;assert(!m.stagingRequestAllowed(new Request('http://localhost/api',{headers:{host:'canva-staging.datadiction.co.kr'}})));
}));
test('blocked connection/autofill/export/callback/generation never reach provider or writes',()=>withEnv(async()=>{
 let calls=0;const forbidden=()=>{calls++;throw Error('must not run');};
 const load=loader({'@/lib/app-auth':{requireApiUser:async()=>({role:'admin'})},'@/lib/canva-api-access':{canvaAdmin:forbidden,canvaFailure:e=>Object.assign(Response.json({}, {status:e.status||502}),{cookies:{set:()=>{}}}),sameOrigin:()=>{}},'@/lib/article-image-api-origin':{requireImageSameOrigin:()=>{}}});
 const req=new Request('https://mns-test.vercel.app/api',{method:'POST',headers:request('mns-test.vercel.app').headers,body:'{}'});
 for(const file of ['connection','autofill','png-import'])assert.equal((await load(`src/app/api/canva/${file}/route.ts`).POST(req.clone())).status,403);
 const callback=await load('src/app/api/canva/callback/route.ts').GET(request('mns-test.vercel.app'));assert.equal(callback.status,403);
 const image=await load('src/app/api/project-content/visual-asset-generation/route.ts').POST(req.clone());assert.equal(image.status,403);assert.equal(calls,0);
}));

test('read-only readiness endpoint requires admin; returns flags only before domain cutover',()=>withEnv(async()=>{
 let user=null;const load=loader({'@/lib/app-auth':{requireApiUser:async()=>user,unauthorizedJsonResponse:()=>Response.json({}, {status:401})}});
 const route=load('src/app/api/staging-status/route.ts');
 assert.equal((await route.GET(request())).status,401);user={role:'reader'};assert.equal((await route.GET(request())).status,403);
 user={role:'admin'};const data=await (await route.GET(request('mns-test.vercel.app'))).json();
 assert.equal(data.configured,true);assert.equal(data.enabled,false);assert.equal(data.supabaseRef,'mvrkpmffuhcqwisqvpqi');
 assert.deepEqual(Object.keys(data).sort(),['ok','configured','enabled','stagingUrl','supabaseRef','callbackOriginMatches','canvaConfigured','openaiConfigured'].sort());
 assert.equal((await (await route.GET(request())).json()).enabled,true);
}));
