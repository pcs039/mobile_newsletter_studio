/* eslint-disable @typescript-eslint/no-require-imports -- isolated UI/API contracts; no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const loader=require('./canva-test-loader.cjs'),load=loader();
const {institutionAssetPlacementSlots}=load('src/lib/institution-asset-placement.ts');
const project='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const asset=(patch={})=>({id,projectId:project,name:'기관 테스트 사진',assetType:'illustration',approvalStatus:'draft',isActive:true,metadata:{source:'institution'},mimeType:'image/png',storageBucket:'design-production-assets',previewHref:'/api/project-files/preview?test',...patch});
const comp=(assets=[])=>({id:'c',projectId:project,articleId:'article-a',settings:{},assets});
const nodes=(t,p)=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(x=>nodes(x,p)):[...(p(t)?[t]:[]),...nodes(t.props?.children,p)];
const text=t=>t==null||typeof t==='boolean'?'':typeof t!=='object'?String(t):Array.isArray(t)?t.map(text).join(''):text(t.props?.children);
const button=(t,s)=>nodes(t,e=>e.type==='button'&&text(e)===s)[0];
function harness(props={}){let i=0;const states=[];const hooks={...React,useState(v){const n=i++;if(!(n in states))states[n]=typeof v==='function'?v():v;return[states[n],v=>states[n]=typeof v==='function'?v(states[n]):v];},useRef(v){const n=i++;return states[n]??(states[n]={current:v});},useEffect:()=>{}};
 const UI=loader({react:hooks})('src/components/design/institution-asset-placement-confirm.tsx').InstitutionAssetPlacementConfirm;
 let current={assetId:id,assets:[asset()],composition:comp(),disabled:false,onApply:async()=>true,onClose:()=>{},...props};
 return{render(){i=0;return UI(current);},update(p){current={...current,...p};}};
}
const select=(h,value='hero_illustration')=>nodes(h.render(),e=>e.type==='select')[0].props.onChange({target:{value}});
const tick=()=>new Promise(r=>setImmediate(r));
test('same ID supports Draft and Approved only in existing compatible public slots',()=>{
 for(const approvalStatus of ['draft','approved'])assert.deepEqual(institutionAssetPlacementSlots(asset({approvalStatus}),project),['hero_illustration']);
 for(const assetType of ['background','pattern'])assert.deepEqual(institutionAssetPlacementSlots(asset({assetType}),project),['hero_background']);
 for(const patch of [{projectId:other},{isActive:false},{approvalStatus:'archived'},{assetType:'logo'},{assetType:'source_design'},{assetType:'reference'},{assetType:'card_frame'},{assetType:'banner'},{assetType:'icon'},{mimeType:'application/pdf'},{mimeType:'image/svg+xml'},{metadata:{source:'openai'}},{storageBucket:'design-intake-assets'},{name:'기관 사진 사용 금지'},{usageNote:'폐기'}])assert.deepEqual(institutionAssetPlacementSlots(asset(patch),project),[],JSON.stringify(patch));
});
test('candidate and location selection do not write; explicit apply once, double click guarded',async()=>{
 let calls=0,resolve;const h=harness({onApply:async(slot,assetId)=>{calls++;assert.equal(slot,'hero_illustration');assert.equal(assetId,id);return new Promise(r=>resolve=r);}});
 assert(button(h.render(),'확인한 위치에 적용').props.disabled);select(h);assert.equal(calls,0);let t=h.render();assert.match(text(t),/Draft · 미승인/);
 button(t,'확인한 위치에 적용').props.onClick();button(t,'확인한 위치에 적용').props.onClick();assert.equal(calls,1);assert.match(text(h.render()),/배치를 저장/);
 resolve(true);await tick();h.update({composition:comp([{id:'p',assetId:id,slot:'hero_illustration'}])});t=h.render();assert(button(t,'확인한 위치에 적용').props.disabled);assert.match(text(t),/새로 저장하지 않습니다/);button(t,'확인한 위치에 적용').props.onClick();assert.equal(calls,1);
});
test('existing other asset requires replacement confirmation and retains file',async()=>{
 let calls=0;const h=harness({assets:[asset(),asset({id:other,name:'기존 사진'})],composition:comp([{assetId:other,slot:'hero_illustration'}]),onApply:async()=>{calls++;return true;}});select(h);let t=h.render();assert.match(text(t),/기존 사진/);assert.match(text(t),/파일은 유지/);assert(button(t,'확인한 위치에 적용').props.disabled);
 button(t,'확인한 위치에 적용').props.onClick();assert.equal(calls,0);nodes(t,e=>e.type==='input')[0].props.onChange({target:{checked:true}});t=h.render();assert(!button(t,'확인한 위치에 적용').props.disabled);button(t,'확인한 위치에 적용').props.onClick();await tick();assert.equal(calls,1);
});
test('stale eligibility, unsupported slot, unsaved/saving block; failed save keeps choice with no retry',async()=>{
 let calls=0;const h=harness({onApply:async()=>{calls++;return false;}});select(h,'footer_banner');assert(button(h.render(),'확인한 위치에 적용').props.disabled);select(h);h.update({disabled:true});button(h.render(),'확인한 위치에 적용').props.onClick();assert.equal(calls,0);
 h.update({disabled:false,assets:[asset({isActive:false})]});assert(!button(h.render(),'확인한 위치에 적용'));h.update({assets:[asset()]});button(h.render(),'확인한 위치에 적용').props.onClick();await tick();let t=h.render();assert.match(text(t),/자동 재시도하지 않/);assert.equal(nodes(t,e=>e.type==='select')[0].props.value,'hero_illustration');assert(button(t,'확인한 위치에 적용').props.disabled);button(t,'확인한 위치에 적용').props.onClick();h.render();assert.equal(calls,1);
});
test('candidate response keeps original design asset ID; unsupported reference is not silently converted',()=>{
 const server=load('src/lib/institution-asset-recommendation.ts');const article={title:'김민수 시장 인터뷰',summary:'실제 기관장 인터뷰',body:'김민수 시장의 인터뷰와 질문 답변입니다.',articleType:'general',publicInfo:{},blocks:[]};
 const a=asset({name:'김민수 시장 인물 사진',altText:'김민수 시장 인물 사진',usageNote:'기관 제공 인물 사진',language:'ko',variant:'primary',storagePath:'original.png'});
 const r=server.prepareInstitutionAssetRecommendation(article,id,[a],project);assert.equal(r.candidates[0].assetId,id);assert.equal(institutionAssetPlacementSlots(a,project)[0],'hero_illustration');assert.deepEqual(institutionAssetPlacementSlots({...a,assetType:'reference',storageBucket:'design-intake-assets'},project),[]);
});
test('existing POST receives the same ID, permits Draft/Approved, rejects ownership/active/type, reuses replacement row',async()=>{
 let current=asset(),saved=[],composition=comp(),allowed=true;
 const route=loader({
  '@/lib/project-api-access':{requireProjectApiAccess:async()=>allowed?{ok:true,project:{id:project,slug:'p'}}:{ok:false,response:new Response(null,{status:403})}},
  '@/lib/newsletter-repository':{getProjectContent:async()=>({articles:[{id:'article-a'}]}),getProjectDesignAssets:async()=>({ok:true,assets:[current]})},
  '@/lib/article-composition-repository':{getProjectArticleComposition:async()=>({status:'ok',data:composition}),saveProjectArticleCompositionPlacement:async p=>{saved.push(p);return{status:'ok',data:composition};}},
 })('src/app/api/project-article-composition/route.ts');
 const req=(slot='hero_illustration')=>new Request('http://app.test/api/project-article-composition',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add_placement',projectSlug:'p',articleId:'article-a',compositionId:'c',assetId:id,slot,settings:{fit:'contain',scale:1},sortOrder:0,isVisible:true})});
 for(const approvalStatus of ['draft','approved']){current=asset({approvalStatus});assert.equal((await route.POST(req())).status,201);assert.equal(saved.at(-1).assetId,id);}
 composition=comp([{id:'existing-placement',assetId:other,slot:'hero_illustration'}]);assert.equal((await route.POST(req())).status,200);assert.equal(saved.at(-1).placementId,'existing-placement');
 const count=saved.length;for(const patch of [{projectId:other},{isActive:false},{approvalStatus:'archived'},{assetType:'logo'},{assetType:'source_design'},{assetType:'background'}]){current=asset(patch);assert.equal((await route.POST(req())).status,400);assert.equal(saved.length,count);}
 current=asset();assert.equal((await route.POST(req('hero_background'))).status,400);allowed=false;assert.equal((await route.POST(req())).status,403);assert.equal(saved.length,count);
});
test('recommended candidate selection and placement request are distinct; ineligible IDs get no placement action',()=>{
 const rows=[{assetId:id,name:'웹용 사진',approvalStatus:'draft',kind:'real_person_photo',score:1,reasons:[],warnings:[]}];
 const result={candidates:rows,status:'strong_match'};let i=0,calls=[],states=[result,'',false,null,0];
 const hooks={...React,useState(v){const n=i++;if(!(n in states))states[n]=v;return[states[n],v=>states[n]=typeof v==='function'?v(states[n]):v];},useRef:v=>({current:v}),useEffect:()=>{}};
 const UI=loader({react:hooks})('src/components/design/institution-asset-match-controls.tsx').InstitutionAssetMatchControls;
 const props={article:{title:'김민수 시장 인터뷰',summary:'실제 기관장 인터뷰',body:'시장 인터뷰 질문과 답변',articleType:'general',publicInfo:{},blocks:[]},articleId:id,projectSlug:'p',disabled:false,institutionPlacement:{assetIds:[id],onRequest:v=>calls.push(v)}};
 const render=()=>{i=0;const boundary=UI(props);return boundary.type(boundary.props);};let t=render();assert(!button(t,'배치 위치 확인'));button(t,'이 자산 선택').props.onClick();t=render();assert.equal(calls.length,0);button(t,'배치 위치 확인').props.onClick();assert.deepEqual(calls,[id]);
 props.institutionPlacement.assetIds=[];assert(!button(render(),'배치 위치 확인'));assert.match(text(render()),/호환되는 웹용 제작 자산이 아닙니다/);
});
test('duplicate hidden placement is not silently revealed or reset',()=>{
 let calls=0;const h=harness({composition:comp([{assetId:id,slot:'hero_illustration',isVisible:false,settings:{scale:1.5}}]),onApply:async()=>{calls++;return true;}});select(h);const t=h.render();assert.match(text(t),/숨김 상태/);button(t,'확인한 위치에 적용').props.onClick();assert.equal(calls,0);
});
