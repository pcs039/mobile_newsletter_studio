/* eslint-disable @typescript-eslint/no-require-imports -- Isolated UI/FontFace harness; no remote mutation. */
const test = require('node:test'), assert = require('node:assert/strict');
const loader = require('./canva-test-loader.cjs');
const api = loader()('src/lib/font-picker.ts');
const base = {familyId:'nanum', familyDisplayName:'나눔고딕', family:'Nanum Gothic', name:'Nanum Gothic Regular', cssFamily:'Nanum', weight:'400', style:'normal', isActive:true, webfontAllowed:true, familyIsActive:true, familyWebfontAllowed:true, fileUrl:'/font.ttf', fileFormat:'ttf', sourceFileName:'NanumGothic.ttf'};
const fonts = [{...base,id:'regular'}, {...base,id:'bold',weight:'700'}, {...base,id:'otf',fileFormat:'otf'}];
const nodes = (tree, pred) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(t=>nodes(t,pred)) : [...(pred(tree)?[tree]:[]),...nodes(tree.props?.children,pred)];
function harness(props) {
 const states=[],effects=[]; let cursor=0;
 const component = loader({'react':{useId:()=> 'font',useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v];},useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)}})('src/components/searchable-font-select.tsx').SearchableFontSelect;
 return {effects, render(){cursor=0;return component({fonts,label:'제목 글꼴',name:'titleFontAssetId',inheritLabel:'기본값',...props});}};
}
test('database family groups formats and faces, never similarly named families/standalone',()=>{
 const groups=api.getFontPickerFamilies([...fonts,{...base,id:'different',familyId:'different'},{...base,id:'legacy',familyId:''}]);
 assert.equal(groups.length,3);assert.equal(groups.find(g=>g.id==='family:nanum').fonts.length,3);
 assert.equal(groups.find(g=>g.id==='family:nanum').representativeId,'regular');
 assert.deepEqual(Array.from(api.getFontPickerFaces(groups.find(g=>g.id==='family:nanum'))),['400 / normal','700 / normal']);
});
test('Korean/English partial name, NFC, whitespace and no results',()=>{
 const groups=api.getFontPickerFamilies(fonts);
 for(const q of ['나눔','GOTHIC','nanumgothic','나눔'])assert.equal(api.searchFontPickerFamilies(groups,q).length,1);
 assert.equal(api.searchFontPickerFamilies(groups,'없는폰트').length,0);
});
test('inactive / disallowed asset or family excluded; project defaults prioritized via any member',()=>{
 const groups=api.getFontPickerFamilies([...fonts,{...base,id:'inactive',familyId:'inactive',isActive:false},{...base,id:'forbidden',familyId:'no',familyWebfontAllowed:false},{...base,id:'other',familyId:'other',familyDisplayName:'AAA'}],['bold']);
 assert.equal(groups.length,2);assert.equal(groups[0].id,'family:nanum');
});
test('600 families search deterministically and UI limits results, with explicit pagination',()=>{
 const many=Array.from({length:600},(_,i)=>({...base,id:String(i),familyId:String(i),familyDisplayName:`패밀리 ${i}`}));
 const before=JSON.stringify(many), groups=api.getFontPickerFamilies(many);
 assert.equal(groups.length,600);assert.equal(JSON.stringify(groups),JSON.stringify(api.getFontPickerFamilies(many)));assert.equal(JSON.stringify(many),before);
 const h=harness({fonts:many});let tree=h.render();assert.equal(nodes(tree,e=>e.type==='option').length,21);
 const firstIds=nodes(tree,e=>e.type==='option').map(e=>e.props.value);
 nodes(tree,e=>e.type==='button'&&e.props.children==='다음 패밀리')[0].props.onClick();assert.equal(nodes(h.render(),e=>e.type==='option').length,21);assert.notDeepEqual(nodes(h.render(),e=>e.type==='option').map(e=>e.props.value),firstIds);
 nodes(h.render(),e=>e.type==='button'&&e.props.children==='이전 패밀리')[0].props.onClick();assert.deepEqual(nodes(h.render(),e=>e.type==='option').map(e=>e.props.value),firstIds);
});
test('legacy Bold ID preserved through search; explicit family choice saves representative; inheritance empty',()=>{
 const h=harness({defaultValue:'bold'});let tree=h.render();
 const saved=()=>nodes(h.render(),e=>e.type==='input'&&e.props.type==='hidden')[0].props.value;
 assert.equal(saved(),'bold');
 nodes(tree,e=>e.type==='input'&&e.props.type==='search')[0].props.onChange({target:{value:'no results'}});
 assert.equal(saved(),'bold');assert.match(JSON.stringify(h.render()),/검색 결과가 없습니다/);
 nodes(h.render(),e=>e.type==='select')[0].props.onChange({target:{value:'regular'}});assert.equal(saved(),'regular');
 nodes(h.render(),e=>e.type==='button')[0].props.onClick();assert.equal(saved(),'');
});
test('unavailable stored ID retained and warning, independent title/body state',()=>{
 const a=harness({defaultValue:'removed'}),b=harness({defaultValue:'bold',name:'bodyFontAssetId'});
 assert.match(JSON.stringify(a.render()),/사용 불가/);assert.equal(nodes(a.render(),e=>e.props.name==='titleFontAssetId')[0].props.value,'removed');
 assert.equal(nodes(b.render(),e=>e.props.name==='bodyFontAssetId')[0].props.value,'bold');
});
test('preview uses real @font-face and FontFaceSet, failure indicated; cleanup ignores late response',async()=>{
 const old=global.document;let reject,descriptor;
 global.document={fonts:{load(d){descriptor=d;return new Promise((_r,j)=>reject=j);}}};
 try{const h=harness({defaultValue:'regular'});const tree=h.render();assert.match(nodes(tree,e=>e.type==='style')[0].props.children,/@font-face/);
 const cleanup=h.effects[0]();assert.match(descriptor,/400 20px "Nanum"/);reject(Error('offline'));await new Promise(r=>setImmediate(r));
 assert.match(JSON.stringify(h.render()),/不可能|불러오지 못했습니다/);cleanup();
 }finally{global.document=old;}
});
test('preview unload cancels late failure without overwriting current state',async()=>{
 const old=global.document;let reject;global.document={fonts:{load(){return new Promise((_r,j)=>reject=j);}}};
 try{const h=harness({defaultValue:'regular'});h.render();const cleanup=h.effects[0]();cleanup();reject(Error('late'));await new Promise(r=>setImmediate(r));assert.doesNotMatch(JSON.stringify(h.render()),/불러오지 못했습니다/);}finally{global.document=old;}
});
test('keyboard selection remains highlighted; Enter in search/results does not submit article',()=>{
 const h=harness({defaultValue:'bold'});let tree=h.render();
 assert.equal(nodes(tree,e=>e.type==='select')[0].props.value,'regular');
 let prevented=0;
 for(const node of nodes(tree,e=>e.type==='select'||e.props.type==='search'))node.props.onKeyDown({key:'Enter',preventDefault(){prevented++;}});
 assert.equal(prevented,2);
});
test('article transition remount isolates field state; reader CSS contract unchanged',()=>{
 const fs=require('node:fs');const page=fs.readFileSync('src/app/projects/[projectId]/reading/page.tsx','utf8');assert(page.includes('key={selectedArticle?.id ?? "new"}'));
 const css=loader()('src/lib/font-css.ts');assert.equal(css.getFontAssetById(fonts,'bold').cssFamily,'Nanum');assert.match(css.getFontFaceCss(fonts),/font-weight: 700/);
 assert.equal(css.getFontAssetById([{...base,id:'off',isActive:false}],'off'),null);
});
test('compact mode preserves one named input, starts closed and keeps choice through collapse',()=>{
 let changed;const h=harness({compact:true,form:'article-editor-a',defaultValue:'bold',onValueChange:v=>changed=v});let t=h.render();
 assert.equal(nodes(t,e=>e.type==='input'&&e.props.name==='titleFontAssetId').length,1);assert.equal(nodes(t,e=>e.props.name==='titleFontAssetId')[0].props.form,'article-editor-a');assert.equal(nodes(t,e=>e.type==='details')[0].props.open,undefined);
 nodes(t,e=>e.type==='select')[0].props.onChange({target:{value:'regular'}});assert.equal(changed,'regular');t=h.render();nodes(t,e=>e.type==='details')[0].props.onToggle({currentTarget:{open:false}});
 assert.equal(nodes(h.render(),e=>e.props.name==='titleFontAssetId')[0].props.value,'regular');
});

test('family browsing and registration styles never imply a CSS weight change or write',()=>{
 let changes=[];const h=harness({defaultValue:'bold',onValueChange:v=>changes.push(v)});let t=h.render();assert.match(JSON.stringify(t),/기사 CSS 굵기를 변경하지는/);assert.match(JSON.stringify(t),/400 \/ normal/);assert.equal(nodes(t,e=>e.type==='input'&&e.props.type==='hidden')[0].props.value,'bold');assert.equal(changes.length,0);
 nodes(t,e=>e.props.type==='search')[0].props.onChange({target:{value:'나눔'}});assert.equal(changes.length,0);assert.equal(nodes(h.render(),e=>e.type==='input'&&e.props.type==='hidden')[0].props.value,'bold');
});
