/* eslint-disable @typescript-eslint/no-require-imports -- Scoped cookie transport/SSR/session mocks, no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextRequest}=require('next/server'),loader=require('./canva-test-loader.cjs');
const token='A'.repeat(43),slug='hwaseong-2026-10-samples',shareId='44444444-4444-4444-8444-444444444444';
const oldInfo=console.info;test.before(()=>console.info=()=>{});test.after(()=>console.info=oldInfo);
function proxyHarness(allowed=true){return loader({'@/lib/staging-environment':{stagingRequestAllowed:()=>allowed},'@/lib/demo-share':{demoCookieName:()=> 'demo-cookie',demoHeaders:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}}})('src/proxy.ts');}
test('entry transport issues only scoped secure opaque cookie, never redirects/queries DB/consumes grant, including preview GET',async()=>{
 const old=global.fetch;let calls=0;global.fetch=()=>{calls++;throw Error('must not fetch');};
 try{for(const ua of ['Android Chrome','SamsungBrowser','KAKAOTALK','kakaotalk-scrap']){
 const mod=proxyHarness(),r=mod.proxy(new NextRequest('https://stage.invalid/demo/open/'+token,{headers:{'user-agent':ua}}));assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);const c=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=lax','Path=/'])assert(c.includes(flag));assert(!/Expires=|Max-Age=/i.test(c));assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(calls,0);assert.equal(mod.config.matcher,'/demo/open/:token');
 }}finally{global.fetch=old;}
});
test('Production/ordinary Preview, invalid token shape and non-GET methods receive no candidate cookie',()=>{
 assert.equal(proxyHarness(false).proxy(new NextRequest('https://stage.invalid/demo/open/'+token)).headers.get('set-cookie'),null);
 for(const [url,method]of [['bad','GET'],[token,'POST']])assert.equal(proxyHarness().proxy(new NextRequest('https://stage.invalid/demo/open/'+url,{method})).headers.get('set-cookie'),null);
});
test('same existing cookie is reused; unrelated auth cookies never change',()=>{
 const r=proxyHarness().proxy(new NextRequest('https://stage.invalid/demo/open/'+token,{headers:{cookie:'demo-cookie='+token+'; unrelated=kept'}}));assert.equal(r.headers.get('set-cookie'),null);
});
const settle=()=>new Promise(r=>setTimeout(r,15));
function sessionHarness(response){
 const states=[],effects=[],handlers=new Map(),history=[],requests=[];let cursor=0;const oldWindow=global.window,oldFetch=global.fetch;
 global.window={location:{pathname:'/demo/open/'+token,href:'https://stage.invalid/demo/open/'+token+'?articleId=article&interest=pets'},history:{replaceState:(_s,_t,u)=>{history.push(u);global.window.location.pathname='/demo';}},addEventListener:(k,f)=>handlers.set(k,f),removeEventListener:k=>handlers.delete(k)};
 global.fetch=async(url,opt)=>{requests.push({url,opt});const data=typeof response==="function"?await response():response;return Response.json(data,{status:data.ok?200:401});};
 const Comp=loader({react:{...React,useState(v){const i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=v];},useEffect:f=>effects.push(f)}})('src/components/demo-share-session.tsx').DemoShareSession;
 return{history,requests,handlers,render(){cursor=0;return Comp({slug,shareId,expiresAt:null,children:React.createElement('article',null,'검증된 표지'),confirmOnMount:true});},mount(){return effects[0]();},close(){global.window=oldWindow;global.fetch=oldFetch;}};
}
test('first SSR cover is present before hydration; one GET confirms cookie and strips token in-place without reloading',async()=>{
 const h=sessionHarness({ok:true,shareId});let clean;try{const first=renderToStaticMarkup(h.render());assert.match(first,/검증된 표지/);assert.match(first,/inert/);assert(!first.includes('소식지 열기'));clean=h.mount();await settle();assert.equal(h.requests.length,1);assert.equal(h.requests[0].opt.method,undefined);assert.equal(h.requests[0].opt.credentials,'same-origin');assert.equal(h.history.length,1);assert(!h.history[0].includes(token));assert(h.history[0].includes('articleId=article'));assert(h.history[0].includes('interest=pets'));const ready=renderToStaticMarkup(h.render());assert(!ready.includes('inert'));assert(!ready.includes('소식지 준비 중'));
 }finally{clean?.();h.close();}
});
for(const code of ['SESSION_MISSING','REVOKED','EXPIRED','SOURCE_CHANGED'])test('cookie check '+code+' hides reader safely without redirects or automatic retries',async()=>{
 const h=sessionHarness({ok:false,code});let clean;try{h.render();clean=h.mount();await settle();assert.equal(h.history.length,0);const html=renderToStaticMarkup(h.render());assert.match(html,new RegExp(code));assert(!html.includes('검증된 표지'));assert(!html.includes(token));h.handlers.get('focus')();await settle();assert.equal(h.requests.length,1);
 }finally{clean?.();h.close();}
});
test('cover loading shell contains no private assets, entry button or time-based return to instructions',()=>{const html=renderToStaticMarkup(loader()('src/app/demo/open/[token]/loading.tsx').default());assert.match(html,/role="status"/);assert(!html.includes('<button'));assert(!html.includes('<img'));assert(!html.includes('소식지 열기'));});

test('focus events do not duplicate an in-flight initial cookie verification',async()=>{
 let complete;const pending=new Promise(r=>complete=r),h=sessionHarness(()=>pending);let clean;
 try{h.render();clean=h.mount();h.handlers.get('focus')();h.handlers.get('focus')();assert.equal(h.requests.length,1);complete({ok:true,shareId});await settle();assert.equal(h.history.length,1);}finally{clean?.();h.close();}
});
