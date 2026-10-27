/* eslint-disable @typescript-eslint/no-require-imports -- Isolated API/UI fixtures; no provider or remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const slug='hwaseong-2026-10-samples',project='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',id='11111111-1111-4111-8111-111111111111',revision='a'.repeat(32),patch={title:'제목',summary:'요약',blocks:[{id,title:'본문',body:'본문입니다.'}],sections:[]};
const contract=loader()('src/lib/hwaseong-sample-text-edit.ts');
test('only bounded text, existing block IDs and ordered editorial sections are accepted',()=>{
 assert.deepEqual(contract.validateSampleTextPatch(patch),patch);
 for(const p of [{...patch,title:''},{...patch,title:'가'.repeat(201)},{...patch,metadata:{}},{...patch,sections:[{title:'a',text:'b',sourceUrl:'bad'}]},{...patch,blocks:[{...patch.blocks[0],assetId:id}]},{...patch,blocks:[{...patch.blocks[0],id:'foreign'}]},{...patch,summary:'\u0000'}])assert.throws(()=>contract.validateSampleTextPatch(p));
});
function server(staging=true){return loader({'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>staging},'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://fixture.invalid'+p}})('src/lib/hwaseong-sample-text-edit-server.ts');}
async function withFetch(fn){const old=global.fetch;try{await fn();}finally{global.fetch=old;}}
test('stored sample marker blocks old clients; lookup errors never reach ordinary destructive save',()=>withFetch(async()=>{
 let calls=[];global.fetch=async(u,i)=>{calls.push([u,i]);return Response.json([{id,metadata:{proposal_sample:{}}}]);};
 const input={projectSlug:slug,articleId:id,title:'기존 제목'};const r=await server().saveSampleTextIfProtected(input,project,{});assert.equal(r.httpStatus,409);assert.equal(calls.length,1);assert(!calls[0][0].includes('/rpc/'));
 global.fetch=async()=>new Response(null,{status:503});assert.equal((await server().saveSampleTextIfProtected(input,project,{})).httpStatus,503);
 assert.equal(await server().saveSampleTextIfProtected({...input,projectSlug:'ordinary'},'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',{}),null);
 assert.equal((await server(false).saveSampleTextIfProtected(input,project,{})).httpStatus,403);global.fetch=async()=>Response.json([]);assert.equal((await server().saveSampleTextIfProtected({...input,articleId:'b48352e0-dbbe-4cca-bbcc-f88988b27d32'},project,{})).httpStatus,409);
}));
test('safe save uses exactly one text RPC, retains revision and never falls back, uploads or deletes',()=>withFetch(async()=>{
 const calls=[];global.fetch=async(u,i)=>{calls.push([u,i]);return u.includes('/rpc/')?Response.json({ok:true,changed:true,revision:'b'.repeat(32),...patch}):Response.json([{id,metadata:{proposal_sample:{}}}]);};
 const r=await server().saveSampleTextIfProtected({projectSlug:slug,articleId:id,title:patch.title,sampleTextEdit:{revision,patch}},project,{});assert(r.ok);assert.equal(r.sampleTextState.revision,'b'.repeat(32));assert.equal(calls.length,2);const [u,i]=calls[1];assert(u.endsWith('/rpc/save_hwaseong_sample_text_atomic'));assert.equal(JSON.parse(i.body).p_expected,revision);assert.deepEqual(JSON.parse(i.body).p_patch,patch);assert(!JSON.stringify(calls).includes('save_newsletter_article_atomic'));assert(!calls.some(([,i])=>i.method==='DELETE'));
}));
test('lost or malformed completion and server failure stay uncertain; conflicts do not retry',()=>withFetch(async()=>{
 const input={projectSlug:slug,articleId:id,title:patch.title,sampleTextEdit:{revision,patch}};
 for(const outcome of ['lost','malformed','conflict','server']){let rpcCalls=0;global.fetch=async u=>{if(!u.includes('/rpc/'))return Response.json([{id,metadata:{proposal_sample:{}}}]);rpcCalls++;if(outcome==='lost')throw Error('lost');return outcome==='malformed'?Response.json({ok:true}):new Response('{}',{status:outcome==='conflict'?409:500});};const r=await server().saveSampleTextIfProtected(input,project,{});assert.equal(r.ok,false);assert.equal(r.httpStatus,outcome==='conflict'?409:502);assert.equal(rpcCalls,1);}
}));
test('same existing editor renders only safe text controls and a blocked view when RPC unavailable',()=>{
 const c=loader({'next/link':p=>React.createElement('a',p,p.children),'next/navigation':{useRouter:()=>({refresh(){}})}})('src/components/hwaseong-sample-text-edit-fields.tsx');
 const html=renderToStaticMarkup(React.createElement(c.HwaseongSampleTextEditFields,{projectSlug:slug,articleId:id,access:{state:{revision,...patch},message:''}}));
 assert(html.includes('본문 1'));assert(html.includes('텍스트 저장'));assert(html.includes('원문'));assert(!html.includes('type="file"'));assert(!html.includes('음성 생성하기'));
 const blocked=renderToStaticMarkup(React.createElement(c.HwaseongSampleTextEditFields,{projectSlug:slug,articleId:id,access:{state:null,message:'저장 차단'}}));assert(blocked.includes('저장 차단'));assert(!blocked.includes('type="submit"'));
 const source=fs.readFileSync('src/components/project-article-editor-form.tsx','utf8');assert(source.includes('if(protectedSample&&props.article)'));assert(source.includes('GeneralProjectArticleEditorForm'));
});
test('private success requires matching confirmed receipt; unknown cannot show completion',()=>{
 const m=loader()('src/components/hwaseong-article-participation.tsx');assert(m.confirmedParticipationReceipt('private',id,{id,state:'private'}));assert(m.confirmedParticipationReceipt('survey',id,{id,state:'recorded',kind:'survey'}));
 for(const r of [null,{id,state:'pending'},{id,state:'unknown'},{id:'other',state:'private'},{id,state:'private',kind:'survey'}])assert(!m.confirmedParticipationReceipt('private',id,r));
 const s=fs.readFileSync('src/components/hwaseong-article-participation.tsx','utf8');assert(s.includes('result.phase === "done" && kind === "private"'));assert(s.indexOf('if (result.phase === "done"')<s.indexOf('return <form'));assert(s.includes('다른 독자에게 공개되지 않습니다.'));
});
test('test clones stay out of ordinary issue and generation plans; unchanged source metadata is not made editable',()=>{
 const page=fs.readFileSync('src/app/projects/[projectId]/samples/page.tsx','utf8');assert(page.includes('allSamples.filter(s=>!s.editorTest)'));assert(page.includes('s.editorTest&&s.article.id===query.articleId'));
 for(const file of ['src/lib/hwaseong-sample-tts-server.ts','src/lib/hwaseong-sample-split-tts-server.ts'])assert(fs.readFileSync(file,'utf8').includes('!!s&&!s.editorTest'));
 const sql=fs.readFileSync('supabase/schema_v1_45_sample_text_edit.sql','utf8');assert(!/delete from|insert into|alter table|create table/i.test(sql));assert(sql.includes('for update'));assert(sql.includes('sample_edit_conflict'));assert(sql.includes('proposal_original_editorial'));
});
