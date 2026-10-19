/* eslint-disable @typescript-eslint/no-require-imports -- UI event harness, no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const loader=require('./canva-test-loader.cjs');
const {renderToStaticMarkup}=require('react-dom/server');
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(t=>nodes(t,predicate));return[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
const settle=()=>new Promise(resolve=>setTimeout(resolve,40));
function harness(respond){
 const states=[];let cursor=0;const calls=[],originalFetch=global.fetch;
 const hooks={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useRef(initial){const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i];}};
 const component=loader({'react':hooks,'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/font-batch':{MAX_BATCH_FONT_BYTES:16*1024*1024,normalizeFontPath:p=>p.replace(/\\/g,'/'),fontFormat:p=>/\.ttf$/.test(p)?'ttf':null,classifyFont:(_b,p)=>({family:p.split('.')[0],weight:'400',style:'normal',format:'ttf',version:'1',needsConfirmation:false,reason:'확인'}),defaultFontSelection:fonts=>new Set(fonts.map((_,i)=>i))}})('src/components/font-batch-upload.tsx').FontBatchUpload;
 global.fetch=async(url,options)=>{const input=url==='/api/font-batch'?JSON.parse(options.body):{action:'storage'};calls.push(input);const result=await respond(input);return {ok:result.ok!==false,json:async()=>result};};
 return{calls,render(){cursor=0;return component();},close(){global.fetch=originalFetch;}};
}
function register(tree){return nodes(tree,e=>e.type==='button')[0];}
async function choose(h,names){const tree=h.render(),input=nodes(tree,e=>e.type==='input'&&e.props['aria-label']==='폰트 파일 선택')[0];input.props.onChange({target:{files:names.map(n=>new File(['font-'+n],n))}});await settle();}
test('file/folder selection has multi-file fallback and no automatic registration',async()=>{
 const h=harness(()=>({ok:true}));try{const inputs=nodes(h.render(),e=>e.type==='input');assert(inputs.filter(e=>e.props.type==='file').every(e=>e.props.multiple));assert(inputs.some(e=>Object.hasOwn(e.props,'webkitdirectory')));await choose(h,['A.ttf','B.ttf','ignored.zip']);assert.equal(h.calls.length,0);assert.match(JSON.stringify(h.render()),/등록 대상/);}finally{h.close();}
});
test('one explicit click, double click suppressed; created asset and duplicate reuse messages distinct',async()=>{
 for(const duplicate of [false,true]){
  const h=harness(input=>input.action==='prepare'?duplicate?{ok:true,status:'success',duplicate:true,assetId:'existing'}:{ok:true,status:'ready',token:'signed',uploadUrl:'https://staging.example/signed'}:input.action==='storage'?{ok:true}:{ok:true,status:'success',assetId:'asset'});
  try{await choose(h,['A.ttf']);const b=register(h.render());assert.equal(b.props.disabled,false);b.props.onClick();b.props.onClick();await settle();assert.equal(h.calls.filter(c=>c.action==='prepare').length,1);assert.equal(h.calls.filter(c=>c.action==='storage').length,duplicate?0:1);assert.match(JSON.stringify(h.render()),duplicate?/기존 등록 파일 재사용/:/등록 완료/);assert(register(h.render()).props.disabled);}finally{h.close();}
 }
});
test('partial failure preserves success and retries completion first with no second upload',async()=>{
 let completes=0;
 const h=harness(input=>input.action==='prepare'?{ok:true,status:'ready',token:'signed-'+input.name,uploadUrl:'https://staging.example/signed'}:input.action==='storage'?{ok:true}:++completes===1?{ok:false,message:'응답 유실'}:{ok:true,status:'success',assetId:'asset'});
 try{await choose(h,['A.ttf','B.ttf']);register(h.render()).props.onClick();await settle();assert.match(JSON.stringify(h.render()),/응답 유실/);assert.equal(h.calls.filter(c=>c.action==='storage').length,2);register(h.render()).props.onClick();await settle();assert.equal(h.calls.filter(c=>c.action==='storage').length,2);assert.equal(h.calls.filter(c=>c.action==='prepare').length,2);assert(register(h.render()).props.disabled);}finally{h.close();}
});
test('article editor receives the existing font library and project defaults',()=>{
 const page=fs.readFileSync('src/app/projects/[projectId]/reading/page.tsx','utf8');
 const props=page.slice(page.indexOf('<ProjectArticleEditorForm'),page.indexOf('/>',page.indexOf('<ProjectArticleEditorForm')));
 for(const prop of ['fonts={fontData.fonts}','projectTitleFontAssetId={project?.titleFontAssetId}','projectBodyFontAssetId={project?.bodyFontAssetId}'])assert(props.includes(prop));
 const css=loader()('src/lib/font-css.ts');const base={isActive:true,webfontAllowed:true,fileUrl:'/font',familyId:'family',familyIsActive:true,familyWebfontAllowed:true,name:'Nanum',cssFamily:'Test',fileFormat:'ttf',style:'normal'};
 const fonts=[{...base,id:'regular',weight:'400'},{...base,id:'bold',weight:'700'}];
 assert.equal(css.getSelectableFontAssets(fonts).length,1);const faces=css.getFontFaceCss(fonts);assert(faces.includes('font-weight: 400'));assert(faces.includes('font-weight: 700'));
});
test('more than 500 files explicitly show unprocessed count, including after registration',async()=>{
 const h=harness(()=>({ok:true,status:'success',duplicate:true,assetId:'existing'}));
 try{
  await choose(h,['A.ttf',...Array.from({length:501},(_,i)=>`ignored-${i}.zip`)]);
  const alert=()=>nodes(h.render(),e=>e.props?.role==='alert')[0];
  assert.match(renderToStaticMarkup(alert()),/처음 500개/);
  assert.match(renderToStaticMarkup(alert()),/나머지 2개 파일/);
  register(h.render()).props.onClick();await settle();assert.equal(h.calls.length,1);
  assert.match(renderToStaticMarkup(alert()),/나머지 2개 파일/);
  await choose(h,['A.ttf']);assert.equal(alert(),undefined);
 }finally{h.close();}
});
test('over 16MiB is excluded with reason before reading or uploading',async()=>{
 const h=harness(()=>({ok:true}));let reads=0;
 try{
  const input=nodes(h.render(),e=>e.type==='input'&&e.props['aria-label']==='폰트 파일 선택')[0];
  input.props.onChange({target:{files:[{name:'too-large.ttf',size:16*1024*1024+1,arrayBuffer(){reads++;throw Error('must not read');}}]}});
  await settle();assert.equal(reads,0);assert.match(JSON.stringify(h.render()),/파일당 16MiB를 초과합니다/);
  assert(register(h.render()).props.disabled);assert.equal(h.calls.length,0);
 }finally{h.close();}
});
