/* eslint-disable @typescript-eslint/no-require-imports -- Isolated TSX action harness. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');
function harness(conflict=false){
 const states=[],calls=[];let cursor=0,refreshes=0;
 const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v;}];},useRef(initial){const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i];}};
 const fetch=async(url,options)=>{const input=JSON.parse(options.body);calls.push(input);return{ok:!(conflict&&input.action==='revoke'),status:conflict?409:200,json:async()=>input.action==='snapshot'?{snapshot:'b'.repeat(32),assetId:'asset',applied:true}:{applied:input.action==='apply'}};};
 const source=ts.transpileModule(fs.readFileSync('src/components/design/canva-article-apply-controls.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const req=name=>name==='react'?react:name==='next/navigation'?{useRouter:()=>({refresh(){refreshes++;}})}:require(name);
 const mod={exports:{}};vm.runInThisContext('(function(require,module,exports,fetch){'+source+'\n})')(req,mod,mod.exports,fetch);
 return{calls,get refreshes(){return refreshes;},render(){cursor=0;return mod.exports.CanvaArticleApplyControls({projectSlug:'fixture',articleId:'article',assetId:'asset',templateId:'event_festival_02'});}};
}
function find(t,label){if(!t||typeof t!=='object')return null;if(Array.isArray(t))return t.map(x=>find(x,label)).find(Boolean);if(t.type==='button'&&t.props.children===label)return t;return find(t.props?.children,label);}
const settle=()=>new Promise(r=>setTimeout(r,5));
test('explicit apply only, double click is blocked, snapshot used, rerender retains state; revoke removes connection only',async()=>{
 const h=harness(),initial=h.render();assert.equal(h.calls.length,0);find(initial,'기사에 적용').props.onClick();find(initial,'기사에 적용').props.onClick();await settle();
 assert.deepEqual(h.calls.map(c=>c.action),['snapshot','apply']);assert.equal(h.calls[1].expected,'b'.repeat(32));assert.equal(h.refreshes,1);assert(renderToStaticMarkup(h.render()).includes('기사에 적용되었습니다.'));assert(find(h.render(),'적용 취소'));
 find(h.render(),'적용 취소').props.onClick();await settle();assert.deepEqual(h.calls.map(c=>c.action),['snapshot','apply','snapshot','revoke']);assert(!find(h.render(),'적용 취소'));assert(renderToStaticMarkup(h.render()).includes('적용을 취소했습니다.'));
});
test('stale revoke does not retry or clear applied result and explains conflict',async()=>{
 const h=harness(true);find(h.render(),'기사에 적용').props.onClick();await settle();find(h.render(),'적용 취소').props.onClick();await settle();assert.equal(h.calls.filter(c=>c.action==='revoke').length,1);assert.equal(h.refreshes,1);assert(find(h.render(),'적용 취소'));assert(renderToStaticMarkup(h.render()).includes('자동 취소할 수 없습니다.'));
});
