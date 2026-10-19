/* eslint-disable @typescript-eslint/no-require-imports -- Isolated actual TS route/component tests. */
const test=require('node:test'), assert=require('node:assert/strict'), React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const loader=require('./canva-test-loader.cjs');
const load=loader(), helpers=load('src/lib/admin-article-preview.ts');
const project='11111111-1111-4111-8111-111111111111',article='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
function routeFixture(access={ok:true,project:{id:project,slug:'fixture'}}, overrides={}){
 const calls=[];
 const audio={getPublicArticleAudioManifest:async(...args)=>{calls.push(['manifest',...args]);return {ok:true,manifest:{hasAudio:true,source:'ai_tts',stale:false,segments:[{index:0,url:'private-original'}]}};},downloadPublicArticleAudioSegment:async(...args)=>{calls.push(['segment',...args]);return {ok:true,body:'mp3-bytes',contentLength:'9'};},...overrides};
 const GET=loader({'@/lib/project-api-access':{requireProjectApiAccess:async input=>{calls.push(['access',input]);return access;}},'@/lib/article-tts-audio':audio})('src/app/api/project-article-preview/audio/route.ts').GET;
 return {calls,get:query=>GET(new Request('https://fixture.test/api/project-article-preview/audio?'+(query||`project=fixture&article=${article}`)))};
}
test('admin mapper is immutable, changes only AI manifest, keeps uploaded URL and source provenance',()=>{
 const input=[{id:article,audioFile:{id:'audio',sourceType:'ai_tts'}},{id:other,audioFile:{sourceType:'uploaded',previewHref:'/api/public-files/preview?bucket=audio-files&path=existing'}},{id:'none',audioFile:null}];
 const before=JSON.stringify(input),mapped=helpers.mapAdminArticleAudio('fixture',input);
 assert.equal(JSON.stringify(input),before);assert.equal(mapped[0].audioFile.manifestHref,helpers.adminArticleAudioHref('fixture',article));assert.strictEqual(mapped[1],input[1]);assert.strictEqual(mapped[2],input[2]);
});
test('authorized manifest and segment reuse the exact server-authorized project scope, with no-store',async()=>{
 const f=routeFixture();let r=await f.get();assert.equal(r.status,200);let body=await r.json();assert.equal(body.segments[0].url,helpers.adminArticleAudioHref('fixture',article,0));assert.deepEqual(f.calls[1],['manifest','fixture',article,project]);
 for(const header of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])assert.match(r.headers.get(header),/no-store/);
 r=await f.get(`project=fixture&article=${article}&segment=0&projectId=${other}&path=forged`);assert.equal(await r.text(),'mp3-bytes');assert.deepEqual(f.calls.at(-1),['segment','fixture',article,0,project]);assert.equal(r.headers.get('content-type'),'audio/mpeg');
});
test('anonymous, other assignee, and locked project never invoke audio service',async()=>{
 for(const status of [401,403]){const f=routeFixture({ok:false,response:new Response('denied',{status})});const r=await f.get();assert.equal(r.status,status);assert.equal(f.calls.length,1);assert.match(r.headers.get('Cache-Control'),/no-store/);}
});
test('missing article/cross-project article and missing segment retain 404 and private cache policy',async()=>{
 const deny=async()=>({ok:false,httpStatus:404,message:'not found'});const f=routeFixture(undefined,{getPublicArticleAudioManifest:deny,downloadPublicArticleAudioSegment:deny});
 for(const q of [`project=fixture&article=${other}`,`project=fixture&article=${article}&segment=1`]){const r=await f.get(q);assert.equal(r.status,404);assert.match(r.headers.get('Cache-Control'),/no-store/);}
});
test('malformed identifiers and segment indexes cannot reach auth/service',async()=>{
 for(const q of [`project=fixture&article=invalid`,`project=fixture&article=${article}&segment=-1`,`project=fixture&article=${article}&segment=0.5`,`project=fixture&article=${article}&segment=1000000`]){const f=routeFixture();assert.equal((await f.get(q)).status,404);assert.equal(f.calls.length,0);}
});
test('network failure is explicit private 502 with no raw exception leak',async()=>{
 const f=routeFixture(undefined,{getPublicArticleAudioManifest:async()=>{throw Error('sensitive path');}});const r=await f.get();assert.equal(r.status,502);assert(!JSON.stringify(await r.json()).includes('sensitive'));assert.match(r.headers.get('Cache-Control'),/no-store/);
});
test('actual audio service preserves published-only public access, allows authorized project, and scopes article lookup',async()=>{
 const fetchBefore=global.fetch,env=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';const urls=[];
 global.fetch=async url=>{urls.push(String(url));if(String(url).includes('/newsletter_projects?'))return Response.json([{id:project,slug:'fixture',status:'draft',article_tts_voice:'marin'}]);if(String(url).includes('/newsletter_articles?'))return Response.json([]);throw Error('unexpected request');};
 try{const svc=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:path=>'https://db.test'+path}})('src/lib/article-tts-audio.ts');assert.equal((await svc.getPublicArticleAudioManifest('fixture',article)).httpStatus,404);assert.equal(urls.length,1);assert.equal((await svc.getPublicArticleAudioManifest('fixture',other,project)).httpStatus,404);assert(urls.at(-1).includes('project_id=eq.'+project));assert(urls.at(-1).includes('id=eq.'+other));assert.equal((await svc.getPublicArticleAudioManifest('fixture',article,other)).httpStatus,404);}
 finally{global.fetch=fetchBefore;if(env===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=env;}
});
test('iframe payload validates channel, project and allowlisted article; cover clears current article',()=>{
 const valid={type:helpers.previewArticleMessage,project:'fixture',channel:'frame:1',articleId:article};
 assert.deepEqual(helpers.readPreviewArticleMessage(valid,'fixture','frame:1',[article]),{articleId:article});
 for(const patch of [{project:'other'},{channel:'frame:0'},{articleId:other},{articleId:'javascript:alert(1)'},{type:'other'}])assert.equal(helpers.readPreviewArticleMessage({...valid,...patch},'fixture','frame:1',[article]),null);
 assert.deepEqual(helpers.readPreviewArticleMessage({...valid,articleId:null},'fixture','frame:1',[article]),{articleId:null});
});
test('only relative admin article reader URLs enable the iframe bridge',()=>{
 assert.equal(helpers.previewArticleContext('/newsletters/fixture?preview=admin&articleId='+article).articleId,article);
 for(const href of ['https://evil.test/newsletters/fixture?preview=admin','//evil.test/newsletters/fixture?preview=admin','/newsletters/fixture?articleId='+article,'/newsletters/fixture/ebook?preview=admin','/newsletters/%ZZ?preview=admin'])assert.equal(helpers.previewArticleContext(href),null);
});
test('admin current edit href uses allowlisted current ID; public reader has no preview edit controls',()=>{
 const {AdminPreviewArticleNavigation}=load('src/components/admin-preview-article-navigation.tsx');
 const render=id=>renderToStaticMarkup(React.createElement(AdminPreviewArticleNavigation,{slug:'fixture',articleIds:[article,other],articleId:id,mobile:true,embedded:false}));
 assert(render(other).includes('articleId='+other));assert(!render(null).includes('/reading?'));assert(!render('forged').includes('/reading?'));
 const {PublicMobileArticleReader}=load('src/components/public-mobile-article-reader.tsx');const html=renderToStaticMarkup(React.createElement(PublicMobileArticleReader,{articles:[],slug:'fixture',publicationTitle:'Fixture',showAdminPreviewControls:false}));assert(!html.includes('data-admin-preview-navigation'));assert(!html.includes('/reading?'));
});
test('actual iframe listener rejects wrong origin/window, stale channel and foreign article; valid navigation updates parent links',()=>{
 const effects=[],refs=[],states=[];let cursor=0;const frameWindow={},listeners={};
 const hooks={...React,useId:()=>':frame:',useMemo:fn=>fn(),useEffect:fn=>effects.push(fn),useRef:initial=>{const ref={current:initial};refs.push(ref);return ref;},useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}};
 const {AdminMobilePreviewFrame}=loader({'react':hooks})('src/components/admin-mobile-preview-frame.tsx');
 const props={previewHref:'/newsletters/fixture?preview=admin&articleId='+article,articleIds:[article,other]};
 const render=()=>{cursor=0;return renderToStaticMarkup(React.createElement(AdminMobilePreviewFrame,props));};
 render();refs[0].current={contentWindow:frameWindow};
 const previousWindow=global.window;global.window={location:{origin:'https://fixture.test'},addEventListener:(name,fn)=>{listeners[name]=fn;},removeEventListener(){}};
 try{const cleanup=effects[0]();const msg={type:helpers.previewArticleMessage,project:'fixture',channel:':frame::0:'+article,articleId:other};
 for(const event of [{origin:'https://evil.test',source:frameWindow,data:msg},{origin:'https://fixture.test',source:{},data:msg},{origin:'https://fixture.test',source:frameWindow,data:{...msg,channel:'old'}},{origin:'https://fixture.test',source:frameWindow,data:{...msg,articleId:project}}])listeners.message(event);
 assert.equal(states[3],null);listeners.message({origin:'https://fixture.test',source:frameWindow,data:msg});assert.equal(states[3].articleId,other);const html=render();assert(html.includes('/reading?articleId='+other));assert(html.includes('articleId='+other));cleanup();}
 finally{if(previousWindow===undefined)delete global.window;else global.window=previousWindow;}
});
test('AI player has no empty src/page refetch before manifest resolves',()=>{
 const {PublicArticleAudioPlayer}=load('src/components/public-article-audio-player.tsx');const html=renderToStaticMarkup(React.createElement(PublicArticleAudioPlayer,{isAiGenerated:true,manifestUrl:'/api/project-article-preview/audio?project=fixture&article='+article,src:''}));assert(!html.includes('src=""'));assert(html.includes('<audio'));
});
test('article player stop event and unmount pause, reset and clear the media resource',()=>{
 const effects=[],refs=[],listeners={};const hooks={...React,useEffect:fn=>effects.push(fn),useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:initial=>{const r={current:initial};refs.push(r);return r;},useCallback:fn=>fn};
 const {PublicArticleAudioPlayer}=loader({'react':hooks})('src/components/public-article-audio-player.tsx');renderToStaticMarkup(React.createElement(PublicArticleAudioPlayer,{isAiGenerated:true,manifestUrl:'/admin-audio',ariaLabel:'QA'}));
 let paused=0,cleared=0,loaded=0;const audio={currentTime:10,pause(){paused++;},removeAttribute(name){assert.equal(name,'src');cleared++;},load(){loaded++;}};refs[0].current=audio;
 const previous=global.window;global.window={addEventListener:(name,fn)=>{listeners[name]=fn;},removeEventListener(){}};
 try{const cleanup=effects[1]();listeners['datadiction:stop-article-audio']();assert.equal(audio.currentTime,0);assert.equal(paused,1);cleanup();assert.equal(paused,2);assert.equal(cleared,1);assert.equal(loaded,1);}
 finally{if(previous===undefined)delete global.window;else global.window=previous;}
});
test('review and demo audio retain their own session gates and segment URLs',async()=>{
 for(const kind of ['client-review','demo-share']){
  let allowed=true;const calls=[];const data={project:{id:project},articles:[{id:article,audioSource:'ai_tts'}]};
  const audio={getPublicArticleAudioManifest:async(...a)=>{calls.push(a);return{ok:true,manifest:{hasAudio:true,segments:[{index:0,url:'/public'}]}};},downloadPublicArticleAudioSegment:async()=>({ok:true,body:'audio'})};
  const common={clientReviewResponseHeaders:{'Cache-Control':'private, no-store'},getClientReviewSession:async()=>allowed?{status:'ok',data:{project:{id:project},review:{status:'pending'}}}:{status:'revoked',message:'revoked'},clientReviewAccessStatus:()=>410,getClientReviewRenderData:async()=>data};
  const GET=loader({'@/lib/article-tts-audio':audio,'@/lib/client-review-render':common,'@/lib/demo-share':{demoHeaders:{'Cache-Control':'private, no-store'}},'@/lib/demo-share-render':{getDemoRenderData:async()=>allowed?{access:{project:{id:project}},data}:null}})(`src/app/api/${kind}/audio/route.ts`).GET;
  const url=`https://fixture.test/api/${kind}/audio?project=fixture&article=${article}`;let r=await GET(new Request(url));assert.equal(r.status,200);assert((await r.json()).segments[0].url.startsWith(`/api/${kind}/audio?`));assert.deepEqual(calls[0],['fixture',article,project]);allowed=false;r=await GET(new Request(url));assert.equal(r.status,410);assert.equal(calls.length,1);
 }
});
