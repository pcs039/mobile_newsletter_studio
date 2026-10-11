/* eslint-disable @typescript-eslint/no-require-imports -- isolated server test harness. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const loader=require('./canva-test-loader.cjs');const c=loader()('src/lib/canva-background-autofill.ts');
const template={templateType:'brand_template',externalId:'BRAND',fieldMappings:['EVENT_TITLE','EVENT_DATE','EVENT_PLACE'].map(field=>({field,type:'text',source:'article.title'}))};
const fields=template.fieldMappings.map(m=>({field:m.field,type:'text',status:'ready',text:'saved '+m.field}));
const dataset={dataset:{EVENT_TITLE:{type:'text'},EVENT_DATE:{type:'text'},EVENT_PLACE:{type:'text'},BACKGROUND_IMAGE:{type:'image'}}};
test('background Autofill retains saved text, uses image asset id and never mutates input',()=>{
 const snapshot=JSON.stringify([template,fields,dataset]);const p=c.backgroundAutofill(template,fields,dataset,'title','M_IMAGE');
 assert.equal(p.brand_template_id,'BRAND');assert.equal(p.type,'create_from_brand_template');assert.equal(Object.keys(p.data).length,4);
 assert.deepEqual(p.data.BACKGROUND_IMAGE,{type:'image',asset_id:'M_IMAGE'});for(const f of fields)assert.equal(p.data[f.field].text,f.text);
 assert.equal(JSON.stringify([template,fields,dataset]),snapshot);
 for(const d of [{dataset:{}},{dataset:{...dataset.dataset,BACKGROUND_IMAGE:{type:'text'}}},{dataset:{...dataset.dataset,OTHER:{type:'image'}}}])assert.throws(()=>c.backgroundAutofill(template,fields,d,'title','M_IMAGE'));
 assert.throws(()=>c.backgroundAutofill({...template,templateType:'existing_design'},fields,dataset,'title','M_IMAGE'));
 assert.throws(()=>c.backgroundAutofill(template,[],dataset,'title','M_IMAGE'));
});
test('upload response requires matching image result, rejects arbitrary job and asset identifiers',()=>{
 assert.deepEqual(c.readCanvaUploadJob({job:{id:'JOB',status:'success',asset:{id:'M_IMAGE',type:'image'}}}),{id:'JOB',status:'success',assetId:'M_IMAGE'});
 for(const job of [{id:'../bad',status:'in_progress'},{id:'JOB',status:'success',asset:{type:'video',id:'M_VIDEO'}},{id:'JOB',status:'success'}])assert.throws(()=>c.readCanvaUploadJob({job}));
});
test('one binary upload; persisted success and job recovery prevent repeated upload',async()=>{
 let gets=0;const m=loader({'@/lib/canva-connect-server':{connectedCanvaRequest:async path=>{gets++;assert.equal(path,'/asset-uploads/JOB');return {job:{id:'JOB',status:'success',asset:{id:'M_IMAGE',type:'image'}}};}}})('src/lib/canva-background-upload.ts');
 const original=global.fetch;let posts=0,row={},patches=[];const update=async p=>{patches.push(p);Object.assign(row,p);return row;};const input={id:'20b22f93-95fb-4589-8f77-77ec033f8707',hash:'hash',bytes:Uint8Array.of(1,2)};
 global.fetch=async(url,opts)=>{posts++;assert.equal(row.execution.backgroundUpload.status,'sending');assert.equal(url,'https://api.canva.com/rest/v1/asset-uploads');assert.equal(opts.headers['Content-Type'],'application/octet-stream');assert.deepEqual(opts.body,input.bytes);const name=Buffer.from(JSON.parse(opts.headers['Asset-Upload-Metadata']).name_base64,'base64').toString();assert(name.length<=50);return Response.json({job:{id:'JOB',status:'success',asset:{type:'image',id:'M_IMAGE'}}});};
 try{const a=await m.uploadCanvaBackground(input,'test-token',{key:'key',status:'sending'},update);assert.equal(a.assetId,'M_IMAGE');assert.equal(posts,1);await m.uploadCanvaBackground(input,'test-token',a.execution,update);assert.equal(posts,1);
 const pending={...a.execution,backgroundUpload:{sourceAssetId:input.id,sourceHash:input.hash,status:'in_progress',jobId:'JOB'}};await m.uploadCanvaBackground(input,'test-token',pending,update);assert.equal(posts,1);assert.equal(gets,1);
 await assert.rejects(m.uploadCanvaBackground({...input,hash:'changed'},'token',a.execution,update),e=>e.status===409);
 }finally{global.fetch=original;}
});
test('interrupted upload persists unknown, blocks replay and never exposes provider secrets',async()=>{
 const m=loader()('src/lib/canva-background-upload.ts'),original=global.fetch;let calls=0,row={};const update=async p=>{Object.assign(row,p);return row;};const input={id:'test-id',hash:'hash',bytes:Uint8Array.of(1)};
 global.fetch=async()=>{calls++;throw Error('TOKEN PRIVATE');};
 try{await assert.rejects(m.uploadCanvaBackground(input,'token',{key:'key',status:'sending'},update),e=>e.status===504&&!e.message.includes('PRIVATE'));assert.equal(row.execution.backgroundUpload.status,'unknown');await assert.rejects(m.uploadCanvaBackground(input,'token',row.execution,update),e=>e.status===409);assert.equal(calls,1);}finally{global.fetch=original;}
});
test('background read excludes other project, inactive, unapproved and non-GPT assets before storage access',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://mvrkpmffuhcqwisqvpqi.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test';const m=loader()('src/lib/canva-background-repository.ts'),original=global.fetch;
 const project='11111111-1111-4111-8111-111111111111',base={id:'asset',name:'GPT',project_id:project,asset_type:'background',approval_status:'approved',is_active:true,metadata:{source:'openai'},storage_path:`projects/${project}/file.png`};
 let calls=0;global.fetch=async()=>{calls++;return Response.json([{...base,project_id:'other'},{...base,is_active:false},{...base,approval_status:'pending'},{...base,metadata:{source:'canva'}},{...base,storage_path:`projects/${project}/../other.png`}]);};
 try{assert.deepEqual(await m.listCanvaBackgrounds(project),[]);await assert.rejects(m.readCanvaBackground(project,'asset'),e=>e.status===404);assert.equal(calls,2);}finally{global.fetch=original;}
});
test('authorized route prepare writes no execution; image execute once, key/hash replay safe and source unchanged',async()=>{
 const projectId='11111111-1111-4111-8111-111111111111',articleId='22222222-2222-4222-8222-222222222222',templateId='33333333-3333-4333-8333-333333333333',assetId='44444444-4444-4444-8444-444444444444';
 const article={id:articleId,title:'가을빛으로 물드는 도심, 2026 시민문화축제 개최',body:'보존 본문',blocks:[],links:['https://example.com']},snapshot=JSON.stringify(article);
 const expectedTitle='가을빛으로 물드는 도심,\n2026 시민문화축제 개최';
 const manualTitle='가을빛으로 물드는 도심,\n2026 시민문화축제\n개최';
 const routeFields=fields.map(field=>field.field==='EVENT_TITLE'?{...field,text:article.title}:field);
 let row={execution:null},writes=0,uploads=0,creates=0,allowed=true;
 const update=async p=>{writes++;row={...row,...p};return row;};
 const mod=loader({
  '@/lib/staging-environment':{requireStagingE2E:()=>{}},
  '@/lib/canva-api-access':{sameOrigin:()=>{},canvaAdmin:async()=>allowed?{ok:true,project:{id:projectId,slug:'test',title:'test',issue:'1'},user:{id:'admin'}}:{ok:false,response:Response.json({ok:false},{status:403})},canvaJson:(d,status=200)=>Response.json(d,{status}),canvaFailure:e=>Response.json({message:e.message},{status:e.status||502})},
  '@/lib/canva-connection-repository':{getConnection:async()=>row,withConnectionLock:async(p,u,fn)=>fn(row,update)},
  '@/lib/canva-connect-server':{accessToken:async()=> 'test-token',connectedCanvaRequest:async(path,token,update,payload)=>{if(path==='/autofills'){creates++;assert.equal(row.execution.status,'sending');assert.equal(payload.data.BACKGROUND_IMAGE.asset_id,'M_IMAGE');assert.equal(payload.data.EVENT_TITLE.text,manualTitle);assert.equal(payload.title,article.title);return {job:{id:'AUTOJOB',status:'success',result:{type:'create_design',design:{id:'D_RESULT',urls:{edit_url:'https://www.canva.com/design/D_RESULT/edit'}}}}};}return dataset;}},
  '@/lib/canva-background-repository':{listCanvaBackgrounds:async()=>[],readCanvaBackground:async(p,id)=>{if(p!==projectId||id!==assetId)throw Object.assign(Error('wrong project asset'),{status:404});return {id:assetId,hash:'stable-source',bytes:Uint8Array.of(1),name:'approved GPT',width:1152,height:1536};}},
  '@/lib/canva-background-upload':{uploadCanvaBackground:async(input,token,e,update)=>{uploads++;const execution={...e,status:'uploading',backgroundUpload:{sourceAssetId:input.id,sourceHash:input.hash,status:'success',assetId:'M_IMAGE'}};await update({execution});return {execution,assetId:'M_IMAGE'};}},
  '@/lib/canva-template-repository':{listCanvaTemplates:async()=>[{...template,id:templateId,isActive:true}]},
  '@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:[article]})},
  '@/lib/canva-template':{canvaUuid:/^[0-9a-f-]{36}$/,buildCanvaPreview:()=>routeFields},
 })('src/app/api/canva/autofill/route.ts');
 process.env.NEWSLETTER_AUTH_SECRET='test-only';
 const body={projectSlug:'test',articleId,templateId,backgroundAssetId:assetId};
 const post=b=>mod.POST(new Request('https://canva-staging.datadiction.co.kr/api/canva/autofill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}));
 const prepared=await (await post({...body,action:'prepare'})).json();assert(prepared.confirmation);assert.equal(writes,0);assert.equal(uploads,0);assert.equal(creates,0);
 assert.equal(prepared.fields.find(field=>field.field==='EVENT_TITLE').text,expectedTitle);
 const key='55555555-5555-4555-8555-555555555555';
 assert.equal((await post({...body,action:'execute',confirmation:prepared.confirmation,requestKey:key,displayTitleOverride:manualTitle})).status,409);assert.equal(uploads,0);assert.equal(writes,0);
 assert.equal((await post({...body,action:'prepare',displayTitleOverride:'1\n2\n3\n4'})).status,400);
 const manualPrepared=await (await post({...body,action:'prepare',displayTitleOverride:manualTitle})).json();assert.equal(manualPrepared.fields.find(field=>field.field==='EVENT_TITLE').text,manualTitle);assert.equal(writes,0);
 const request={...body,action:'execute',displayTitleOverride:manualTitle,confirmation:manualPrepared.confirmation,requestKey:key};
 assert.equal((await post(request)).status,200);assert.equal(uploads,1);assert.equal(creates,1);
 assert.equal((await post({...request,displayTitleOverride:'변경한 제목'})).status,409);assert.equal(creates,1);
 assert.equal((await post(request)).status,200);assert.equal(uploads,1);assert.equal(creates,1);
 assert.equal((await post({...request,requestKey:'66666666-6666-4666-8666-666666666666'})).status,200);assert.equal(uploads,1);assert.equal(creates,1);
 assert.equal((await post({...body,action:'prepare',backgroundAssetId:'77777777-7777-4777-8777-777777777777'})).status,404);
 allowed=false;assert.equal((await post({...body,action:'prepare'})).status,403);assert.equal(JSON.stringify(article),snapshot);
});

test('definite bad request records failure without retry',async()=>{
 const m=loader()('src/lib/canva-background-upload.ts'),original=global.fetch;let calls=0,row={};const update=async p=>{Object.assign(row,p);return row;};
 global.fetch=async()=>{calls++;return Response.json({code:'invalid_request'},{status:400});};
 try{await assert.rejects(m.uploadCanvaBackground({id:'id',hash:'hash',bytes:Uint8Array.of(1)},'token',{key:'key',status:'sending'},update),e=>e.status===400);assert.equal(row.execution.backgroundUpload.status,'failed');assert.equal(row.execution.status,'failed');assert.equal(calls,1);}finally{global.fetch=original;}
});
