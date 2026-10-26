/* eslint-disable @typescript-eslint/no-require-imports -- Isolated native-history and gesture fixtures. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const load=loader(),{readSampleLocation,canUseSampleHistory,sampleSwipeDirection}=load('src/lib/hwaseong-sample-navigation.ts');
const {readerSwipeDirection,isReaderInteractiveTarget}=load('src/lib/mobile-reader-navigation.ts');
const ids=Object.keys(load('src/lib/hwaseong-sample-interest.ts').sampleOrderRules),slug='hwaseong-2026-10-samples';
test('location parser preserves validated deep links, width, interest and detail, rejects repeated interests/unknown IDs',()=>{
 const p=readSampleLocation(new URLSearchParams(`articleId=${ids[2]}&view=detail&width=520&interest=pets&qa=1`),ids);
 assert.equal(p.selectedId,ids[2]);assert.equal(p.detail,true);assert.equal(p.width,520);assert.equal(p.interest,'pets');assert.equal(p.qa,true);
 const bad=readSampleLocation(new URLSearchParams('articleId=other&interest=pets&interest=civic&width=999'),ids);assert.equal(bad.selectedId,undefined);assert.equal(bad.interest,'all');assert.equal(bad.width,390);
});
test('history interception is scoped to this project and origin; no cross-project or external routing',()=>{
 const current=`https://staging.invalid/projects/${slug}/samples?width=390`;
 assert(canUseSampleHistory(`?articleId=${ids[0]}`,current,slug));
 assert(canUseSampleHistory(`/projects/${slug}/samples?view=contents`,current,slug));
 for(const href of ['https://external.invalid/','/projects/other/samples','/projects/'+slug+'/reading','javascript:alert(1)','http://['])assert(!canUseSampleHistory(href,current,slug));
});
test('shared swipe thresholds reject taps, vertical gestures and insufficient diagonal motion',()=>{
 const s={x:200,y:100};assert.equal(readerSwipeDirection(s,{x:100,y:105},390),'next');assert.equal(readerSwipeDirection(s,{x:300,y:105},520),'previous');
 for(const p of [{x:160,y:100},{x:120,y:200},{x:170,y:250}])assert.equal(readerSwipeDirection(s,p,390),null);
 assert.equal(readerSwipeDirection(s,{x:120,y:100},1000),null);
});
test('map/media controls, interactive elements and horizontal scrollers keep their gestures',()=>{
 const oldElement=global.Element,oldStyle=global.getComputedStyle;class E{constructor(interactive=false,parent=null,w=100,c=100){this.interactive=interactive;this.parentElement=parent;this.scrollWidth=w;this.clientWidth=c;}closest(){return this.interactive?this:null;}}
 global.Element=E;global.getComputedStyle=()=>({overflowX:'auto'});
 try{assert(isReaderInteractiveTarget(new E(true)));assert(isReaderInteractiveTarget(new E(false,new E(false,null,200,100))));assert(!isReaderInteractiveTarget(new E()));assert(!isReaderInteractiveTarget(null));}finally{global.Element=oldElement;global.getComputedStyle=oldStyle;}
});
const samples=ids.map((id,i)=>({article:{id,blocks:[],body:'원문',sortOrder:i},kind:'policy',headline:`표지 ${i}`,summary:'요약',cover:'/retained.webp',eyebrow:`0${i+1}`,pale:'#ffffff',color:'#123456'}));
function harness(initial){let query=new URLSearchParams(initial),cursor=0;const states=[],events=[],history=[];
 const UI=loader({react:{...React,useState(v){const i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=v];},useMemo:f=>f(),useRef:v=>({current:v}),useEffect:()=>{},useLayoutEffect:()=>{}},'next/navigation':{useSearchParams:()=>query},'@/components/public-mobile-article-reader':{ArticleCard:()=>React.createElement('p',null,'원文'),PublicNewsletterCoverView:()=>null},'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null}})('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader;
 const oldWindow=global.window,oldElement=global.Element;
 class Anchor{constructor(href,target=''){this.href=href;this.target=target;}closest(){return this;}getAttribute(k){return k==='href'?this.href:null;}hasAttribute(){return false;}}
 global.Element=Anchor;global.window={location:{href:`https://staging.invalid/projects/${slug}/samples?${initial}`},dispatchEvent:e=>events.push(e.type),history:{pushState:(_s,_t,u)=>{history.push(String(u));global.window.location.href=String(u);query=new URL(u).searchParams;}},getSelection:()=>null};
 return{render(){cursor=0;return UI({slug,samples,fonts:[],backgrounds:{},textDesigns:{},detail:false,width:390,cover:{coverImageSrc:'/cover.webp'}});},click(tree,href,extra={}){let prevented=false;tree.props.onClickCapture({target:new Anchor(href,extra.target),button:0,preventDefault:()=>prevented=true,...extra});return prevented;},history,events,restore(){global.window=oldWindow;global.Element=oldElement;}};
}
test('client navigation updates canonical URL without a server router; new-tab and external links retain native behavior',()=>{
 const h=harness('width=390&view=contents&interest=civic');try{
  const tree=h.render();assert(h.click(tree,`/projects/${slug}/samples?articleId=${ids[4]}&width=390&interest=civic`));
  assert.equal(h.history.length,1);assert(h.events.includes('datadiction:stop-article-audio'));
  const rendered=renderToStaticMarkup(h.render());assert.match(rendered,/표지 4/);assert(!rendered.includes('관심분야 선택'));
  for(const extra of [{ctrlKey:true},{metaKey:true},{button:1},{target:'_blank'}])assert(!h.click(tree,`/projects/${slug}/samples?view=contents`,extra));
  assert(!h.click(tree,'https://external.invalid/'));assert.equal(h.history.length,1);
 }finally{h.restore();}
});
test('arrows always open neighboring summaries, preserve interest order and first/last boundaries',()=>{
 const h=harness(`width=520&articleId=${ids[0]}&view=detail&interest=pets`);try{
  const tree=h.render(),controls=React.Children.toArray(tree.props.children).find(n=>n.props?.onNavigate);
  assert.equal(new URL(controls.props.previous.href,'https://fixture').searchParams.get('articleId'),ids[4]);
  assert.equal(new URL(controls.props.next.href,'https://fixture').searchParams.get('articleId'),ids[1]);
  assert.equal(new URL(controls.props.next.href,'https://fixture').searchParams.get('view'),null);assert.equal(new URL(controls.props.next.href,'https://fixture').searchParams.get('interest'),'pets');
 }finally{h.restore();}
 const first=harness(`width=390&articleId=${ids[0]}`);try{const c=React.Children.toArray(first.render().props.children).find(n=>n.props?.onNavigate);assert.equal(c.props.previous.label,'목차로 이동');}finally{first.restore();}
 const last=harness(`width=390&articleId=${ids[6]}`);try{const c=React.Children.toArray(last.render().props.children).find(n=>n.props?.onNavigate);assert.equal(c.props.next,undefined);const html=renderToStaticMarkup(c);assert.match(html,/disabled=""/);assert.match(html,/마지막 기사/);}finally{last.restore();}
});

test('sample swipe is lighter while rejecting vertical scroll, diagonal motion and taps',()=>{
 const s={x:200,y:100};assert.equal(sampleSwipeDirection(s,{x:157,y:105},390),'next');assert.equal(sampleSwipeDirection(s,{x:254,y:105},520),'previous');
 for(const p of [{x:170,y:100},{x:150,y:140},{x:210,y:170}])assert.equal(sampleSwipeDirection(s,p,390),null);
});
test('cover, contents and first summary form one sequence; detail is inline without a second summary',()=>{
 const cover=harness('width=390');try {const c=React.Children.toArray(cover.render().props.children).find(n=>n.props?.onNavigate);assert.equal(new URL(c.props.next.href,'https://fixture').searchParams.get('view'),'contents');}finally{cover.restore();}
 const contents=harness('view=contents&width=390');try{const c=React.Children.toArray(contents.render().props.children).find(n=>n.props?.onNavigate);assert.equal(c.props.previous.label,'표지로 이동');assert.equal(new URL(c.props.next.href,'https://fixture').searchParams.get('articleId'),ids[0]);}finally{contents.restore();}
 const detail=harness(`articleId=${ids[0]}&view=detail&width=390`);try{const html=renderToStaticMarkup(detail.render());assert.match(html,/data-sample-inline-detail/);assert.match(html,/기사 접기/);assert.equal((html.match(/data-summary-kind=/g)||[]).length,1);assert.equal((html.match(/data-sample-reading-tools/g)||[]).length,1);}finally{detail.restore();}
});
