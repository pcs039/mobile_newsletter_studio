/* eslint-disable @typescript-eslint/no-require-imports -- isolated UI/metadata tests; no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const loader=require('./canva-test-loader.cjs'),api=loader()('src/lib/font-library-list.ts');
const base={id:'a',familyId:'f',familyDisplayName:'나눔고딕',family:'Nanum Gothic',name:'나눔고딕',sourceFileName:'Nanum.ttf',cssFamily:'Nanum',fileFormat:'ttf',filePath:'Nanum.ttf',weight:'400',style:'normal',isActive:true,webfontAllowed:true,familyIsActive:true,familyWebfontAllowed:true,fileUrl:'/f.ttf',created:'26-10-01 12:00'};
const nodes=(t,p)=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(x=>nodes(x,p)):[...(p(t)?[t]:[]),...nodes(t.props?.children,p)];
test('database identity groups formats/faces, preserving similarly named families and legacy IDs',()=>{
 const fonts=[base,{...base,id:'bold',weight:'700',fileFormat:'otf',created:'26-10-02 09:00'},{...base,id:'other',familyId:'other'},{...base,id:'legacy',familyId:''}];const snapshot=JSON.stringify(fonts);const groups=api.groupFontLibrary(fonts);assert.equal(groups.length,3);const g=groups.find(g=>g.id==='family:f');assert.equal(g.fonts.length,2);assert.equal(g.available,2);assert.equal(g.created,'26-10-02 09:00');assert.equal(JSON.stringify(fonts),snapshot);
});
test('Korean/English/file partial search, mixed active status and deterministic latest registration sorting',()=>{
 const groups=api.groupFontLibrary([base,{...base,id:'off',familyId:'off',isActive:false,created:'26-10-03 12:00'},{...base,id:'blocked',familyId:'blocked',familyIsActive:false}]);
 for(const query of ['나눔','NANUM GOTHIC','Nanum.ttf'])assert.equal(api.filterFontLibrary(groups,query,'all','name').length,3);
 assert.equal(api.filterFontLibrary(groups,'','active','name').length,1);assert.equal(api.filterFontLibrary(groups,'','inactive','name').length,2);assert.equal(api.filterFontLibrary(groups,'','all','recent')[0].id,'family:off');assert.equal(api.filterFontLibrary(groups,'없는글꼴','all','name').length,0);
});
function harness(fonts){let i=0,calls=0;const states=[];const UI=loader({react:{...React,useMemo:fn=>fn(),useState(v){const n=i++;if(!(n in states))states[n]=v;return[states[n],v=>states[n]=v];}}})('src/components/font-library-list.tsx').FontLibraryList;return{render(){i=0;return UI({fonts,updatingFontId:'',onAssetActive:()=>calls++,onFamilyActive:()=>calls++});},calls:()=>calls};}
test('600 families paginate without mutations; searching resets page, files remain mounted in closed details',()=>{
 const h=harness(Array.from({length:600},(_,i)=>({...base,id:String(i),familyId:String(i),familyDisplayName:'패밀리 '+i})));let t=h.render();assert.equal(nodes(t,e=>e.type==='article').length,20);assert(nodes(t,e=>e.type==='details').every(e=>e.props.open===undefined));const first=nodes(t,e=>e.type==='article')[0].key;nodes(t,e=>e.type==='button'&&e.props.children==='다음')[0].props.onClick();t=h.render();assert.notEqual(nodes(t,e=>e.type==='article')[0].key,first);nodes(t,e=>e.props.type==='search')[0].props.onChange({target:{value:'패밀리 599'}});t=h.render();assert.equal(nodes(t,e=>e.type==='article').length,1);assert.equal(h.calls(),0);assert.match(JSON.stringify(t),/비활성화는 기존 발행본/);
});
test('empty filter and disallowed family remain explicit with unchanged state-management callbacks',()=>{
 const h=harness([{...base,familyWebfontAllowed:false}]);let t=h.render();assert(nodes(t,e=>e.type==='button')[0].props.disabled);nodes(t,e=>e.type==='select')[0].props.onChange({target:{value:'active'}});t=h.render();assert.match(JSON.stringify(t),/검색 조건에 맞는/);assert.equal(h.calls(),0);
});
