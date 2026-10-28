/* eslint-disable @typescript-eslint/no-require-imports -- Provider, DB and Storage are isolated fixtures. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),loader=require('./canva-test-loader.cjs');
const pure=loader(),n=pure('src/lib/hwaseong-cartoon-acting.ts');
const sample={kind:'cartoon',headline:'오늘의 산책 고수는?',article:{id:n.actingArticleId,title:'원문',displayTitle:'',summary:'원문',body:'보존',blocks:[]},authorEdited:false,editorTest:false};
const plans=n.cartoonActingPlans(sample);
function fixture(){const before=global.fetch,env={...process.env},stored=[],objects=new Map(),calls=[],writes=[];let failure='';
process.env.STAGING_OPENAI_API_KEY='scoped';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
const mp3=fs.readFileSync(__dirname+'/fixtures/marin-recovery-tone.mp3');
const api=loader({
 '@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true},
 '@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:[sample.article]})},
 '@/lib/hwaseong-proposal-sample':{...pure('src/lib/hwaseong-proposal-sample.ts'),proposalSample:()=>sample},
 '@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p,getSupabaseStorageEndpoint:p=>'https://store.invalid'+p},
 '@/lib/article-tts-audio':{requestOpenAiSpeech:async(text,voice,model,options)=>{assert.equal(model,'gpt-4o-mini-tts');assert.equal(options.apiKey,'scoped');assert.equal(options.narration.speed,1);assert.equal(options.bodyIdleTimeoutMs,30000);calls.push({text,voice});options.diagnostics.setReceipt(200,'req_fixture');if(failure==='provider')throw Error('private provider failure');return {ok:true,data:mp3.buffer.slice(mp3.byteOffset,mp3.byteOffset+mp3.length)};}},
})('src/lib/hwaseong-cartoon-acting-server.ts');
global.fetch=async(url,init={})=>{const u=new URL(url),method=init.method||'GET';
 if(u.hostname==='db.invalid'){
  if(method==='POST'){const row=JSON.parse(init.body);if(stored.some(r=>r.id===row.id))return new Response(null,{status:409});stored.push({...row,ai_tts_generated_at:null,duration_seconds:null});writes.push(row.id);if(failure==='claim')throw Error('lost');return new Response(null,{status:201});}
  if(method==='PATCH'){const row=stored.find(r=>r.id===u.searchParams.get('id').slice(3));Object.assign(row,JSON.parse(init.body));writes.push(row.id);if(failure==='commit')throw Error('lost');return Response.json([row]);}
  return Response.json(stored);
 }
 if(method==='POST'){assert.equal(init.headers['x-upsert'],'false');assert(!objects.has(u.pathname));objects.set(u.pathname,Buffer.from(init.body));if(failure==='upload')throw Error('lost');return new Response(null,{status:201});}
 return objects.has(u.pathname)?new Response(objects.get(u.pathname),{headers:{'Content-Type':'audio/mpeg'}}):Response.json({statusCode:'404'},{status:400});
};
return {...api,stored,objects,calls,writes,set:x=>failure=x,restore(){global.fetch=before;for(const k of ['STAGING_OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'])if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}};
}
test('A and B use identical spoken content, 1+6 calls, fixed female-target voices and separate immutable paths',()=>{
 const [a,b]=plans;assert.equal(a.script,b.script);assert.equal(a.script,b.parts.map(p=>p.text).join('\n\n'));assert.equal(a.script,a.parts[0].text);assert.equal(a.parts.length+b.parts.length,7);
 assert.deepEqual(b.parts.map(p=>p.voice),['coral','marin','coral','marin','coral','coral']);assert(!a.script.match(/\d컷|보호자:|강아지의 속마음:/));assert(a.script.includes('달리기는 내가, 뒷정리는 보호자가!'));
 assert.notEqual(a.id,b.id);assert([...a.parts,...b.parts].every(p=>p.path.startsWith(n.actingPrefix)));assert(!n.actingPrefix.includes('sample-tts-quality-v3'));
 assert.equal(n.cartoonActingPlans({...sample,article:{...sample.article,audioFile:{id:'other'}}})[0].id,a.id);
});
test('edited or non-cartoon articles fail closed',()=>{for(const patch of [{authorEdited:true},{editorTest:true},{kind:'video'},{headline:'changed'}])assert.throws(()=>n.cartoonActingPlans({...sample,...patch}));});
test('normal flow makes exactly seven paid calls and never activates or relinks an article',async()=>{const f=fixture();try{for(const plan of plans)for(const part of plan.parts){const r=await f.generateActingPart(plan.variant,part.index,plan.hash);assert.equal(r.state,'complete');assert.equal(r.calls,1);}assert.equal(f.calls.length,7);assert(f.stored.every(r=>r.article_id===null&&r.script_status==='pending'));const state=await f.actingStatus();assert(state.plans.every(p=>!p.ready&&p.parts.every(x=>x.state==='complete')));assert.equal((await f.generateActingPart('A',0,plans[0].hash)).calls,0);}finally{f.restore();}});
test('B cannot run ahead of A or skip a role turn',async()=>{const f=fixture();try{assert.equal((await f.generateActingPart('B',0,plans[1].hash)).calls,0);await f.generateActingPart('A',0,plans[0].hash);assert.equal((await f.generateActingPart('B',1,plans[1].hash)).calls,0);assert.equal(f.calls.length,1);}finally{f.restore();}});
test('concurrent duplicate reservation dispatches only one provider call',async()=>{const f=fixture();try{const r=await Promise.all([f.generateActingPart('A',0,plans[0].hash),f.generateActingPart('A',0,plans[0].hash)]);assert.equal(f.calls.length,1);assert.equal(r.filter(x=>x.ok).length,1);}finally{f.restore();}});
for(const failure of ['claim','provider'])test(failure+' ambiguity keeps the reservation and blocks all subsequent generation',async()=>{const f=fixture();try{f.set(failure);const r=await f.generateActingPart('A',0,plans[0].hash);assert.equal(r.state,'unknown');assert.equal(f.stored.length,1);const calls=f.calls.length;f.set('');assert.equal((await f.generateActingPart('A',0,plans[0].hash)).calls,0);assert.equal((await f.generateActingPart('B',0,plans[1].hash)).calls,0);assert.equal(f.calls.length,calls);}finally{f.restore();}});
test('ambiguous Storage upload is verified by GET without replaying provider',async()=>{const f=fixture();try{f.set('upload');assert.equal((await f.generateActingPart('A',0,plans[0].hash)).state,'complete');assert.equal(f.calls.length,1);}finally{f.restore();}});
test('missing scoped key, stale script hash and invalid indexes make zero paid calls',async()=>{const f=fixture();try{for(const [variant,index,hash]of[['A',0,'stale'],['B',99,plans[1].hash],['C',0,plans[0].hash]])assert.equal((await f.generateActingPart(variant,index,hash)).calls,0);delete process.env.STAGING_OPENAI_API_KEY;assert.equal((await f.generateActingPart('A',0,plans[0].hash)).calls,0);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);}finally{f.restore();}});
test('ordinary v3 generator and reader indexes do not import the acting pilot',()=>{for(const file of ['src/lib/hwaseong-sample-quality-tts-server.ts','src/lib/hwaseong-sample-split-tts-server.ts','src/app/projects/[projectId]/samples/page.tsx'])assert(!fs.readFileSync(file,'utf8').includes('cartoon-acting'));});
test('pilot route rejects non-Staging, unauthenticated, non-admin and cross-origin calls before execution',async()=>{
 let enabled=true,role='admin',authenticated=true,sameOrigin=true,executed=0;
 const route=loader({
  '@/lib/staging-environment':{stagingRequestAllowed:()=>enabled},
  '@/lib/project-api-access':{requireProjectApiAccess:async()=>authenticated?{ok:true,user:{role},project:{id:n.actingProjectId}}:{ok:false,response:new Response(null,{status:401})}},
  '@/lib/canva-request-origin':{requireCanvaSameOrigin:()=>{if(!sameOrigin)throw Error('origin');}},
  '@/lib/hwaseong-cartoon-acting-server':{actingStatus:async()=>{executed++;return {};},actingDelivery:async()=>{executed++;return new Response();},generateActingPart:async()=>{executed++;return {ok:true};}},
 })('src/app/api/projects/[projectId]/sample-tts/acting/route.ts');
 const ctx={params:Promise.resolve({projectId:'hwaseong-2026-10-samples'})},request=()=>new Request('https://canva-staging.datadiction.co.kr/api/projects/hwaseong-2026-10-samples/sample-tts/acting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant:'A',part:0,hash:plans[0].hash})});
 enabled=false;assert.equal((await route.POST(request(),ctx)).status,404);enabled=true;
 authenticated=false;assert.equal((await route.POST(request(),ctx)).status,401);authenticated=true;
 role='editor';assert.equal((await route.POST(request(),ctx)).status,403);role='admin';
 sameOrigin=false;assert.equal((await route.POST(request(),ctx)).status,403);sameOrigin=true;
 assert.equal(executed,0);assert.equal((await route.GET(new Request('https://canva-staging.datadiction.co.kr/api/projects/hwaseong-2026-10-samples/sample-tts/acting'),ctx)).status,200);assert.equal(executed,1);
});
