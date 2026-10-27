/* eslint-disable @typescript-eslint/no-require-imports -- Isolated contracts and route fixtures, no remote calls. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const article='b48352e0-dbbe-4cca-bbcc-f88988b27d32',project='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',slug='hwaseong-2026-10-samples',origin='https://canva-staging.datadiction.co.kr';
const contract=loader()('src/lib/hwaseong-participation-contract.ts');
test('plain text accepts Korean/English and rejects contact details, links, HTML, controls and limits',()=>{
 assert.equal(contract.safeParticipationText('  의견\r\nThank you 🐶 ',30),'의견\nThank you 🐶');
 for(const value of ['','<script>alert(1)</script>','010-1234-5678','a@example.com','https://bad.invalid','1234567890','a\u0000b','가'.repeat(301)])assert.throws(()=>contract.safeParticipationText(value,300));
});
test('short-lived form proof binds article, authenticated actor and time; never accepts a missing secret',()=>{
 const old=process.env.NEWSLETTER_AUTH_SECRET;process.env.NEWSLETTER_AUTH_SECRET='isolated-test-secret';
 try {const m=loader({'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true}})('src/lib/hwaseong-participation-server.ts'),actor=m.participationActor('fixture-user'),at=100000,token=m.participationToken(article,actor,at);
  assert.match(actor,/^[a-f0-9]{64}$/);assert(!token.includes('fixture-user'));m.verifyParticipationToken(token,article,actor,at+1500);
  for(const args of [[token,article,actor,at+100],[token,article,actor,at+1200001],[token,article,'b'.repeat(64),at+2000],[token+'x',article,actor,at+2000],[token,'other',actor,at+2000]])assert.throws(()=>m.verifyParticipationToken(...args));
  delete process.env.NEWSLETTER_AUTH_SECRET;assert.throws(()=>m.participationActor('fixture-user'));
 }finally{if(old===undefined)delete process.env.NEWSLETTER_AUTH_SECRET;else process.env.NEWSLETTER_AUTH_SECRET=old;}
});
function routes({staging=true,role='user',sameOrigin=true,authorized=true}={}){
 const calls=[];
 const server={participationProjectId:project,ParticipationError:class extends Error{constructor(status,message){super(message);this.status=status;}},participationActor:()=> 'a'.repeat(64),requireParticipationArticle:async id=>{if(id!==article)throw new server.ParticipationError(404,'not found');},verifyParticipationToken:()=>{},participationView:async()=>({survey:null,token:'proof'}),participationReceipt:async()=>({id:'request',state:'pending',kind:'private'}),participationAdminData:async()=>({entries:[{kind:'private',body:'관리자만 확인'}]}),manageParticipation:async input=>{calls.push(input);return{ok:true};},submitParticipation:async(a,b,input)=>{calls.push(input);return{id:input.requestId,state:'pending'};}};
 const route=loader({'@/lib/staging-environment':{stagingRequestAllowed:()=>staging},'@/lib/project-api-access':{requireProjectApiAccess:async()=>authorized?{ok:true,user:{id:'fixture',role},project:{id:project,statusCode:'draft'}}:{ok:false,response:new Response(null,{status:401})}},'@/lib/canva-request-origin':{requireCanvaSameOrigin:()=>{if(!sameOrigin)throw Error();}},'@/lib/hwaseong-participation-server':server})('src/app/api/projects/[projectId]/sample-participation/route.ts');
 const ctx={params:Promise.resolve({projectId:slug})},get=q=>route.GET(new Request(`${origin}/api/projects/${slug}/sample-participation?${q}`),ctx),post=(body,headers={})=>route.POST(new Request(`${origin}/api/projects/${slug}/sample-participation`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)}),ctx);
 return{get,post,calls,route,ctx};
}
const input={requestId:'01111111-1111-4111-8111-111111111111',articleId:article,kind:'private',body:'시연 의견',token:'proof',consent:true,website:''};
test('Production/general Preview and wrong project are rejected before data access',async()=>{
 assert.equal((await routes({staging:false}).get(`articleId=${article}`)).status,404);
 const h=routes();assert.equal((await h.route.GET(new Request(origin),{params:Promise.resolve({projectId:'other'})})).status,404);
});
test('unauthenticated and unauthorized moderation are refused; reader data does not expose private responses or comments',async()=>{
 assert.equal((await routes({authorized:false}).get(`articleId=${article}`)).status,401);
 const h=routes();assert.equal((await h.get('admin=1')).status,403);assert.equal((await h.post({action:'approve',id:input.requestId,privacyChecked:true})).status,403);
 const r=await h.get(`articleId=${article}`),body=await r.json();assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(body.comments,undefined);assert(!JSON.stringify(body).includes('관리자만 확인'));
});
test('same origin, bounded JSON and known article are checked before writes',async()=>{
 for(const h of [routes({sameOrigin:false})]){assert.equal((await h.post(input)).status,403);assert.equal(h.calls.length,0);}
 const h=routes();assert.equal((await h.post({...input,body:'가'.repeat(17000)})).status,413);assert.equal((await h.post({...input,articleId:'21111111-1111-4111-8111-111111111111'})).status,404);assert.equal(h.calls.length,0);
});
test('new comments, moderation, reactivation and explicit comment reads are refused before any write',async()=>{
 const h=routes({role:'admin'});
 for(const payload of [{...input,kind:'comment'},{action:'approve',id:input.requestId,privacyChecked:true},{action:'reject',id:input.requestId},{action:'settings',commentsEnabled:true,surveyId:''}])assert.equal((await h.post(payload)).status,403);
 assert.equal((await h.get(`articleId=${article}&kind=comment`)).status,403);assert.equal(h.calls.length,0);
 assert.equal((await h.post({action:'settings',surveyId:''})).status,200);assert.equal(h.calls.length,1);
 const ordinary=routes();const r=await ordinary.post({...input,state:'approved'});assert.equal(r.status,201);assert.equal((await r.json()).receipt.state,'pending');
});
test('server policy rejects comments without RPC, omits historical comments and forces settings OFF',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY,oldSecret=process.env.NEWSLETTER_AUTH_SECRET;const calls=[];process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.NEWSLETTER_AUTH_SECRET='fixture';
 global.fetch=async(url,init={})=>{calls.push({url,method:init.method||'GET',body:init.body&&JSON.parse(init.body)});if(url.includes('participation_settings?'))return Response.json([{comments_enabled:true,survey_id:null,survey_snapshot:null}]);if(url.includes('/rpc/'))return Response.json({ok:true});return Response.json([{id:'archived',kind:'comment',body:'must remain private'}]);};
 try{const m=loader({'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true},'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://fixture.invalid'+p},'@/lib/newsletter-repository':{getProjectSurveys:async()=>({surveys:[]})}})('src/lib/hwaseong-participation-server.ts');
 assert.throws(()=>m.manageParticipation({action:'approve',privacyChecked:true},'actor'),{status:403});assert.throws(()=>m.manageParticipation({action:'settings',commentsEnabled:true},'actor'),{status:403});await assert.rejects(m.submitParticipation(article,'actor',{kind:'comment'}),{status:403});assert.equal(calls.length,0);
 const view=await m.participationView(article,'actor',false);assert(!('comments' in view));assert(!('commentsEnabled' in view));assert.equal(calls.length,1);
 assert.equal(await m.participationReceipt(article,input.requestId,'actor'),null);assert.equal((await m.participationAdminData()).entries.length,0);assert(calls.filter(c=>c.url.includes('newsletter_sample_participation?')).every(c=>c.url.includes('kind=in.(private,survey)')));
 await m.manageParticipation({action:'settings',surveyId:''},'actor');assert.equal(calls.at(-1).body.p_enabled,false);
 await m.submitParticipation(article,'actor',{...input,kind:'private'});assert.equal(calls.at(-1).body.p_kind,'private');assert.equal(calls.at(-1).body.p_body,'시연 의견');assert(!calls.some(c=>c.method==='DELETE'));
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;if(oldSecret===undefined)delete process.env.NEWSLETTER_AUTH_SECRET;else process.env.NEWSLETTER_AUTH_SECRET=oldSecret;}
});
