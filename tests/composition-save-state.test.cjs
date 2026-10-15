/* eslint-disable @typescript-eslint/no-require-imports -- Isolated hooks and controlled network receipts. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const loader=require('./canva-test-loader.cjs');
const composition=(text={},patch={})=>({id:'composition-a',articleId:'article-a',projectId:'project-a',status:'ready',settings:{textDesign:text,productionPattern:'manual'},assets:[{id:'placement-a',assetId:'asset-a',compositionId:'composition-a',isVisible:true,slot:'hero_background',settings:{offsetX:0},sortOrder:0,updatedAt:'1'}],updatedAt:'1',...patch});
function harness(initial=composition()){
 const slots=[],cleanups=[];let cursor=0;
 const hooks={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useEffect(fn){const i=cursor++;if(!slots[i]){slots[i]=true;cleanups.push(fn());}}};
 const load=loader({react:hooks});const {useCompositionSaveState}=load('src/components/design/use-composition-save-state.ts');
 return{load,render(){cursor=0;return useCompositionSaveState(initial,initial.articleId);},dispose(){cleanups.forEach(f=>f?.());}};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
test('text draft survives a placement response; persisted composition remains separate',async()=>{
 const h=harness();h.render().changeText({subtitle:'로컬 초안',subtitleEnabled:true});const request=deferred();
 const save=h.render().save({key:'placement-a',kind:'layout',perform:()=>request.promise});await tick();request.resolve({composition:composition({}, {updatedAt:'2'})});await save;
 const s=h.render();assert.equal(s.composition.settings.textDesign.subtitle,'로컬 초안');assert.deepEqual(s.saved.settings.textDesign,{});assert.equal(s.textStatus,'dirty');assert(s.hasUnsaved);
});
test('text failure preserves exact raw input and requires an explicit retry',async()=>{
 const h=harness();h.render().changeText({subtitle:'  초안  '});let calls=0;
 await h.render().save({key:'text',kind:'text',perform:async()=>{calls++;throw Error('실패');}});
 let s=h.render();assert.equal(s.textStatus,'error');assert.equal(s.composition.settings.textDesign.subtitle,'  초안  ');assert.equal(calls,1);await tick();assert.equal(calls,1);
 await s.save({key:'text',kind:'text',perform:async()=>{calls++;return{composition:composition({subtitle:'초안'})};}});
 s=h.render();assert.equal(s.textStatus,'saved');assert.equal(s.composition.settings.textDesign.subtitle,'초안');assert(!s.hasUnsaved);assert.equal(calls,2);
});
test('serial writes prevent reversed network completion; earlier acknowledgement cannot erase newer typing',async()=>{
 const h=harness(),first=deferred(),second=deferred(),calls=[];
 h.render().changeText({subtitle:'첫 값'});
 const a=h.render().save({key:'text',kind:'text',perform:()=>{calls.push(1);return first.promise;}});
 h.render().changeText({subtitle:'둘째 값'});
 const b=h.render().save({key:'text',kind:'text',perform:()=>{calls.push(2);return second.promise;}});
 second.resolve({composition:composition({subtitle:'둘째 값'},{updatedAt:'3'})});await tick();assert.deepEqual(calls,[1]);
 first.resolve({composition:composition({subtitle:'첫 값'},{updatedAt:'2'})});await a;
 assert.equal(h.render().composition.settings.textDesign.subtitle,'둘째 값');await b;
 assert.deepEqual(calls,[1,2]);assert.equal(h.render().saved.settings.textDesign.subtitle,'둘째 값');assert.equal(h.render().textStatus,'saved');
});
test('typing while a text save is pending stays dirty after that save succeeds',async()=>{
 const h=harness(),d=deferred();h.render().changeText({subtitle:'보낸 값'});const p=h.render().save({key:'text',kind:'text',perform:()=>d.promise});
 h.render().changeText({subtitle:'아직 안 보낸 값'});d.resolve({composition:composition({subtitle:'보낸 값'})});await p;
 assert.equal(h.render().textStatus,'dirty');assert.equal(h.render().composition.settings.textDesign.subtitle,'아직 안 보낸 값');
});
test('placement failure retains settings, visibility and order; explicit retry preserves the text draft',async()=>{
 const h=harness();h.render().previewPatch('placement-a',{settings:{offsetX:27},isVisible:false,sortOrder:7});h.render().changeText({label:'초안'});let fail=true,calls=0;
 const task={key:'placement-a',kind:'layout',placementId:'placement-a',retryable:true,perform:async()=>{calls++;if(fail)throw Error('배치 실패');return{composition:composition({}, {assets:[{...composition().assets[0],settings:{offsetX:27},isVisible:false,sortOrder:7}]})};}};
 await h.render().save(task);let s=h.render();assert.equal(s.layoutStatus,'error');assert.equal(s.composition.assets[0].settings.offsetX,27);assert.equal(s.composition.assets[0].isVisible,false);assert.equal(s.composition.assets[0].sortOrder,7);assert.equal(calls,1);
 fail=false;s.retryLayout();await tick();s=h.render();assert.equal(calls,2);assert.equal(s.layoutStatus,'saved');assert.equal(s.composition.settings.textDesign.label,'초안');assert.equal(s.textStatus,'dirty');
});
test('older placement acknowledgement cannot clear a newer unsent preview',async()=>{
 const h=harness(),d=deferred();h.render().previewPlacement('placement-a',{offsetX:10});const a=h.render().save({key:'p',kind:'layout',placementId:'placement-a',perform:()=>d.promise});h.render().previewPlacement('placement-a',{offsetX:30});
 d.resolve({composition:composition({}, {assets:[{...composition().assets[0],settings:{offsetX:10}}]})});await a;
 assert.equal(h.render().saved.assets[0].settings.offsetX,10);assert.equal(h.render().composition.assets[0].settings.offsetX,30);assert.equal(h.render().layoutStatus,'dirty');
});
test('double save coalesces only identical pending requests',async()=>{
 const h=harness(),d=deferred();let calls=0;const task={key:'text',kind:'text',signature:'same',perform:()=>{calls++;return d.promise;}};
 const a=h.render().save(task),b=h.render().save(task);assert.strictEqual(a,b);await tick();assert.equal(calls,1);d.resolve({composition:composition()});await b;assert(!h.render().busy);
});
test('article session disposal ignores old receipts and never starts its queued writes',async()=>{
 const h=harness(),d=deferred();let nextCalls=0;h.render().changeText({subtitle:'기존 기사 초안'});
 const old=h.render().save({key:'text',kind:'text',perform:()=>d.promise});await tick();const queued=h.render().save({key:'next',kind:'layout',perform:async()=>{nextCalls++;return{composition:composition()};}});
 h.dispose();const other=harness(composition({}, {id:'composition-b',articleId:'article-b'}));d.resolve({composition:composition({subtitle:'늦은 응답'})});assert.equal(await old,null);assert.equal(await queued,null);assert.equal(nextCalls,0);assert.deepEqual(other.render().composition.settings.textDesign,{});
});
test('foreign article receipt is rejected and the original draft is retained',async()=>{
 const h=harness();h.render().changeText({label:'보존'});await h.render().save({key:'text',kind:'text',perform:async()=>({composition:composition({}, {articleId:'other'})})});assert.equal(h.render().textStatus,'error');assert.equal(h.render().saved.articleId,'article-a');assert.equal(h.render().composition.settings.textDesign.label,'보존');
});
test('copy receipt preserves text draft; external atomic draft receipt cannot replace dirty/newer state',async()=>{
 const h=harness();h.render().changeText({label:'수정 중'});await h.render().save({key:'copy',kind:'layout',perform:async()=>({composition:composition({}, {status:'draft'})})});assert.equal(h.render().composition.settings.textDesign.label,'수정 중');h.render().acceptApplied(composition({label:'덮어쓰기'},{updatedAt:'3'}));assert.equal(h.render().composition.settings.textDesign.label,'수정 중');
});
test('saved display summary distinguishes draft, approval, inactive, hidden and unsupported slots',()=>{
 const h=harness(composition({}, {status:'draft',assets:[{...composition().assets[0],isVisible:false},{...composition().assets[0],id:'icon',slot:'title_icon'}]}));
 const {DesignSaveSummary}=h.load('src/components/design/design-save-summary.tsx');const html=renderToStaticMarkup(React.createElement(DesignSaveSummary,{state:h.render(),assets:[{id:'asset-a',name:'테스트 배경',approvalStatus:'draft',isActive:false}]}));
 for(const word of ['작성 중','미승인','비활성','숨김','미지원 슬롯','현재 공개·검토 화면에는 반영되지 않습니다','버튼으로 저장','항목별 자동 저장'])assert(html.includes(word),word);
});
test('valid saved placement has conditional eligibility, never a claim that article is published',()=>{
 const h=harness(),{DesignSaveSummary}=h.load('src/components/design/design-save-summary.tsx');const html=renderToStaticMarkup(React.createElement(DesignSaveSummary,{state:h.render(),assets:[{id:'asset-a',name:'승인 배경',approvalStatus:'approved',isActive:true}]}));assert(html.includes('기본 표시 조건 충족'));assert(html.includes('기사 공개·기관 검토 권한 조건은 별도로'));assert(html.includes('준비 완료'));
});
test('reverting a failed text save still requires confirmation, never reports saved from an uncertain request',async()=>{
 const h=harness();h.render().changeText({label:'보낸 값'});await h.render().save({key:'text',kind:'text',perform:async()=>{throw Error('응답 없음');}});h.render().changeText({});assert.equal(h.render().textStatus,'error');assert(h.render().hasUnsaved);
});
test('all three unsupported slots remain individually identified without deleting their placements',()=>{
 const rows=['title_icon','body_decoration','footer_banner'].map((slot,i)=>({...composition().assets[0],id:String(i),slot}));const h=harness(composition({}, {assets:rows})),{DesignSaveSummary}=h.load('src/components/design/design-save-summary.tsx');const state=h.render(),html=renderToStaticMarkup(React.createElement(DesignSaveSummary,{state,assets:[]}));assert.equal((html.match(/미지원 슬롯/g)||[]).length,3);assert.equal(state.saved.assets.length,3);
});
test('workspace receives only its article save notice and forwards it to the saved preview modal',()=>{
 const oldWindow=global.window,listeners=new Map();global.window={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 try{const states=[];let cursor=0;const hooks={useState(v){const i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=v];},useCallback:fn=>fn,useEffect(fn){const i=cursor++;if(!states[i]){states[i]=true;fn();}}};
 const load=loader({react:hooks}),{ArticleWorkspaceTabs}=load('src/components/article-workspace-tabs.tsx'),props={articleId:'a',initialTab:'composition',articleTitle:'기사',articleStatus:'작성 중',blockCount:0,linkCount:0,previewHref:'/saved',publishHref:'#',content:null,composition:null,review:null};const render=()=>{cursor=0;return ArticleWorkspaceTabs(props);};
 const find=(t,p)=>Array.isArray(t)?t.map(x=>find(x,p)).find(Boolean):t&&typeof t==='object'?(p(t)?t:find(t.props?.children,p)):null;
 render();listeners.get('article-design-save-state')({detail:{articleId:'other',unsettled:true}});assert(!find(render(),t=>t.props?.previewHref&&t.props?.isOpen!==undefined).props.designUnsettled);
 listeners.get('article-design-save-state')({detail:{articleId:'a',unsettled:true}});let tree=render();const modal=find(tree,t=>t.props?.previewHref&&t.props?.isOpen!==undefined);assert(modal.props.designUnsettled);assert(find(tree,t=>t.type==='p'&&String(t.props.children).includes('편집 중인 디자인')));
 listeners.get('article-design-save-state')({detail:{articleId:'a',unsettled:false}});assert(!find(render(),t=>t.props?.previewHref&&t.props?.isOpen!==undefined).props.designUnsettled);
 }finally{global.window=oldWindow;}
});
test('failed pattern apply can be explicitly retried without a dirty-text deadlock; later typing is preserved',async()=>{
 const h=harness();let fail=true;const task={key:'pattern',kind:'layout',replacesText:true,retryable:true,perform:async()=>{if(fail)throw Error('패턴 실패');return{composition:composition({label:'행사'})};}};
 await h.render().save(task);assert.equal(h.render().textStatus,'saved');assert.equal(h.render().layoutStatus,'error');assert(h.render().canRetryLayout);
 fail=false;h.render().retryLayout();h.render().changeText({label:'새 글자 초안'});await tick();assert.equal(h.render().saved.settings.textDesign.label,'행사');assert.equal(h.render().composition.settings.textDesign.label,'새 글자 초안');assert.equal(h.render().textStatus,'dirty');assert.equal(h.render().layoutStatus,'saved');
});
