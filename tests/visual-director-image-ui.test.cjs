/* eslint-disable @typescript-eslint/no-require-imports -- Hook harness checks explicit UI events without API traffic. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const load=require('./canva-test-loader.cjs')(),{renderToStaticMarkup}=require('react-dom/server');
const article={title:'가을 문화와 계절의 감성',summary:'계절 분위기의 상징적인 개념 이미지로 생활정보를 전합니다.',body:'가을 계절 분위기와 상징으로 문화 이야기를 소개합니다. 생활정보를 위한 개념 배경을 함께 전달합니다.',articleType:'general',publicInfo:{},blocks:[],links:[]};
function harness(respond,e2e='enabled'){
 const states=[],calls=[];let cursor=0,mount=false;const effects=[];
 const hooks={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useRef(initial){const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i];},useEffect(fn){if(!mount)effects.push(fn);}};
 const source=ts.transpileModule(fs.readFileSync('src/components/design/visual-director-image-controls.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const req=n=>n==='react'?hooks:n==='next/image'?{__esModule:true,default:({unoptimized,...p})=>{void unoptimized;return React.createElement('img',p);}}:n==='./staging-e2e-status'?{useStagingE2E:()=>e2e,StagingE2ENotice:()=>React.createElement('p',null,'고정 Staging')}:n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):require(n);
 const mod={exports:{}};const fetch=async(url,options)=>{const input=JSON.parse(options.body);calls.push(input);return{ok:true,json:async()=>({ok:true,generationKey:'a'.repeat(64),specification:load('src/lib/visual-director-image-spec.ts').buildDirectorImageSpec(article),...await respond(input)})};};
 vm.runInThisContext('(function(require,module,exports,fetch,setTimeout){'+source+'\n})')(req,mod,mod.exports,fetch,fn=>setTimeout(fn,0));
 return{calls,render(p={}){cursor=0;const tree=mod.exports.VisualDirectorImageControls({article,articleId:'saved',projectSlug:'fixture',disabled:false,onBusy(){},...p});const rendered=tree&&typeof tree.type==='function'?tree.type(tree.props):tree;mount=true;return rendered;},mount(){effects.forEach(fn=>fn());}};
}
function find(t,p){if(!t||typeof t!=='object')return[];if(Array.isArray(t))return t.flatMap(x=>find(x,p));return[...(p(t)?[t]:[]),...find(t.props?.children,p)];}
const button=t=>find(t,e=>e.type==='button')[0],settle=()=>new Promise(r=>setTimeout(r,30));
test('AI-only execution UI: conceptual visible; real person, HTML and hybrid hidden; saved/staging gates',()=>{
 const h=harness(()=>({status:'ready'}));assert(renderToStaticMarkup(h.render()).includes('AI 이미지 생성'));assert(!button(h.render()).props.disabled);
 for(const a of [{...article,title:'김민수 시장 인터뷰',body:'실제 기관장 인터뷰 질문과 답변으로 주민 의견을 전합니다.'},{...article,urgency:'urgent'},{...article,title:'새 도서관 개관',body:'시설 외관 사진과 정보표로 실제 방문 100명과 200명을 비교합니다.'}])assert.equal(h.render({article:a}),null);
 assert(button(h.render({articleId:''})).props.disabled);const blocked=harness(()=>({status:'ready'}),'blocked');assert(button(blocked.render()).props.disabled);assert(renderToStaticMarkup(blocked.render()).includes('고정 Staging'));
});
test('explicit click only, double-click makes one generate call; success thumbnail/candidate, no automatic approval/apply',async()=>{
 const h=harness(p=>p.action==='director_prepare'?{status:'ready'}:{status:'success',asset:{id:'asset',name:'개념 이미지',previewHref:'/api/project-files/preview?designAssetId=asset'}});
 h.render();h.mount();assert.equal(h.calls.length,0);const b=button(h.render());b.props.onClick();b.props.onClick();await settle();assert.deepEqual(h.calls.map(c=>c.action),['director_prepare','director_generate']);const html=renderToStaticMarkup(h.render());assert(html.includes('자산으로 등록됨'));assert(html.includes('기사 적용 후보'));assert.equal(button(h.render()).props.children,'다른 시안 생성');assert(!h.calls.some(c=>c.action.includes('approve')));
});
test('in-progress uses status polling only; success reuse distinctly labeled',async()=>{
 const h=harness(p=>p.action==='director_prepare'?{status:'ready'}:p.action==='director_generate'?{status:'in_progress'}:{status:'success',duplicate:true,asset:{id:'asset',name:'기존',previewHref:'/api/project-files/preview?designAssetId=asset'}});
 h.render();h.mount();button(h.render()).props.onClick();await settle();assert.deepEqual(h.calls.map(c=>c.action),['director_prepare','director_generate','director_status']);assert(renderToStaticMarkup(h.render()).includes('기존 결과를 재사용했습니다.'));
});
test('unknown only requests status preparation, failed disabled; no second generate',async()=>{
 for(const status of ['unknown','failed']){const h=harness(()=>({status,message:'자동 재시도하지 않습니다.'}));h.render();h.mount();button(h.render()).props.onClick();await settle();assert.equal(h.calls.length,1);assert.equal(h.calls[0].action,'director_prepare');assert(button(h.render()).props.disabled===(status==='failed'));if(status==='unknown'){button(h.render()).props.onClick();await settle();assert(h.calls.every(c=>c.action==='director_prepare'));}}
});

test('explicit different variant click only after success; index increments once, double click suppressed',async()=>{
 const h=harness(p=>p.action==='director_prepare'?{status:'ready'}:{status:'success',asset:{id:'asset',name:'시안',previewHref:'/preview'}});
 h.render();h.mount();button(h.render()).props.onClick();await settle();assert.equal(h.calls.filter(c=>c.action==='director_generate').length,1);
 const next=button(h.render());assert.equal(next.props.children,'다른 시안 생성');next.props.onClick();next.props.onClick();await settle();
 assert.deepEqual(h.calls.map(c=>c.variantIndex??1),[1,1,2,2]);assert.equal(h.calls.filter(c=>c.action==='director_generate').length,2);
 assert(renderToStaticMarkup(h.render()).includes('스타일: 문화·계절형'));assert(renderToStaticMarkup(h.render()).includes('제목 여백: 상단'));
});
