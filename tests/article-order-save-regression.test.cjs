/* eslint-disable @typescript-eslint/no-require-imports -- Isolated repository/reader contracts. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const {compareArticleBaseOrder}=loader()('src/lib/article-order.ts');
test('legacy duplicate/zero positions remain stable across content, image, design and audio timestamp changes',()=>{
 const source=ids.map((id,i)=>({id,sortOrder:i===2?10:0,updatedAt:`2026-01-0${3-i}T00:00:00Z`}));
 const original=[...source].sort(compareArticleBaseOrder).map(a=>a.id);
 for(const changedField of ['body','image','design','audio']){
  const edited=source.map(a=>({...a,updatedAt:a.id===ids[1]?'2030-01-01T00:00:00Z':a.updatedAt,[changedField]:'changed'})).reverse();
  assert.deepEqual(edited.sort(compareArticleBaseOrder).map(a=>a.id),original);
 }
 assert.equal(source[0].updatedAt,'2026-01-03T00:00:00Z');
 assert.deepEqual([...source].reverse().sort(compareArticleBaseOrder).map(a=>a.id),original);
});
test('order RPC adapter neutralizes legacy updated_at ordering without changing snapshot or explicit reorder receipt',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';const calls=[];
 const state={snapshot:'a'.repeat(32),duplicate:true,articles:[{id:ids[1],sortOrder:0,updatedAt:'2030-01-01'},{id:ids[0],sortOrder:0,updatedAt:'2026-01-01'},{id:ids[2],sortOrder:10,updatedAt:'2026-01-01'}]};
 global.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body));return Response.json(state);};
 try{const {articleOrderRpc}=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://test.invalid'+p}})('src/lib/article-order-server.ts');
 const read=await articleOrderRpc(ids[0]);assert.deepEqual(read.articles.map(a=>a.id),ids);assert.equal(read.snapshot,state.snapshot);assert.equal(read.duplicate,true);assert.deepEqual(state.articles.map(a=>a.id),[ids[1],ids[0],ids[2]]);
 state.articles=[{id:ids[2],sortOrder:10,updatedAt:'2030-01-01'},{id:ids[1],sortOrder:20,updatedAt:'2026-01-01'},{id:ids[0],sortOrder:30,updatedAt:'2026-01-01'}];
 const reordered=await articleOrderRpc(ids[0],[ids[2],ids[1],ids[0]],state.snapshot);assert.deepEqual(reordered.articles.map(a=>a.id),[ids[2],ids[1],ids[0]]);assert.deepEqual(calls[1].p_ordered_article_ids,[ids[2],ids[1],ids[0]]);assert.equal(calls[1].p_expected_snapshot,state.snapshot);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
test('common content query has one deterministic order clause; saved article edits do not reshuffle public base order',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';let articleRequests=0;
 let rows=ids.map((id,i)=>({id,project_id:ids[0],sort_order:i===2?10:0,title:'기사 '+i,body:'원문',updated_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',publication_kind:'regular',urgency:'normal'}));
 global.fetch=async raw=>{const u=new URL(raw);if(u.pathname.endsWith('/newsletter_projects'))return Response.json([{id:ids[0],slug:'test',title:'테스트',status:'draft',updated_at:'2026-01-01'}]);if(u.pathname.endsWith('/newsletter_articles')){articleRequests++;assert.deepEqual(u.searchParams.getAll('order'),['sort_order.asc,id.asc']);return Response.json([...rows].reverse());}return Response.json([]);};
 try{const load=loader({'@/lib/supabase-config':{getSupabaseConfigStatus:()=>({isConfigured:true,anonKey:'fixture'}),getSupabaseRestEndpoint:p=>'https://test.invalid'+p}}),repo=load('src/lib/newsletter-repository.ts'),{getPublicOrderedArticles}=load('src/lib/article-publication.ts');
 const before=await repo.getProjectContent('test');assert.equal(before.source,'supabase');assert.deepEqual(before.articles.map(a=>a.id),ids);
 rows=rows.map(a=>a.id===ids[1]?{...a,updated_at:'2030-01-01T00:00:00Z',body:'수정한 본문'}:a);
 const after=await repo.getProjectContent('test');assert.equal(after.source,'supabase');assert.deepEqual(after.articles.map(a=>a.id),ids);assert.deepEqual(getPublicOrderedArticles(after.articles,[]).map(a=>a.id),ids);assert.equal(after.articles[1].body,'수정한 본문');assert.equal(articleRequests,2);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
test('base-order correction preserves rolling urgency, institutional priority and selected-interest policy',()=>{
 const {getPublicOrderedArticles}=loader()('src/lib/article-publication.ts');const now=new Date('2026-10-19T00:00:00Z');
 const base=[{id:ids[1],sortOrder:20,publicationKind:'regular',interestTags:['문화']},{id:ids[0],sortOrder:10,publicationKind:'regular',interestTags:['정책']},{id:ids[2],sortOrder:30,publicationKind:'rolling',urgency:'urgent',institutionPriority:5,status:'published',validUntil:'2026-10-20T00:00:00Z'}].sort(compareArticleBaseOrder);
 assert.deepEqual(getPublicOrderedArticles(base,[],now).map(a=>a.id),[ids[2],ids[0],ids[1]]);assert.deepEqual(getPublicOrderedArticles(base,['문화'],now).map(a=>a.id),[ids[2],ids[1],ids[0]]);
});
