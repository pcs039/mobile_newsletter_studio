/* eslint-disable @typescript-eslint/no-require-imports -- Isolated native-history and gesture fixtures. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const load=loader(),{readSampleLocation,canUseSampleHistory,sampleSwipeDirection,isSampleSwipeBlocked}=load('src/lib/hwaseong-sample-navigation.ts');
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
function harness(initial,supplied=samples){let query=new URLSearchParams(initial),cursor=0;const states=[],events=[],history=[],assignments=[];
 const UI=loader({react:{...React,useSyncExternalStore:(_subscribe,_snapshot,server)=>server(),useState(v){const i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=v];},useMemo:f=>f(),useRef:v=>({current:v}),useEffect:()=>{},useLayoutEffect:()=>{}},'next/navigation':{useSearchParams:()=>query},'@/components/public-mobile-article-reader':{ArticleCard:()=>React.createElement('p',null,'원文'),PublicNewsletterCoverView:()=>null},'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null}})('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader;
 const oldWindow=global.window,oldElement=global.Element;
 class Anchor{constructor(href,target=''){this.href=href;this.target=target;}closest(){return this;}getAttribute(k){return k==='href'?this.href:null;}hasAttribute(){return false;}}
 global.Element=Anchor;global.window={innerWidth:390,location:{href:`https://staging.invalid/projects/${slug}/samples?${initial}`,assign:u=>assignments.push(String(u))},dispatchEvent:e=>events.push(e.type),history:{pushState:(_s,_t,u)=>{history.push(String(u));global.window.location.href=String(u);query=new URL(u).searchParams;}},getSelection:()=>null};
 return{render(){cursor=0;return UI({slug,samples:supplied,fonts:[],backgrounds:{},textDesigns:{},detail:false,width:390,cover:{coverImageSrc:'/cover.webp'}});},click(tree,href,extra={}){let prevented=false;tree.props.onClickCapture({target:new Anchor(href,extra.target),button:0,preventDefault:()=>prevented=true,...extra});return prevented;},history,events,assignments,restore(){global.window=oldWindow;global.Element=oldElement;}};
}
test('isolated author test preview returns to the actual issue dataset; same-clone expand stays inline',()=>{
 const clone={...samples[0],editorTest:true,article:{...samples[0].article,id:'11111111-1111-4111-8111-111111111111'}};
 const h=harness(`articleId=${clone.article.id}&width=390`,[clone]);try{
  assert(h.click(h.render(),`/projects/${slug}/samples?articleId=${clone.article.id}&view=detail&width=390`));assert.equal(h.history.length,1);assert.equal(h.assignments.length,0);
  assert(h.click(h.render(),`/projects/${slug}/samples?view=contents&width=390`));assert.equal(h.assignments.length,1);assert.equal(h.history.length,1);
 }finally{h.restore();}
});
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
 const detail=harness(`articleId=${ids[0]}&view=detail&width=390`);try{const html=renderToStaticMarkup(detail.render());assert.match(html,/data-sample-inline-detail/);assert.match(html,/기사 접기/);assert.equal((html.match(/data-summary-kind=/g)||[]).length,1);assert.equal((html.match(/data-sample-reading-tools=/g)||[]).length,2);}finally{detail.restore();}
});

test('touch navigation from expanded content opens the next summary; vertical scrolling does not navigate',()=>{
 const h=harness(`articleId=${ids[0]}&view=detail&width=390`);try{
  const tree=h.render();tree.props.onTouchStart({target:null,touches:[{clientX:240,clientY:200}]});tree.props.onTouchEnd({changedTouches:[{clientX:195,clientY:205}]});
  assert.equal(h.history.length,1);const next=new URL(h.history[0]);assert.equal(next.searchParams.get('articleId'),ids[1]);assert(!next.searchParams.has('view'));
  const again=h.render();again.props.onTouchStart({target:null,touches:[{clientX:240,clientY:200}]});again.props.onTouchMove({touches:[{clientX:230,clientY:230}]});again.props.onTouchEnd({changedTouches:[{clientX:160,clientY:260}]});assert.equal(h.history.length,1);
 }finally{h.restore();}
});

function imageFixture(){
 class ElementFixture {
  constructor(tag,attributes={},parent=null,w=200,h=120){this.tagName=tag.toUpperCase();this.attributes=attributes;this.parentElement=parent;this.children=[];this.scrollWidth=200;this.clientWidth=200;this.width=w;this.height=h;if(parent)parent.children.push(this);}
  hasAttribute(k){return Object.hasOwn(this.attributes,k);}getAttribute(k){return this.attributes[k]??null;}
  closest(selectors){for(const s of selectors.split(',').map(x=>x.trim())){const a=s.match(/^\[([^=\]]+)(?:="([^\"]*)")?\]$/);if(a?(this.hasAttribute(a[1])&&(a[2]===undefined||this.getAttribute(a[1])===a[2])):this.tagName.toLowerCase()===s)return this;}return this.parentElement?.closest(selectors)??null;}
  querySelector(tag){for(const child of this.children){if(child.tagName.toLowerCase()===tag)return child;const found=child.querySelector(tag);if(found)return found;}return null;}
  getBoundingClientRect(){return{width:this.width,height:this.height};}
 }
 return ElementFixture;
}
test('images in zoom buttons, photo figures and URL links accept swipes; controls, video, map, lightbox and horizontal scrollers are protected',()=>{
 const oldElement=global.Element,oldStyle=global.getComputedStyle,E=imageFixture();global.Element=E;global.getComputedStyle=n=>({overflowX:n.attributes.scroll?'auto':'visible'});
 try{
  const zoom=new E('button',{'data-sample-swipe-image':''}),illustration=new E('img',{},zoom),photo=new E('img',{},new E('figure')),link=new E('a',{href:'https://source.invalid'}),linkedImage=new E('img',{},link),overlay=new E('span',{},link);
  for(const target of [zoom,illustration,photo,link,linkedImage,overlay,new E('p')])assert.equal(isSampleSwipeBlocked(target),false);
  const video=new E('div',{'data-swipe-navigation-ignore':''}),map=new E('div',{'data-swipe-navigation-ignore':''}),dialog=new E('section',{role:'dialog'}),scroller=new E('div',{scroll:true});scroller.scrollWidth=500;
  const iconButton=new E('button');const smallIcon=new E('img',{},iconButton,24,24);
  for(const target of [new E('img',{},video),new E('img',{},map),new E('img',{},dialog),new E('img',{},scroller),new E('button'),new E('a',{href:'/cta'}),new E('input'),new E('iframe'),smallIcon])assert.equal(isSampleSwipeBlocked(target),true);
 }finally{global.Element=oldElement;global.getComputedStyle=oldStyle;}
});
test('mouse image drag navigates once and suppresses its zoom/link click; short taps, vertical gestures and two-finger touch remain native',()=>{
 const h=harness(`articleId=${ids[0]}&view=detail&width=390`),oldElement=global.Element,oldStyle=global.getComputedStyle,E=imageFixture();global.Element=E;global.getComputedStyle=()=>({overflowX:'visible'});
 try{
  const image=new E('img',{},new E('a',{href:'https://source.invalid'})),tree=h.render();let stopped=false,prevented=false;
  let nativeDragBlocked=false;tree.props.onDragStartCapture({target:image,preventDefault:()=>nativeDragBlocked=true});assert(nativeDragBlocked);
  const protectedVideo=new E('img',{},new E('div',{'data-swipe-navigation-ignore':''}));nativeDragBlocked=false;tree.props.onDragStartCapture({target:protectedVideo,preventDefault:()=>nativeDragBlocked=true});assert(!nativeDragBlocked);
  const event=(x,y)=>({target:image,button:0,pointerType:'mouse',pointerId:1,clientX:x,clientY:y,preventDefault:()=>{},currentTarget:{setPointerCapture:()=>{}}});
  tree.props.onPointerDownCapture(event(250,100));tree.props.onPointerMoveCapture(event(190,103));tree.props.onPointerUpCapture(event(170,104));assert.equal(h.history.length,1);assert(!new URL(h.history[0]).searchParams.has('view'));
  tree.props.onClickCapture({target:image,detail:1,button:0,preventDefault:()=>prevented=true,stopPropagation:()=>stopped=true});assert(prevented&&stopped);
  const next=h.render();next.props.onPointerDownCapture(event(200,100));next.props.onPointerUpCapture(event(202,102));prevented=false;next.props.onClickCapture({target:image,detail:1,button:0,preventDefault:()=>prevented=true,stopPropagation:()=>{}});assert(!prevented);assert.equal(h.history.length,1);
  next.props.onPointerDownCapture({...event(250,100),target:protectedVideo});next.props.onPointerUpCapture({...event(170,103),target:protectedVideo});prevented=false;next.props.onClickCapture({target:protectedVideo,detail:1,button:0,preventDefault:()=>prevented=true,stopPropagation:()=>{}});assert(prevented);assert.equal(h.history.length,1);
  next.props.onTouchStart({target:image,touches:[{clientX:250,clientY:100},{clientX:150,clientY:100}]});next.props.onTouchEnd({changedTouches:[{clientX:100,clientY:100}]});assert.equal(h.history.length,1);
  next.props.onTouchStart({target:image,touches:[{clientX:250,clientY:100}]});next.props.onTouchMove({touches:[{clientX:235,clientY:140}]});next.props.onTouchEnd({changedTouches:[{clientX:170,clientY:190}]});assert.equal(h.history.length,1);
 }finally{global.Element=oldElement;global.getComputedStyle=oldStyle;h.restore();}
});

test('same-article mobile/book switches keep identity, interest and detail without stopping audio',()=>{
 const h=harness(`articleId=${ids[3]}&view=detail&interest=pets&width=390`);try{
  assert(h.click(h.render(),`/projects/${slug}/samples?articleId=${ids[3]}&view=detail&interest=pets&width=390&display=ebook`));
  assert(!h.events.includes('datadiction:stop-article-audio'));const tree=h.render();assert.equal(tree.props['data-sample-display'],'ebook');
  assert(h.click(tree,`/projects/${slug}/samples?articleId=${ids[4]}&interest=pets&width=390`));assert.equal(new URL(h.history.at(-1)).searchParams.get('display'),'ebook');assert(h.events.includes('datadiction:stop-article-audio'));
 }finally{h.restore();}
});

test('one-finger pan while native zoomed never turns an article or cancels the browser gesture',()=>{
 const h=harness(`articleId=${ids[0]}&width=390`);try{
  global.window.visualViewport={scale:2};const tree=h.render();let prevented=false;
  tree.props.onTouchStart({target:null,touches:[{clientX:260,clientY:160}],preventDefault:()=>prevented=true});
  tree.props.onTouchMove({touches:[{clientX:100,clientY:162}],preventDefault:()=>prevented=true});
  tree.props.onTouchEnd({changedTouches:[{clientX:90,clientY:162}],preventDefault:()=>prevented=true});
  assert.equal(h.history.length,0);assert.equal(h.events.length,0);assert.equal(prevented,false);
 }finally{h.restore();}
});
test('a pinch cancels the in-flight swipe even when scale returns to one before fingers release',()=>{
 const h=harness(`articleId=${ids[0]}&width=390`);try{
  global.window.visualViewport={scale:1};const tree=h.render();
  tree.props.onTouchStart({target:null,touches:[{clientX:260,clientY:160}]});
  tree.props.onTouchStart({target:null,touches:[{clientX:260,clientY:160},{clientX:120,clientY:160}]});
  global.window.visualViewport.scale=2;tree.props.onTouchMove({touches:[{clientX:280,clientY:160},{clientX:80,clientY:160}]});
  global.window.visualViewport.scale=1;tree.props.onTouchMove({touches:[{clientX:100,clientY:160}]});
  tree.props.onTouchEnd({changedTouches:[{clientX:80,clientY:160}]});assert.equal(h.history.length,0);
  tree.props.onTouchStart({target:null,touches:[{clientX:260,clientY:160}]});tree.props.onTouchEnd({changedTouches:[{clientX:180,clientY:162}]});assert.equal(h.history.length,1);
 }finally{h.restore();}
});
test('scale change during a single-touch pan suppresses the pending article turn',()=>{
 const h=harness(`articleId=${ids[0]}&width=390`);try{
  global.window.visualViewport={scale:1};const tree=h.render();
  tree.props.onTouchStart({target:null,touches:[{clientX:260,clientY:160}]});
  global.window.visualViewport.scale=1.5;tree.props.onTouchMove({touches:[{clientX:160,clientY:162}]});
  global.window.visualViewport.scale=1;tree.props.onTouchEnd({changedTouches:[{clientX:140,clientY:162}]});assert.equal(h.history.length,0);
 }finally{h.restore();}
});
