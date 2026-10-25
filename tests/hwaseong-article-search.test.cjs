/* eslint-disable @typescript-eslint/no-require-imports -- Isolated client fixture; no remote services. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const load=loader(),common=load('src/lib/mobile-article-search.ts');
const {buildProposalSearchIndex,searchProposalSamples}=load('src/lib/hwaseong-sample-search.ts');
const {orderProposalSamples,sampleOrderRules}=load('src/lib/hwaseong-sample-interest.ts');
const ids=Object.keys(sampleOrderRules),kinds=['policy','tourism','event','cartoon','accessible','interview','video'];
const samples=kinds.map((kind,i)=>({article:{id:ids[i],title:`원래 제목 ${i+1}`,summary:`저장된 요약 ${i+1}`,body:`고유 본문 ${i+1}`,blocks:[]},kind,artDirectionVersion:3,headline:`표지 제목 ${i+1}`,summary:`시연 요약 ${i+1}`,cover:`/original-${kind}.webp`,eyebrow:`0${i+1}`,pale:'#ffffff',color:'#123456'}));
const numbers=results=>results.map(r=>ids.indexOf(r.sample.article.id)+1);

test('ordinary reader keeps title/summary, visible paragraph precedence, whitespace and body fallback',()=>{
 const article={...samples[0].article,title:' 제목 ',summary:'요약\n입니다',body:'fallback only',blocks:[{type:'paragraph',isVisible:false,body:'숨긴 비밀'},{type:'paragraph',isVisible:true,body:'실제\n 문단'},{type:'image',isVisible:true,body:'image-url'}]};
 assert.equal(common.getPlainArticleSearchText(article,0),'제목 요약 입니다 실제 문단');
 assert.equal(common.getPlainArticleSearchText({...article,title:' ',blocks:[]},2),'기사 3 요약 입니다 fallback only');
 assert(common.articleSearchMatches('강아지 Dog 이야기','  dOG  '));assert(!common.articleSearchMatches('Dog','  '));assert(!common.articleSearchMatches('Dog','.*'));
 const text='가'.repeat(100)+'Dog'+'나'.repeat(100),snippet=common.buildArticleSearchSnippet(text,'Dog');
 assert.equal(snippet,'...'+'가'.repeat(36)+'Dog'+'나'.repeat(64)+'...');assert.equal(common.buildArticleSearchSnippet(text,'없음'),text.slice(0,96));
});
test('sample search reuses common matching across original title/summary/body, display text, topics and English',()=>{
 const index=buildProposalSearchIndex(samples);
 assert.deepEqual(numbers(searchProposalSamples(samples,index,'재활용')),[1]);
  assert(!searchProposalSamples(samples,index,'재활용')[0].snippet.includes('recycling'));
 assert.deepEqual(numbers(searchProposalSamples(samples,index,'관광')),[2,3,6,7]);
 assert.deepEqual(numbers(searchProposalSamples(samples,index,'문화행사')),[3]);
 assert.deepEqual(numbers(searchProposalSamples(samples,index,'반려견')),[4,5]);
 assert.deepEqual(numbers(searchProposalSamples(samples,index,' DOG ')),[4,5]);
 for(const query of ['원래 제목 2','저장된 요약 2','고유 본문 2','표지 제목 2','시연 요약 2'])assert.deepEqual(numbers(searchProposalSamples(samples,index,query)),[2]);
 assert.deepEqual(numbers(searchProposalSamples(samples,index,'registered dog')),[5]);
 assert.deepEqual(numbers(searchProposalSamples(samples,index,'없는검색어xyz')),[]);
 assert.deepEqual(numbers(searchProposalSamples(samples,index,'  ')),[]);
});
for(const [interest,expected] of Object.entries({all:[4,5],civic:[5,4],culture:[4,5],pets:[4,5]})){
 test(`${interest}: search includes all topics, only result priority changes, without changing inputs`,()=>{
  const before=JSON.stringify(samples),index=buildProposalSearchIndex(samples),ordered=orderProposalSamples(samples,interest);
  const found=searchProposalSamples(ordered,index,'dog');assert.deepEqual(numbers(found),expected);assert.equal(JSON.stringify(samples),before);
  assert(found.every(r=>samples.includes(r.sample)));
 });
}
test('index ignores hidden blocks, image paths and unvalidated editorial metadata',()=>{
 const sample={...samples[0],article:{...samples[0].article,blocks:[{type:'paragraph',isVisible:true,title:'표시 문단 제목',body:'보이는 내용'},{type:'paragraph',isVisible:false,title:'hidden-title',body:'hidden-body'},{type:'image',isVisible:true,body:'/secret-path.webp',metadata:{arbitrary:'secret-metadata'}}]}};
 const index=buildProposalSearchIndex([sample]);assert.equal(searchProposalSamples([sample],index,'표시 문단 제목').length,1);
 for(const q of ['hidden-title','hidden-body','secret-path','secret-metadata'])assert.equal(searchProposalSamples([sample],index,q).length,0);
});
test('validated interview sections are searchable without exposing source URLs or malformed metadata',()=>{
 const s={...samples[5],article:{...samples[5].article,blocks:[{type:'image',isVisible:true,body:'/original-interview.webp',metadata:{proposal_sample:{},proposal_editorial:{sourceUrl:'https://v.daum.net/v/20260608110932267',publishedDate:'2026-06-08',credit:'사진 출처',person:'신현정',role:'시각예술 작가',quote:'빛에 머물기',note:'자료 기반',videoId:'',canvaCover:'',sections:[{title:'인터뷰 소제목',text:'재료를 탐구하는 이야기'}]}}}]}};
 let index=buildProposalSearchIndex([s]);assert.equal(searchProposalSamples([s],index,'재료를 탐구').length,1);assert.equal(searchProposalSamples([s],index,'신현정').length,1);
 assert.equal(searchProposalSamples([s],index,'v.daum.net').length,0);
 s.article.blocks[0].metadata.proposal_editorial.sourceUrl='https://unverified.invalid/';index=buildProposalSearchIndex([s]);assert.equal(searchProposalSamples([s],index,'재료를 탐구').length,0);
});

function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const c of React.Children.toArray(node.props?.children)){const found=find(c,predicate);if(found)return found;}return null;}
function harness(){
 let cursor=0,focus=0;const states=[],pushes=[];
 const UI=loader({react:{...React,useState(initial){const n=cursor++;if(!(n in states))states[n]=initial;return[states[n],v=>states[n]=v];},useMemo:fn=>fn(),useRef:()=>({current:{focus:()=>focus++}})},
 'next/link':({children,...p})=>React.createElement('a',p,children),'next/navigation':{useRouter:()=>({push:u=>pushes.push(u)})},
 '@/components/public-mobile-article-reader':{ArticleCard:()=>null},'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null}})('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader;
 const render=interest=>{cursor=0;return UI({slug:'hwaseong-2026-10-samples',samples,fonts:[],backgrounds:{},textDesigns:{},contents:true,detail:false,width:390,interest});};
 return{render,focus:()=>focus,pushes};
}
test('typing filters existing thumbnail cards locally; clear restores selected-interest TOC and focus',()=>{
 const h=harness();let tree=h.render('civic');let input=find(tree,n=>n.type==='input');assert.equal(input.props.type,'search');assert.equal(input.props.maxLength,100);
 input.props.onChange({currentTarget:{value:'dog'}});tree=h.render('civic');let html=renderToStaticMarkup(tree);
 assert.match(html,/검색 결과 2건/);assert.equal((html.match(/data-sample-thumbnail=/g)||[]).length,2);assert(html.indexOf('original-accessible')<html.indexOf('original-cartoon'));
 const articleLinks=[...html.matchAll(/href="([^"]*articleId=[^"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),'https://fixture'));
 assert.equal(articleLinks.length,2);assert(articleLinks.every(u=>u.searchParams.get('interest')==='civic'));assert.equal(h.pushes.length,0);
 find(tree,n=>n.type==='button'&&n.props.children==='검색 종료').props.onClick();html=renderToStaticMarkup(h.render('civic'));
 assert.equal((html.match(/data-sample-thumbnail=/g)||[]).length,7);assert(!html.includes('검색 결과 2건'));assert.equal(h.focus(),1);
});
test('empty results and special-character queries do not render raw HTML or drop interest controls',()=>{
 const h=harness();let tree=h.render('pets');find(tree,n=>n.type==='input').props.onChange({currentTarget:{value:'<script>xyz</script>'}});
 let html=renderToStaticMarkup(h.render('pets'));assert.match(html,/검색 결과가 없습니다/);assert.match(html,/관심분야 선택/);assert(!html.includes('<script>'));
 tree=h.render('pets');find(tree,n=>n.type==='input').props.onChange({currentTarget:{value:'  '}});html=renderToStaticMarkup(h.render('pets'));assert.equal((html.match(/data-sample-thumbnail=/g)||[]).length,7);
});
