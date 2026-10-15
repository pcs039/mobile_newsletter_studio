/* eslint-disable @typescript-eslint/no-require-imports -- Node contract tests. */
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./canva-test-loader.cjs');
const {moveArticle,sameArticleOrder}=load()('src/lib/article-order.ts');
test('move preserves exact IDs and supports accessible up/down and drag targets',()=>{
 const initial=['a','b','c'];assert.deepEqual(moveArticle(initial,'a','c'),['b','c','a']);assert.deepEqual(moveArticle(initial,'c','a'),['c','a','b']);assert.deepEqual(initial,['a','b','c']);assert.equal(moveArticle(initial,'missing','a'),initial);assert(sameArticleOrder(initial,['a','b','c']));assert(!sameArticleOrder(initial,['a','b']));
});
const p='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',snapshot='a'.repeat(32);
function route({access=true,fail,origin=true}={}){
 const calls=[];class ArticleOrderError extends Error{constructor(status,message){super(message);this.status=status;}}
 const routes=load({'@/lib/project-api-access':{requireProjectApiAccess:async input=>{calls.push(['access',input]);return access?{ok:true,project:{id:p}}:{ok:false,response:Response.json({ok:false},{status:401})};}},'@/lib/article-order-server':{ArticleOrderError,articleOrderRpc:async(...args)=>{calls.push(['rpc',...args]);if(fail)throw new ArticleOrderError(fail,'목록 확인 필요');return {snapshot,articles:[{id:a,sortOrder:10,updatedAt:'2026-10-15T00:00:00Z'}]};}},'@/lib/article-image-api-origin':{requireImageSameOrigin:()=>{if(!origin)throw Error('blocked');}}})('src/app/api/project-content/order/route.ts');
 return {...routes,calls};
}
const request=(body)=>new Request('http://localhost/api/project-content/order',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify(body)});
const body={projectSlug:'fixture',articleIds:[a],snapshot};
test('order API: authenticated read-only snapshot and server-resolved project mutation',async()=>{const r=route();assert.equal((await r.GET(new Request('http://localhost/api/project-content/order?projectSlug=fixture'))).status,200);assert.deepEqual(r.calls[1],['rpc',p]);const response=await r.POST(request({...body,projectId:'untrusted'}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(r.calls.at(-1),['rpc',p,[a],snapshot]);});
test('order API: anon/review session cannot invoke snapshot or mutation',async()=>{const r=route({access:false});assert.equal((await r.GET(new Request('http://localhost/api/project-content/order?projectSlug=fixture'))).status,401);assert.equal((await r.POST(request(body))).status,401);assert.equal(r.calls.filter(c=>c[0]==='rpc').length,0);});
test('order API: cross-origin and invalid IDs/snapshot blocked before RPC',async()=>{const bad=route({origin:false});assert.equal((await bad.POST(request(body))).status,403);assert.equal(bad.calls.length,0);for(const patch of [{articleIds:[a,a]},{articleIds:['bad']},{snapshot:'stale'},{articleIds:null}]){const r=route();assert.equal((await r.POST(request({...body,...patch}))).status,400);assert.equal(r.calls.length,0);}});
test('order API: stale and unapplied migration retain explicit safe failure',async()=>{for(const fail of [409,503]){const r=route({fail});assert.equal((await r.POST(request(body))).status,fail);}});
test('regular public/preview ordering follows persisted list; rolling and interest policy stays separate',()=>{const {getPublicOrderedArticles}=load()('src/lib/article-publication.ts');const rows=['c','a','b'].map((id,i)=>({id,sortOrder:(i+1)*10,publicationKind:'regular',interestTags:[],institutionPriority:3}));assert.deepEqual(getPublicOrderedArticles(rows,[]).map(r=>r.id),['c','a','b']);});
