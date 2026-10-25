/* eslint-disable @typescript-eslint/no-require-imports -- Isolated fixture rendering; no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const {normalizeSampleInterest,orderProposalSamples,sampleOrderRules}=loader()('src/lib/hwaseong-sample-interest.ts');
const {sampleHref}=loader()('src/lib/hwaseong-proposal-sample.ts');
const ids=Object.keys(sampleOrderRules),slug='hwaseong-2026-10-samples';
const expected={all:[1,2,3,4,5,6,7],civic:[1,5,2,3,4,6,7],culture:[2,3,6,7,1,4,5],pets:[4,5,1,2,3,6,7]};
const samples=ids.map((id,i)=>({article:{id,sortOrder:(i+1)*10,body:'보존할 본문',blocks:[],audioFile:null},kind:'policy',headline:`기사 ${i+1}`,summary:'저장된 요약',cover:'/retained.webp',eyebrow:`0${i+1}`,pale:'#ffffff',color:'#123456'}));
const Link=({children,href,...props})=>React.createElement('a',{...props,href},children);
function render(interest,props={}){
 let coverProps;const pushes=[];
 const load=loader({'next/link':Link,'next/navigation':{useSearchParams:()=>null,useRouter:()=>({push:u=>pushes.push(u)})},'@/components/public-mobile-article-reader':{ArticleCard:()=>React.createElement('p',null,'retained article'),PublicNewsletterCoverView:p=>{coverProps=p;return React.createElement('p',null,'retained cover');}},'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null}});
 const html=renderToStaticMarkup(React.createElement(load('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader,{slug,samples,fonts:[],backgrounds:{},textDesigns:{},detail:false,width:390,interest,cover:{coverTitle:'Cover',coverImageSrc:'/cover.webp'},...props}));
 const links=Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),m=>({url:new URL(m[1].replaceAll('&amp;','&'),'https://fixture.invalid'),text:m[2].replace(/<[^>]*>/g,'').trim()}));
 return {html,links,coverProps,pushes};
}
test('only explicit allowlisted interest strings are accepted; default and repeated parameters use all',()=>{
 for(const value of Object.keys(expected))assert.equal(normalizeSampleInterest(value),value);
 for(const value of [undefined,null,'','unknown','PETS','culture&articleId=other',['pets'],['pets','culture'],{}])assert.equal(normalizeSampleInterest(value),'all');
});
for(const [interest,order] of Object.entries(expected)){
 test(`${interest}: stable order keeps all seven, original objects and stored fields`,()=>{
  const before=JSON.stringify(samples),frozen=samples.map(s=>Object.freeze({...s,article:Object.freeze({...s.article})}));
  const sorted=orderProposalSamples(Object.freeze(frozen),interest);assert.deepEqual(sorted.map(s=>ids.indexOf(s.article.id)+1),order);assert.equal(new Set(sorted).size,7);for(const s of sorted)assert(frozen.includes(s));assert.equal(JSON.stringify(samples),before);
 });
 test(`${interest}: contents, cover actions and every summary/detail share one navigation order`,()=>{
  const toc=render(interest,{contents:true,width:520,qa:true});const storyLinks=toc.links.filter(x=>x.url.searchParams.has('articleId'));
  assert.deepEqual(storyLinks.map(x=>ids.indexOf(x.url.searchParams.get('articleId'))+1),order);assert.match(toc.html,/관심분야 선택/);assert(!toc.html.includes('AI 개인화'));
  for(const link of storyLinks){assert.equal(link.url.searchParams.get('width'),'520');assert.equal(link.url.searchParams.get('qa'),'1');assert.equal(link.url.searchParams.get('interest'),interest==='all'?null:interest);}
  const cover=render(interest);assert(!cover.html.includes('관심분야 선택'));const oldWindow=global.window;global.window={location:{href:'https://fixture.invalid/projects/'+slug+'/samples'},dispatchEvent:()=>{},history:{pushState:(_s,_t,u)=>cover.pushes.push(String(u))}};try{cover.coverProps.onStartReading();cover.coverProps.onOpenToc();}finally{global.window=oldWindow;}assert.equal(new URL(cover.pushes[0],'https://fixture.invalid').searchParams.get('articleId'),ids[order[0]-1]);assert.equal(new URL(cover.pushes[1],'https://fixture.invalid').searchParams.get('view'),'contents');
  for(let i=0;i<7;i++)for(const detail of [false,true]){
   const shown=render(interest,{selectedId:ids[order[i]-1],detail,width:520,qa:true});
   const prev=shown.links.find(x=>x.text==='← 이전 기사 요약'),next=shown.links.find(x=>x.text==='다음 기사 요약 →');
   assert.equal(prev?.url.searchParams.get('articleId'),i?ids[order[i-1]-1]:undefined);assert.equal(next?.url.searchParams.get('articleId'),i<6?ids[order[i+1]-1]:undefined);
   if(detail){const back=shown.links.find(x=>x.text==='← 이전 페이지 · 이 기사 요약');assert.equal(back.url.searchParams.get('articleId'),ids[order[i]-1]);assert(!back.url.searchParams.has('view'));}
   for(const link of shown.links.filter(x=>x.url.pathname.startsWith('/projects/'))){assert.equal(link.url.searchParams.get('interest'),interest==='all'?null:interest);assert.equal(link.url.searchParams.get('width'),link.text==='390px'?'390':'520');assert.equal(link.url.searchParams.get('qa'),'1');}
  }
 });
}
test('multiple topic matches do not outrank equal matches; dates never affect sorting and unknown articles stay accessible',()=>{
 assert.deepEqual(sampleOrderRules[ids[4]].topics,['civic','pets']);
 const extra={...samples[0],article:{...samples[0].article,id:'future-unknown',createdAt:'2099-12-31'}};
 const input=[...samples,extra];assert.deepEqual(orderProposalSamples(input,'civic').map(x=>x.article.id),[ids[0],ids[4],ids[1],ids[2],ids[3],ids[5],ids[6],'future-unknown']);
});
test('explicit mandatory priority outranks interest independently, without marking any current fixture mandatory',()=>{
 assert(Object.values(sampleOrderRules).every(r=>r.mandatoryPriority===0));
 const rules={...sampleOrderRules,[ids[6]]:{topics:[],mandatoryPriority:2},[ids[2]]:{topics:['culture'],mandatoryPriority:1}};
 for(const interest of Object.keys(expected)){const sorted=orderProposalSamples(samples,interest,rules);assert.deepEqual(sorted.slice(0,2).map(x=>x.article.id),[ids[6],ids[2]]);assert.equal(sorted.length,7);}
});
test('URL helper preserves legacy deep links and canonically rejects invalid interest without injecting fields',()=>{
 const legacy=sampleHref(slug,ids[0],true,390);assert(!legacy.includes('interest='));
 for(const interest of ['civic','culture','pets'])for(const id of [undefined,ids[0]])for(const detail of [false,true]){
  const url=new URL(sampleHref(slug,id,detail,520,{contents:true,qa:true,interest}),'https://fixture.invalid');assert.equal(url.searchParams.get('interest'),interest);assert.equal(url.searchParams.get('articleId'),id??null);assert.equal(url.searchParams.get('view'),id&&detail?'detail':!id?'contents':null);
 }
 for(const interest of ['all','invalid',['pets'],'pets&view=detail'])assert(!sampleHref(slug,ids[0],false,390,{interest}).includes('interest='));
});
