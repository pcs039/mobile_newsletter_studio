/* eslint-disable @typescript-eslint/no-require-imports -- isolated UI state regression harness. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const loader=require('./canva-test-loader.cjs');
function nodes(t,p){if(!t||typeof t!=='object')return[];if(Array.isArray(t))return t.flatMap(x=>nodes(x,p));return[...(p(t)?[t]:[]),...nodes(t.props?.children,p)];}
function text(t){if(t==null||typeof t==='boolean')return'';if(typeof t!=='object')return String(t);if(Array.isArray(t))return t.map(text).join('');return text(t.props?.children);}
function harness(file,name,props,overrides={}){
 const slots=[];let i=0;const hooks={...React,useState(v){const n=i++;if(!(n in slots))slots[n]=typeof v==='function'?v():v;return[slots[n],v=>slots[n]=typeof v==='function'?v(slots[n]):v];},useRef(v){const n=i++;return slots[n]??(slots[n]={current:v});},useMemo:fn=>fn(),useEffect:()=>{}};
 const fn=loader({react:hooks,
  '@/components/design/article-design-draft-controls':{ArticleDesignDraftControls:()=>null},
  '@/components/design/canva-text-autofill':{CanvaTextAutofill:()=>null},
  '@/components/design/composition-mobile-preview':{CompositionMobilePreview:()=>null},
  ...overrides})(file)[name];return{render(){i=0;return fn(props);}};
}
const button=(t,label)=>nodes(t,e=>e.type==='button'&&text(e)===label)[0];
const patternProps={pattern:'manual',textDesign:{},composition:{settings:{},assets:[]},article:{},articleId:'a',projectSlug:'p',onApply:()=>{}};
test('first-time design guidance is available before composition creation without creating data',()=>{
 const state={composition:null,saved:null,textStatus:'saved',layoutStatus:'saved',hasUnsaved:false,busy:false};
 const article={id:'a',title:'문화 행사 안내',summary:'문화 행사에 참여하세요',body:'행사 일정과 참가 방법을 안내합니다.',articleType:'event_festival',publicInfo:{},blocks:[],links:[]};
 const h=harness('src/components/design/article-composition-editor.tsx','ArticleCompositionEditor',{article,assets:[],initialComposition:null,initialStatus:'not_found',projectSlug:'p',previewArticle:article,reuseSources:[]},{'@/components/design/use-composition-save-state':{useCompositionSaveState:()=>state}});
 const boundary=h.render(),t=boundary.type(boundary.props);
 const recommendation=nodes(t,e=>e.props?.result?.primaryStrategy)[0];assert(recommendation);
 assert.equal(recommendation.props.result.primaryStrategy,'canva_full_layout');
 assert(button(t,'디자인 조정 시작'));assert(!state.composition);
});
test('manual pattern disclosure preserves selection; confirmation opens change details, no apply on disclosure or selection',()=>{
 let calls=0;const h=harness('src/components/design/article-production-pattern-controls.tsx','ArticleProductionPatternControls',{...patternProps,onApply:()=>calls++});
 let t=h.render(),details=nodes(t,e=>e.type==='details')[0];assert(!details.props.open);
 nodes(t,e=>e.type==='select')[0].props.onChange({target:{value:'event'}});
 t=h.render();assert.equal(nodes(t,e=>e.type==='select')[0].props.value,'event');assert.match(text(nodes(t,e=>e.type==='summary')[0]),/미적용 선택/);assert.equal(calls,0);
 button(t,'패턴 변경 내용 확인').props.onClick();t=h.render();assert(nodes(t,e=>e.type==='details')[0].props.open);assert.match(text(t),/현재 개별 디자인 설정 일부가 변경/);assert.equal(calls,0);
 button(t,'취소').props.onClick();t=h.render();assert.equal(nodes(t,e=>e.type==='select')[0].props.value,'event');assert.equal(calls,0);
 button(t,'패턴 변경 내용 확인').props.onClick();button(h.render(),'확인하고 적용').props.onClick();assert.equal(calls,1);
});
test('pattern loading, result and failure remain outside collapsed tools; no implicit retry',async()=>{
 const before=global.fetch;let resolve,calls=0;global.fetch=()=>{calls++;return new Promise(r=>resolve=r);};
 try{
 const h=harness('src/components/design/article-production-pattern-controls.tsx','ArticleProductionPatternControls',patternProps);
 const p=button(h.render(),'제작 패턴 추천받기').props.onClick();let t=h.render(),details=nodes(t,e=>e.type==='details')[0];
 assert(!nodes(details,e=>e.props?.role==='status').length);assert(nodes(t,e=>e.props?.role==='status')[0].props['aria-busy']);
 resolve({ok:true,json:async()=>({ok:true,recommendation:{pattern:'event',reason:'행사 안내'}})});await p;await new Promise(r=>setImmediate(r));
 t=h.render();assert.match(text(nodes(t,e=>e.props?.role==='status')[0]),/행사 안내/);assert(!text(nodes(t,e=>e.type==='details')[0]).includes('행사 안내'));assert.equal(calls,1);
 global.fetch=async()=>{calls++;throw Error('일시 실패');};button(t,'제작 패턴 추천받기').props.onClick();await new Promise(r=>setImmediate(r));
 t=h.render();assert.match(text(nodes(t,e=>e.props?.role==='status')[0]),/일시 실패/);h.render();assert.equal(calls,2);
 }finally{global.fetch=before;}
});
test('registered Canva selection stays mounted under native details and summary announces retained work',()=>{
 const h=harness('src/components/design/article-canva-templates.tsx','ArticleCanvaTemplates',{projectSlug:'p',articleId:'a'});let t=h.render();
 nodes(t,e=>e.type==='select')[0].props.onChange({target:{value:'template-a'}});t=h.render();
 assert.equal(t.type,'details');assert.match(text(nodes(t,e=>e.type==='summary')[0]),/선택한 템플릿 있음/);
 const autofill=nodes(t,e=>e.props?.templateId==='template-a')[0];assert(autofill);assert.equal(autofill.key,'p:a:template-a');
 assert.equal(nodes(h.render(),e=>e.props?.templateId==='template-a')[0].key,autofill.key);
});
test('collapsed detail summary exposes dirty/saving/error state; preview and pattern children remain mounted',()=>{
 const composition={id:'c',articleId:'a',settings:{textDesign:{}},assets:[],status:'draft'};
 const state={composition,saved:composition,textStatus:'dirty',layoutStatus:'saving',hasUnsaved:true,busy:true};
 const h=harness('src/components/design/article-composition-editor.tsx','ArticleCompositionEditor',{article:{id:'a'},assets:[],initialComposition:composition,initialStatus:'ok',projectSlug:'p',previewArticle:{id:'a'},reuseSources:[]},{'@/components/design/use-composition-save-state':{useCompositionSaveState:()=>state}});
 // The exported article-keyed boundary owns the unchanged session function.
 const render=()=>{const boundary=h.render();return boundary.type(boundary.props);};
 let t=render();assert.match(text(t),/1\. 디자인 선택/);assert.match(text(t),/3\. 미리보기·확인/);
 let detail=nodes(t,e=>e.type==='details'&&text(e.props.children[0]).includes('2. 세부 디자인 조정'))[0];assert(detail);assert(!detail.props.open);
 assert.match(text(detail.props.children[0]),/변경사항 있음/);assert.match(text(detail.props.children[0]),/저장 중/);
 const child=nodes(detail,e=>typeof e.props?.onSave==='function')[0];assert(child);assert.equal(child.props.value,composition.settings.textDesign);
 state.textStatus='error';state.layoutStatus='saved';t=render();assert.match(text(t),/저장 실패 — 재시도 필요/);
 assert(nodes(t,e=>e.props?.selectedPlacementId!==undefined&&e.props?.composition===composition).length);
});
test('registered Canva preview error remains in collapsed summary without losing selected template or retrying',async()=>{
 const before=global.fetch;let calls=0;global.fetch=async()=>{calls++;return{ok:false,json:async()=>({message:'입력 확인 실패'})};};
 try{const h=harness('src/components/design/article-canva-templates.tsx','ArticleCanvaTemplates',{projectSlug:'p',articleId:'a'});
 nodes(h.render(),e=>e.type==='select')[0].props.onChange({target:{value:'template-a'}});
 button(h.render(),'자동 입력 예정 확인').props.onClick();await new Promise(r=>setImmediate(r));const t=h.render();
 assert.match(text(nodes(t,e=>e.type==='summary')[0]),/입력 확인 실패/);assert.equal(nodes(t,e=>e.type==='select')[0].props.value,'template-a');h.render();assert.equal(calls,1);
 }finally{global.fetch=before;}
});
