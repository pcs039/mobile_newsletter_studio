/* eslint-disable @typescript-eslint/no-require-imports -- Isolated read-only share entry fixtures. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const token='A'.repeat(43),slug='hwaseong-2026-10-samples',projectId='4cd5297e-a0fd-434c-84d4-fa4d3baf9389';
function harness({allowed=true,failed=false,foreign=false,expires=null}={}){
 const calls=[];
 const load=loader({'@/lib/staging-environment':{stagingRequestAllowed:()=>allowed},'@/lib/demo-share':{
  demoHeaders:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'},demoCookieName:()=> 'demo-only',
  getDemoAccess:async(t,s)=>{calls.push([t,s]);if(failed)throw Error('revoked/expired/stale/invalid');return{project:{slug,id:foreign?'other':projectId},share:{expires_at:expires}};},
 }});
 return{get:load('src/app/demo/open/[token]/route.ts').GET,calls};
}
const request=()=>new Request('https://canva-staging.datadiction.co.kr/demo/open/'+token);
const ctx={params:Promise.resolve({token})};
test('fragment-free mobile entry validates the original grant and redirects to token-free cover; no share is issued',async()=>{
 const h=harness(),r=await h.get(request(),ctx);
 assert.deepEqual(h.calls,[[token,slug]]);assert.equal(r.status,303);
 assert.equal(r.headers.get('location'),'https://canva-staging.datadiction.co.kr/demo?project='+slug);
 const cookie=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=lax','Path=/'])assert(cookie.includes(flag));
 assert(!/Expires=|Max-Age=/i.test(cookie));assert(!r.headers.get('location').includes(token));
 assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('x-robots-tag'),/noindex/);
});
test('existing expiry is retained rather than extended',async()=>{const expires='2030-01-01T00:00:00.000Z',h=harness({expires}),r=await h.get(request(),ctx);assert(r.headers.get('set-cookie').includes('Expires=Tue, 01 Jan 2030'));});
test('Production and ordinary Preview cannot use the mobile entry and perform no lookup',async()=>{const h=harness({allowed:false}),r=await h.get(request(),ctx);assert.equal(r.status,404);assert.equal(h.calls.length,0);assert.equal(r.headers.get('set-cookie'),null);});
test('revoked/expired/stale/invalid grants never set a cookie or echo the bearer in an error',async()=>{const h=harness({failed:true}),r=await h.get(request(),ctx);assert.equal(r.status,410);assert.equal(r.headers.get('set-cookie'),null);assert(!(await r.text()).includes(token));});
test('other projects cannot use the Staging mobile handoff',async()=>{const h=harness({foreign:true}),r=await h.get(request(),ctx);assert.equal(r.status,404);assert.equal(r.headers.get('set-cookie'),null);});
