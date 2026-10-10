/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server module harness. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const loader=require('./canva-test-loader.cjs');
const origin='https://canva-staging.datadiction.co.kr';
const deployment='mns-test.vercel.app';
const envNames=['VERCEL','VERCEL_ENV','VERCEL_URL','VERCEL_BRANCH_URL','CANVA_REDIRECT_URI'];
function withEnv(fn){const previous=envNames.map(k=>process.env[k]);Object.assign(process.env,{VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:deployment,VERCEL_BRANCH_URL:'mns-branch.vercel.app',CANVA_REDIRECT_URI:origin+'/api/canva/callback'});return Promise.resolve().then(fn).finally(()=>envNames.forEach((k,i)=>previous[i]===undefined?delete process.env[k]:process.env[k]=previous[i]));}
function request(host='canva-staging.datadiction.co.kr',extra={}){return new Request('https://'+deployment+'/api/canva/connection',{method:'POST',headers:{host,'x-forwarded-host':host,'x-forwarded-proto':'https',origin,...extra},body:JSON.stringify({projectSlug:'fixture'})});}
const m=loader()('src/lib/canva-request-origin.ts');
test('custom domain behind Vercel uses external origin; strict CSRF retained',()=>withEnv(()=>{
 assert.equal(m.canvaRequestOrigin(request()),origin);m.requireCanvaSameOrigin(request());
 for(const value of ['https://evil.example','null',''])assert.throws(()=>m.requireCanvaSameOrigin(request(undefined,{origin:value})));
 const noForwarded=request();noForwarded.headers.delete('x-forwarded-host');assert.equal(m.canvaRequestOrigin(noForwarded),origin);
}));
test('spoofed/ambiguous Host and forwarded host or wrong protocol rejected',()=>withEnv(()=>{
 for(const headers of [{'x-forwarded-host':'evil.example'},{host:'evil.example','x-forwarded-host':'evil.example'},{'x-forwarded-host':'canva-staging.datadiction.co.kr, evil.example'},{'x-forwarded-proto':'http'},{'x-forwarded-proto':'https,http'},{host:'canva-staging.datadiction.co.kr:443'}])assert.throws(()=>m.canvaRequestOrigin(request(undefined,headers)));
 delete process.env.VERCEL_URL;assert.throws(()=>m.canvaRequestOrigin(request()));
}));
test('outside Vercel proxy headers ignored; localhost origin rules retained',()=>withEnv(()=>{
 delete process.env.VERCEL;const r=new Request('http://localhost:3001/api/canva/connection',{headers:{host:'evil.example','x-forwarded-host':'canva-staging.datadiction.co.kr','x-forwarded-proto':'https',origin:'http://localhost:3001'}});
 assert.equal(m.canvaRequestOrigin(r),'http://localhost:3001');m.requireCanvaSameOrigin(r);assert.notEqual(m.canvaRequestOrigin(request()),origin);
}));
test('connection custom domain succeeds; direct Preview mismatch performs no DB writes',()=>withEnv(async()=>{
 let writes=0;
 const load=loader({'@/lib/canva-api-access':{sameOrigin:m.requireCanvaSameOrigin,canvaAdmin:async()=>({ok:true,project:{id:'p'},user:{id:'u'}}),canvaJson:(v,s=200)=>Object.assign(Response.json(v,{status:s}),{cookies:{set:()=>{}}}),canvaFailure:e=>Response.json({ok:false},{status:e.status||502}),canvaStateCookie:'state'},'@/lib/canva-connect-server':{canvaConfig:()=>({clientId:'test',redirectUri:process.env.CANVA_REDIRECT_URI})},'@/lib/canva-connection-repository':{ensureConnection:async()=>{writes++;},withConnectionLock:async(p,u,fn)=>fn({},async()=>{writes++;})}});
 const route=load('src/app/api/canva/connection/route.ts');
 const res=await route.POST(request());assert.equal(res.status,200);const data=await res.json();const url=new URL(data.url);assert.equal(url.origin,'https://www.canva.com');assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/canva/callback');assert.equal(writes,2);
 const preview=request(deployment,{origin:'https://'+deployment});assert.equal((await route.POST(preview)).status,503);assert.equal(writes,2);
 assert.equal((await route.POST(request(undefined,{'x-forwarded-host':'evil.example'}))).status,403);assert.equal(writes,2);
}));
test('callback uses canonical origin and exact path before state/cookie validation',()=>withEnv(async()=>{
 const load=loader({'next/headers':{cookies:async()=>({get:()=>undefined})},'@/lib/app-auth':{requireApiUser:async()=>({role:'admin'})},'@/lib/canva-connect-server':{canvaConfig:()=>({redirectUri:process.env.CANVA_REDIRECT_URI})},'@/lib/canva-api-access':{canvaFailure:e=>Object.assign(Response.json({message:e.message},{status:e.status||502}),{cookies:{set:()=>{}}}),canvaStateCookie:'state'}});
 const route=load('src/app/api/canva/callback/route.ts');const base=request();
 const r=url=>new Request(url,{headers:base.headers});
 const custom=await route.GET(r('https://'+deployment+'/api/canva/callback?state=x'));assert.equal(custom.status,400);assert.match((await custom.json()).message,/만료/);
 const wrong=await route.GET(r('https://'+deployment+'/api/canva/callback/'));assert.equal(wrong.status,400);assert.match((await wrong.json()).message,/callback/);
 const preview=await route.GET(new Request('https://'+deployment+'/api/canva/callback',{headers:request(deployment).headers}));assert.equal(preview.status,400);assert.match((await preview.json()).message,/callback/);
}));
