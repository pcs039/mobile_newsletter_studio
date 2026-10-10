/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness compiles isolated server modules. */
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=require('./canva-test-loader.cjs')();
const c=load('src/lib/canva-connect-contract.ts');
const template={id:'11111111-1111-4111-8111-111111111111',name:'행사',externalId:'D_TEST',templateType:'existing_design',productionPattern:'event',purpose:'event_guide',isActive:true,fieldMappings:[{field:'EVENT_TITLE',type:'text',source:'article.title'}]};
const fields=[{field:'EVENT_TITLE',type:'text',status:'ready',text:'<script>행사</script>'}];
test('OAuth PKCE state, redirect allowlist and minimum scopes',()=>{
 const a=c.makeAuthorization('CLIENT','https://staging.example/api/canva/callback'),u=new URL(a.url);
 assert.equal(u.origin,'https://www.canva.com');assert.equal(u.searchParams.get('code_challenge'),crypto.createHash('sha256').update(a.verifier).digest('base64url'));assert.equal(u.searchParams.get('code_challenge_method'),'s256');assert(!u.href.includes(a.verifier));assert(c.matchesState(a.state,a.stateHash));assert(!c.matchesState('x',a.stateHash));assert(!c.matchesState(a.state,'bad'));assert.equal(c.canvaScopes.length,4);assert(!c.canvaScopes.some(s=>s.startsWith('asset:')));
 for(const v of ['http://evil.test/api/canva/callback','https://u:p@example.com/api/canva/callback','https://example.com/other','https://example.com/api/canva/callback?x=1'])assert.throws(()=>c.validateRedirect(v));
 assert.equal(c.validateRedirect('http://localhost:3001/api/canva/callback'),'http://localhost:3001/api/canva/callback');
});
test('dataset existence/type, missing text, images fail closed; no arbitrary article changes',()=>{
 const before=JSON.stringify({template,fields});const p=c.textAutofill(template,fields,{dataset:{EVENT_TITLE:{type:'text'}}},'행사');assert.equal(p.type,'create_from_design');assert.equal(p.design_id,'D_TEST');assert.deepEqual({...p.data.EVENT_TITLE},{type:'text',text:fields[0].text});
 assert.equal(c.textAutofill({...template,templateType:'brand_template'},fields,{dataset:{EVENT_TITLE:{type:'text'}}},'행사').type,'create_from_brand_template');
 for(const dataset of [{},{dataset:{}},{dataset:{EVENT_TITLE:{type:'image'}}},{dataset:{EVENT_TITLE:{type:'text'},IMAGE:{type:'image'}}}])assert.throws(()=>c.textAutofill(template,fields,dataset,'행사'));
 assert.throws(()=>c.textAutofill(template,[{...fields[0],status:'missing'}],{dataset:{EVENT_TITLE:{type:'text'}}},'행사'));
 assert.throws(()=>c.textAutofill(template,[{...fields[0],text:'x'.repeat(10001)}],{dataset:{EVENT_TITLE:{type:'text'}}},'행사'));
 assert.equal(JSON.stringify({template,fields}),before);
});
test('job result rejects update_design and non-Canva URLs; success/pending/failure',()=>{
 for(const status of ['in_progress','failed'])assert.deepEqual(c.readCanvaJob({job:{id:'JOB',status}}),{id:'JOB',status});
 const result={job:{id:'JOB',status:'success',result:{type:'create_design',design:{id:'D1',urls:{edit_url:'https://www.canva.com/design/D1/edit',view_url:'https://www.canva.com/design/D1/view'}}}}};assert.equal(c.readCanvaJob(result).designId,'D1');
 assert.throws(()=>c.readCanvaJob({job:{...result.job,result:{...result.job.result,type:'update_design'}}}));assert.equal(c.safeCanvaUrl('https://www.canva.com.evil.test/design/x'),null);assert.equal(c.safeCanvaUrl('javascript:alert(1)'),null);assert.throws(()=>c.readCanvaJob({job:{id:'JOB',status:'success'}}));
});
test('confirmation is bound to exact saved payload and expires',()=>{
 process.env.NEWSLETTER_AUTH_SECRET='test-only-secret';const m=load('src/lib/canva-confirmation.ts');const token=m.createCanvaConfirmation('project:user:article:hash');assert(m.verifyCanvaConfirmation(token,'project:user:article:hash'));assert(!m.verifyCanvaConfirmation(token,'other'));assert(!m.verifyCanvaConfirmation(token+'x','project:user:article:hash'));
 const original=Date.now;Date.now=()=>original()+400000;try{assert(!m.verifyCanvaConfirmation(token,'project:user:article:hash'));}finally{Date.now=original;}
});
test('refresh consumes old token once, rotates, failures leave disconnected; never leak errors',async()=>{
 process.env.CANVA_CLIENT_ID='TEST';process.env.CANVA_CLIENT_SECRET='TEST_SECRET';process.env.CANVA_REDIRECT_URI='https://staging.example/api/canva/callback';const m=load('src/lib/canva-connect-server.ts');
 const original=global.fetch;let calls=0,patches=[];let row={access_token:'old-access',refresh_token:'old-refresh',expires_at:new Date(0).toISOString()};const update=async p=>{patches.push(p);return Object.assign(row,p);};
 global.fetch=async(url,opts)=>{calls++;assert.equal(url,'https://api.canva.com/rest/v1/oauth/token');assert.equal(opts.body.get('refresh_token'),'old-refresh');assert.equal(row.refresh_token,null);return Response.json({access_token:'new-access',refresh_token:'new-refresh',expires_in:14400,token_type:'Bearer',scope:c.canvaScopes.join(' ')});};
 try{assert.equal(await m.accessToken({...row},update),'new-access');assert.equal(row.refresh_token,'new-refresh');assert.equal(await m.accessToken(row,update),'new-access');assert.equal(calls,1);
 row={access_token:'old-access',refresh_token:'old-refresh',expires_at:new Date(0).toISOString()};global.fetch=async()=>Response.json({message:'SECRET'}, {status:400});await assert.rejects(m.accessToken({...row},update),e=>!e.message.includes('SECRET'));assert.equal(row.refresh_token,null);await assert.rejects(m.accessToken(row,update));
 for(const status of [401,403,404,429]){global.fetch=async()=>Response.json({message:'SECRET'}, {status});await assert.rejects(m.canvaRequest('/designs/x/dataset','token'),e=>e.status===status&&!e.message.includes('SECRET'));}
 global.fetch=async()=>{throw Error('TOKEN SECRET')};await assert.rejects(m.canvaRequest('/autofills','token',{}),e=>e.status===504&&!e.message.includes('TOKEN'));
 }finally{global.fetch=original;}
});
