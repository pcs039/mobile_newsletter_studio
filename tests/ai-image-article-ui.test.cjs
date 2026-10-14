/* eslint-disable @typescript-eslint/no-require-imports -- Hook harness; no remote calls or writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const {renderToStaticMarkup}=require('react-dom/server');
function harness(options={}){
 const states=[],effects=[],calls=[];let cursor=0,mounted=false,refresh=0;
 const hooks={useState(v){const i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useRef(v){const i=cursor++;if(!(i in states))states[i]={current:v};return states[i];},useEffect(fn){if(!mounted)effects.push(fn);}};
 const state={snapshot:'a'.repeat(32),conflict:false,connections:[],candidates:[{id:'asset1',name:'개념 이미지 시안 1',previewHref:'/mock.png',approvalStatus:'approved',generationKey:'b'.repeat(64),variantIndex:1,styleLabel:'문화·계절형',aspectRatio:'4:5',stale:false},{id:'asset2',name:'개념 이미지 시안 2',previewHref:'/mock.png',approvalStatus:'approved',generationKey:'c'.repeat(64),variantIndex:2,styleLabel:'문화·계절형',aspectRatio:'4:5',stale:false}],...options};
 const fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);if(p.action==='apply')state.connections=[{assetId:p.assetId,role:p.role,blockId:'managed'}];if(p.action==='revoke')state.connections=[];return{ok:true,json:async()=>({ok:true,...(p.action==='state'?structuredClone(state):{state:structuredClone(state),applied:p.action==='apply',duplicate:!!options.duplicate})})};};
 const source=ts.transpileModule(fs.readFileSync('src/components/design/ai-image-article-controls.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const req=n=>n==='react'?hooks:n==='next/navigation'?{useRouter:()=>({refresh(){refresh++;}})}:n==='next/image'?{__esModule:true,default:({unoptimized,...p})=>{void unoptimized;return React.createElement('img',p);}}:n==='./staging-e2e-status'?{useStagingE2E:()=> 'enabled'}:require(n);
 const mod={exports:{}};vm.runInThisContext('(function(require,module,exports,fetch,window){'+source+'\n})')(req,mod,mod.exports,fetch,{confirm:()=>true});
 return{calls,state,get refresh(){return refresh;},render(){cursor=0;const result=mod.exports.AiImageArticleControls({articleId:'article',projectSlug:'fixture',revision:'v1'});mounted=true;return result;},async mount(){this.render();effects.forEach(fn=>fn());await settle();return this.render();}};
}
const settle=()=>new Promise(r=>setTimeout(r,10));
function find(tree,label){if(!tree||typeof tree!=='object')return null;if(Array.isArray(tree))return tree.map(t=>find(t,label)).find(Boolean);if(tree.type==='button'&&renderToStaticMarkup(tree).includes(label))return tree;return find(tree.props?.children,label);}
test('explicit hero apply only, double click one mutation, state and revoke separate from generation/approval',async()=>{
 const h=harness();let tree=await h.mount();assert.deepEqual(h.calls.map(p=>p.action),['state']);assert(renderToStaticMarkup(tree).includes('아직 기사에는 적용되지 않았습니다.'));
 const click=find(tree,'대표 이미지로 적용').props.onClick;click();click();await settle();tree=h.render();assert.equal(h.calls.filter(p=>p.action==='apply').length,1);assert.equal(h.calls[1].expected,'a'.repeat(32));assert(renderToStaticMarkup(tree).includes('대표 이미지로 적용됨'));assert.equal(h.refresh,1);
 assert(find(tree,'대표 이미지 적용 확인'));find(tree,'대표 이미지 적용 해제').props.onClick();await settle();assert.equal(h.calls.filter(p=>p.action==='revoke').length,1);assert(renderToStaticMarkup(h.render()).includes('원본 자산은 유지됩니다.'));assert(h.calls.every(p=>['state','apply','revoke'].includes(p.action)));
});
test('draft, stale source and Canva conflict disable apply; reconfirmation is explicit',async()=>{
 for(const patch of [{conflict:true},{candidates:[{id:'draft',approvalStatus:'draft'}]},{candidates:[{id:'old',approvalStatus:'approved',stale:true}]}]){const h=harness(patch),tree=await h.mount();assert(find(tree,'대표 이미지로 적용').props.disabled);assert.equal(h.calls.filter(p=>p.action==='apply').length,0);}
});
test('single variant selection, independent replace and body insertion, existing result reuse wording',async()=>{
 const h=harness({duplicate:true,connections:[{assetId:'asset1',role:'hero',blockId:'hero'}]});let tree=await h.mount();find(tree,'시안 2').props.onClick();tree=h.render();assert(find(tree,'이 시안으로 교체'));find(tree,'이 시안으로 교체').props.onClick();await settle();assert.equal(h.calls.at(-1).assetId,'asset2');assert(renderToStaticMarkup(h.render()).includes('기존 기사 적용 상태를 재사용했습니다.'));
 find(h.render(),'본문 이미지로 삽입').props.onClick();await settle();assert.equal(h.calls.at(-1).role,'body');assert(find(h.render(),'본문 이미지 적용 해제'));
});
