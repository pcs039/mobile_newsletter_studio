/* eslint-disable @typescript-eslint/no-require-imports -- Local UI and browser fixtures; no external sharing or data writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const {sampleShareTarget,shareApprovedSampleLink}=loader()('src/lib/hwaseong-sample-share.ts');
const {sampleHref}=loader()('src/lib/hwaseong-proposal-sample.ts');
const slug='hwaseong-2026-10-samples',articleId='article-06';
test('article/issue targets have distinct titles, summary/cover entries and no QA, credentials, detail or current query',()=>{
 const article=sampleShareTarget(slug,'실제 DB 기사 제목',articleId),cover=sampleShareTarget(slug,'특별한 화성소식 · 2026.10');
 assert.equal(article.title,'실제 DB 기사 제목');assert.equal(article.externalUrl,undefined);
 for(const target of [article,cover]){const u=new URL(target.entryHref,'https://fixture.invalid');assert.equal(u.pathname,`/projects/${slug}/samples`);assert.equal(u.searchParams.get('entry'),'share');assert(!u.searchParams.has('view'));assert(!u.searchParams.has('qa'));assert(!u.searchParams.has('token'));assert(!u.hash);}
 assert.equal(new URL(article.entryHref,'https://fixture.invalid').searchParams.get('articleId'),articleId);
 assert(!new URL(cover.entryHref,'https://fixture.invalid').searchParams.has('articleId'));
 assert.match(sampleHref(slug,articleId,true,520,{sharedEntry:true,interest:'pets'}),/entry=share/);
 assert(!sampleHref(slug,undefined,false,520,{sharedEntry:true,contents:true}).includes('entry=share'));
});
test('unapproved/private/admin/tokenized URLs never reach native share or clipboard',async()=>{
 let calls=0;const browser={share:async()=>calls++,clipboard:{writeText:async()=>calls++}};
 for(const externalUrl of [undefined,'https://fixture.invalid/projects/x/samples','https://fixture.invalid/api/data','https://fixture.invalid/login','https://fixture.invalid/demo#secret','https://fixture.invalid/demo?token=secret','http://fixture.invalid/demo','https://user:secret@fixture.invalid/demo']){
  await assert.rejects(shareApprovedSampleLink({...sampleShareTarget(slug,'제목',articleId),externalUrl},browser));
 }
 assert.equal(calls,0);
});
test('explicit approved fixture uses native sharing, falls back only when unsupported, and cancellation does not copy',async()=>{
 const target={...sampleShareTarget(slug,'실제 기사 제목',articleId),externalUrl:'https://readonly.invalid/demo?project=fixture&articleId=article-06&entry=share'};
 let shared,copied;
 assert.equal(await shareApprovedSampleLink(target,{share:async d=>{shared=d;},clipboard:{writeText:async s=>{copied=s;}}}),'shared');
 assert.deepEqual(shared,{title:target.title,url:target.externalUrl});assert.equal(copied,undefined);
 assert.equal(await shareApprovedSampleLink(target,{clipboard:{writeText:async s=>{copied=s;}}}),'copied');assert.equal(copied,target.externalUrl);
 copied=undefined;assert.equal(await shareApprovedSampleLink(target,{share:async()=>{const e=Error('cancel');e.name='AbortError';throw e;},clipboard:{writeText:async s=>{copied=s;}}}),'cancelled');assert.equal(copied,undefined);
 await assert.rejects(shareApprovedSampleLink(target,{share:async()=>{throw Error('permission denied');},clipboard:{writeText:async s=>{copied=s;}}}));assert.equal(copied,undefined);
});
function readerFixture(query){
 const ids=Object.keys(loader()('src/lib/hwaseong-sample-interest.ts').sampleOrderRules);
 const samples=ids.map((id,i)=>({article:{id,title:`실제 제목 ${i}`,blocks:[],body:'보존 본문'},kind:'policy',headline:`편집 제목 ${i}`,cover:'/preserved.webp',color:'#125e7c',pale:'#ffffff'}));
 const load=loader({'next/navigation':{useSearchParams:()=>new URLSearchParams(query)},'@/components/public-mobile-article-reader':{ArticleCard:()=>React.createElement('p',null,'보존 상세 본문'),PublicNewsletterCoverView:()=>null},'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null}});
 const tree=load('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader;
 return {ids,render:()=>renderToStaticMarkup(React.createElement(tree,{slug,samples,fonts:[],backgrounds:{},textDesigns:{},detail:false,width:390}))};
}
test('one participation section precedes expand/collapse and follows expanded body; reader never shows admin management',()=>{
 const ids=Object.keys(loader()('src/lib/hwaseong-sample-interest.ts').sampleOrderRules);
 for(const detail of [false,true]){
  const html=readerFixture(`articleId=${ids[0]}${detail?'&view=detail':''}`).render();
  assert.equal((html.match(/data-sample-participation=/g)||[]).length,1);
  assert(html.indexOf('의견 · 댓글 · 설문 · 공유')<html.indexOf(detail?'기사 접기 · 요약으로':'상세기사 보기'));
  if(detail)assert(html.indexOf('보존 상세 본문')<html.indexOf('data-sample-participation='));
  assert(!html.includes('시연 의견·댓글·설문 결과 관리'));
 }
});
test('shared article entry keeps summary and full-news navigation within its issue; cover share defaults disabled',()=>{
 const ids=Object.keys(loader()('src/lib/hwaseong-sample-interest.ts').sampleOrderRules);
 const html=readerFixture(`articleId=${ids[1]}&entry=share&interest=culture`).render();
 assert.match(html,/전체 소식 보기/);assert.match(html,/view=contents/);assert(!html.includes('data-sample-inline-detail='));assert.match(html,/entry=share/);
 const {SampleShareAction}=loader()('src/components/hwaseong-sample-share.tsx');
 const cover=renderToStaticMarkup(React.createElement(SampleShareAction,{target:sampleShareTarget(slug,'소식지'),label:'소식지 공유하기'}));
 assert.match(cover,/disabled=""/);assert.match(cover,/승인된 외부 열람 링크/);assert(!cover.includes('/projects/'));assert(!cover.includes('href='));
});
test('four uniform disclosures retain moderation/privacy and survey inputs but omit reader admin links',()=>{
 const data={token:'fixture',isAdmin:true,commentsEnabled:true,comments:[],survey:{id:'survey',title:'기존 설문',questions:[]}};
 const load=loader({react:{...React,useState:v=>[v===null?data:v,()=>{}]}});
 const Component=load('src/components/hwaseong-article-participation.tsx').HwaseongArticleParticipation;
 const html=renderToStaticMarkup(React.createElement(Component,{slug,articleId,articleTitle:'실제 제목'}));
 for(const label of ['비공개 의견 보내기','댓글 남기기','이 기사, 도움이 되었나요?','기사 공유하기'])assert(html.includes(label));
 assert.equal((html.match(/<details /g)||[]).length,4);assert.match(html,/검토·승인한 댓글만/);assert.match(html,/다른 독자에게 공개되지 않습니다/);
 assert(!html.includes('시연 의견·댓글·설문 결과 관리'));assert(!html.includes('승인된 댓글 ·'));assert(!html.includes('간단 설문 ·'));
});
