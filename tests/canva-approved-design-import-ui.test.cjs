/* eslint-disable @typescript-eslint/no-require-imports -- Node/TSX UI harness with mocked HTTP responses. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server'),load=require('./canva-test-loader.cjs')();
const props={projectSlug:'fixture',articleId:'article',templateId:'event_festival_02',designId:'D123'};
function harness(respond){
 const states=[],effects=[],calls=[];let cursor=0,mounted=false;
 const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v;}];},useRef(initial){const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i];},useEffect(fn){if(!mounted)effects.push(fn);}};
 const fetch=async(url,options={})=>{const input=options.body?JSON.parse(options.body):{action:'get'};calls.push(input);return{ok:true,json:async()=>respond(input)};};
 const source=ts.transpileModule(fs.readFileSync('src/components/design/canva-png-import-controls.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const req=name=>name==='@/components/design/canva-article-apply-controls'?{CanvaArticleApplyControls:()=>null}:name==='react'?react:name==='./design-asset-options'?load('src/components/design/design-asset-options.ts'):require(name);
 const mod={exports:{}};vm.runInThisContext('(function(require,module,exports,fetch,setTimeout){'+source+'\n})')(req,mod,mod.exports,fetch,(fn,ms)=>setTimeout(fn,ms===2000?0:ms));
 return{calls,render(){cursor=0;const tree=mod.exports.CanvaPngImportControls(props);mounted=true;return tree;},mount(){effects.forEach(fn=>fn());}};
}
function find(t,p){if(!t||typeof t!=='object')return[];if(Array.isArray(t))return t.flatMap(x=>find(x,p));return[...(p(t)?[t]:[]),...find(t.props?.children,p)];}
const button=(t,label)=>find(t,x=>x.type==='button'&&x.props.children===label)[0], settle=()=>new Promise(r=>setTimeout(r,25));
const ready={enabled:true,approved:true,templateId:props.templateId,designId:props.designId,import:null};
test('approved state plus explicit type/click only; double click starts once; polling reaches ready/imported and never repeats export start',async()=>{
 let polls=0;const h=harness(input=>input.action==='get'?ready:{import:input.action==='start'?{status:'in_progress'}:++polls===1?{status:'ready'}:{status:'success',assetId:'asset',assetName:'Canva PNG'}});
 h.render();h.mount();await settle();assert.equal(h.calls.length,1);assert(button(h.render(),'앱으로 가져오기').props.disabled);
 find(h.render(),x=>x.type==='select')[0].props.onChange({target:{value:'card_frame'}});
 let tree=h.render();assert(!button(tree,'앱으로 가져오기').props.disabled);button(tree,'앱으로 가져오기').props.onClick();button(tree,'앱으로 가져오기').props.onClick();await settle();
 assert.deepEqual(h.calls.map(c=>c.action),['get','start','status','status']);assert.equal(h.calls[1].templateId,props.templateId);assert(renderToStaticMarkup(h.render()).includes('디자인을 앱 자산으로 가져왔습니다.'));assert(renderToStaticMarkup(h.render()).includes('아직 기사에 적용되지 않았습니다.'));
});
test('unapproved result cannot expose import; existing local approval requires explicit server reapproval',async()=>{
 const h=harness(input=>input.action==='approve'?{approved:true}: {...ready,approved:false,confirmation:'proof'});h.render();h.mount();await settle();assert(!button(h.render(),'앱으로 가져오기'));
 button(h.render(),'이 디자인 사용').props.onClick();await settle();assert.equal(h.calls.filter(c=>c.action==='approve').length,1);assert.equal(h.calls.filter(c=>c.action==='start').length,0);assert(button(h.render(),'앱으로 가져오기'));
});
test('unknown/failed import status never offers automatic retry; production-disabled response only offers guidance',async()=>{
 for(const status of ['unknown','sending','failed']){const h=harness(()=>({...ready,import:{status}}));h.render();h.mount();await settle();assert(!button(h.render(),'앱으로 가져오기'));assert.equal(h.calls.length,1);}
 const h=harness(()=>({enabled:false}));h.render();h.mount();await settle();assert(!button(h.render(),'앱으로 가져오기'));assert(renderToStaticMarkup(h.render()).includes('고정 Staging'));
});
