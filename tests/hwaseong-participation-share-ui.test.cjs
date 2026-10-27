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
test('summary expand precedes one participation section; expanded body and collapse keep their order',()=>{
 const ids=Object.keys(loader()('src/lib/hwaseong-sample-interest.ts').sampleOrderRules);
 for(const detail of [false,true]){
  const html=readerFixture(`articleId=${ids[0]}${detail?'&view=detail':''}`).render();
  assert.equal((html.match(/data-sample-participation=/g)||[]).length,1);
  if(detail)assert(html.indexOf('시민 참여 · 공유')<html.indexOf('기사 접기 · 요약으로'));
  else assert(html.indexOf('상세기사 보기')<html.indexOf('시민 참여 · 공유'));
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
test('three compact actions retain mounted forms, privacy and disabled private sharing without comments or admin links',()=>{
 const data={token:'fixture',isAdmin:true,commentsEnabled:true,comments:[],survey:{id:'survey',title:'기존 설문',questions:[]}};
 let first=true;const load=loader({react:{...React,useState:v=>{if(first){first=false;return[data,()=>{}];}return[v,()=>{}];}}});
 const Component=load('src/components/hwaseong-article-participation.tsx').HwaseongArticleParticipation;
 const html=renderToStaticMarkup(React.createElement(Component,{slug,articleId,articleTitle:'실제 제목'}));
 assert.match(html,/시민 참여 · 공유/);for(const label of ['의견','설문','공유'])assert(html.includes(label));
 assert.equal((html.match(/role="region"/g)||[]).length,2);assert.equal((html.match(/hidden=""/g)||[]).length,2);assert.equal((html.match(/<form /g)||[]).length,2);
 assert(!html.includes('댓글'));assert.match(html,/grid-cols-3/);assert.match(html,/다른 독자에게 공개되지 않습니다/);assert.match(html,/개인정보·보관 안내/);assert.match(html,/30일/);assert.match(html,/동의합니다/);
 assert(!html.includes('시연 의견·댓글·설문 결과 관리'));assert.match(html,/disabled=""/);
});
test('all seven articles and admin results omit comment controls, counts and historical comment content',()=>{
 const ids=Object.keys(loader()('src/lib/hwaseong-sample-interest.ts').sampleOrderRules);
 for(const id of ids){const html=readerFixture(`articleId=${id}&view=detail`).render();assert(!html.includes('댓글'));assert.equal((html.match(/data-sample-participation=/g)||[]).length,1);assert(html.includes('grid-cols-3'));}
 const load=loader({'next/navigation':{useRouter:()=>({refresh(){}})}}),Admin=load('src/components/hwaseong-participation-admin.tsx').HwaseongParticipationAdmin;
 const html=renderToStaticMarkup(React.createElement(Admin,{slug,organization:'화성시',settings:{survey_id:null,comments_enabled:true},articles:[{id:articleId,title:'보존 기사'}],surveys:[],entries:[{id:'private',article_id:articleId,kind:'private',body:'관리자 비공개 의견'},{id:'comment',article_id:articleId,kind:'comment',body:'절대 노출하지 않을 기존 댓글',state:'approved'}]}));
 assert(html.includes('관리자 비공개 의견'));assert(!html.includes('절대 노출'));assert(!html.includes('댓글'));assert(!html.includes('name="comments"'));assert(!html.includes('>승인<'));assert(html.includes('설정 저장'));
});
test('action buttons open at most one panel and can collapse it without removing other forms',()=>{
 let cursor=0;const states=[];const data={token:'fixture',commentsEnabled:true,comments:[],survey:{id:'survey',questions:[]}};
 const load=loader({react:{...React,useEffect:()=>{},useState:v=>{const i=cursor++;if(!(i in states))states[i]=i===0?data:v;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];}}});
 const Component=load('src/components/hwaseong-article-participation.tsx').HwaseongArticleParticipation;
 function walk(node,predicate){if(!node||typeof node!=='object')return; if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=walk(child,predicate);if(found)return found;}}
 function render(){cursor=0;return Component({slug,articleId,articleTitle:'기존 제목'});}
 for(const kind of ['private','survey']){
  const tree=render();walk(tree,n=>n.type==='button'&&n.props['aria-controls']===`participation-${articleId}-${kind}`).props.onClick();
  const opened=render();for(const other of ['private','survey'])assert.equal(walk(opened,n=>n.props?.id===`participation-${articleId}-${other}`).props.hidden,other!==kind);
 }
 const tree=render();walk(tree,n=>n.type==='button'&&n.props['aria-controls']===`participation-${articleId}-survey`).props.onClick();
 const closed=render();for(const kind of ['private','survey'])assert.equal(walk(closed,n=>n.props?.id===`participation-${articleId}-${kind}`).props.hidden,true);
});
test('only the verified video title gets independent hashtag blocks; every original space and character stays',()=>{
 const Text=loader()('src/components/hwaseong-editorial-sample.tsx').SampleEditorialText;
 const original='공식 영상 제목은 ‘[화성특급] 화성시 사람들 다 모였다! #화성에코팜테마파크 #선셋콘서트’입니다. 게시일 등 기존 문장은 유지합니다.';
 const render=(id,text)=>renderToStaticMarkup(React.createElement(Text,{articleId:id,text}));
 const html=render('50bf808f-15b5-4484-8fee-38f7a8acb99d',original);
 assert.equal((html.match(/data-video-description-tag/g)||[]).length,2);assert.match(html,/>#화성에코팜테마파크<\/span>/);assert.match(html,/>#선셋콘서트<\/span>/);assert.equal(html.replace(/<[^>]*>/g,''),original);
 assert.equal((html.match(/text-\[#d9ff62\]/g)||[]).length,2);
 for(const [id,text] of [['other',original],['50bf808f-15b5-4484-8fee-38f7a8acb99d','일반 #기호 https://example.invalid/#화성에코팜테마파크 #선셋콘서트']])assert(!render(id,text).includes('data-video-description-tag'));
});
