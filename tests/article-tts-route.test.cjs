/* eslint-disable @typescript-eslint/no-require-imports -- Isolated authenticated route mocks, no external services. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const articleId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333';
const path='src/app/api/projects/[projectId]/articles/[articleId]/tts/generate/route.ts';
function fixture(allowed=true){
 const calls=[];
 class ArticleTtsError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
 const route=loader({
  '@/lib/project-api-access':{requireProjectApiAccess:async()=>allowed?{ok:true,project:{id:'project'},user:{id:'writer',name:'writer',role:'user'}}:{ok:false,response:Response.json({ok:false},{status:401})}},
  '@/lib/article-image-api-origin':{requireImageSameOrigin:r=>{if(r.headers.get('origin')!==new URL(r.url).origin)throw Error('origin');}},
  '@/lib/article-tts-server':{ArticleTtsError,articleTtsStatus:async(...args)=>{calls.push(['GET',...args]);return {state:'processing',requestId};},generateSafeArticleTts:async(...args)=>{calls.push(['POST',...args]);return {ok:false,state:'unknown',requestId,code:'check_result_before_retry',httpStatus:502};}},
 })(path);
 const ctx={params:Promise.resolve({articleId,projectId:'sample-project'})};
 const body={requestId,previousRequestId:null,force:false,voice:'marin'};
 const request=value=>new Request('https://app.invalid/api/tts',{method:'POST',headers:{origin:'https://app.invalid','Content-Type':'application/json'},body:JSON.stringify(value)});
 return {route,calls,ctx,body,request};
}
test('unauthenticated GET and POST never reach data/provider services',async()=>{const f=fixture(false);assert.equal((await f.route.GET(new Request('https://app.invalid'),f.ctx)).status,401);assert.equal((await f.route.POST(f.request(f.body),f.ctx)).status,401);assert.equal(f.calls.length,0);});
test('status GET is authenticated read-only and private no-store',async()=>{const f=fixture(),r=await f.route.GET(new Request('https://app.invalid'),f.ctx);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal((await r.json()).state,'processing');assert.equal(f.calls[0][0],'GET');assert.equal(f.calls.length,1);});
test('cross-origin POST rejects before execution',async()=>{const f=fixture(),r=f.request(f.body);r.headers.set('origin','https://other.invalid');assert.equal((await f.route.POST(r,f.ctx)).status,403);assert.equal(f.calls.length,0);});
test('malformed, oversized and incomplete commands do not dispatch',async()=>{const f=fixture();for(const body of [{}, {...f.body,force:'true'},{...f.body,voice:'unknown'},{...f.body,previousRequestId:'invalid'},{...f.body,padding:'x'.repeat(2048)}])assert((await f.route.POST(f.request(body),f.ctx)).status>=400);assert.equal(f.calls.length,0);});
test('unknown execution result stays unknown without route retry',async()=>{const f=fixture(),r=await f.route.POST(f.request(f.body),f.ctx);assert.equal(r.status,502);assert.equal((await r.json()).state,'unknown');assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0][4],f.body);});
test('invalid article ID is rejected before access/data work',async()=>{const f=fixture();assert.equal((await f.route.GET(new Request('https://app.invalid'),{params:Promise.resolve({articleId:'invalid',projectId:'sample-project'})})).status,400);assert.equal(f.calls.length,0);});
