/* eslint-disable @typescript-eslint/no-require-imports -- Real form/API/repository with in-memory DB transport only. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const loader=require('./canva-test-loader.cjs');
const nodes=(tree,p)=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(t=>nodes(t,p)):[...(p(tree)?[tree]:[]),...nodes(tree.props?.children,p)];
const base={familyId:'family',familyIsActive:true,familyWebfontAllowed:true,name:'Registered',weight:'400',style:'normal',isActive:true,webfontAllowed:true,fileUrl:'/fixture.ttf'};
const fonts=[{...base,id:'regular'},{...base,id:'bold',weight:'700'},{...base,id:'inactive',isActive:false},{...base,id:'other',familyId:'off-family',familyIsActive:false}];
const helpers=loader()('src/lib/project-font-options.ts');
function form(props){const hooks={...React,useRef:v=>({current:v}),useState:v=>[v,()=>{}]};const {ProjectCreateForm}=loader({react:hooks,'next/navigation':{useRouter:()=>({push(){},refresh(){}})}})('src/components/project-create-form.tsx');return ProjectCreateForm({mode:'edit',...props});}

test('project font selection preserves exact face and valid family filtering',()=>{
 const choices=helpers.getProjectFontOptions(fonts,'bold');assert(choices.some(x=>x.id==='regular'));assert(choices.some(x=>x.id==='bold'));assert(!choices.some(x=>x.id==='inactive'));assert(!choices.some(x=>x.id==='other'));
 const retained=helpers.getProjectFontOptions(fonts,'inactive');assert(retained.some(x=>x.id==='inactive'));assert(!retained.some(x=>x.id==='other'));
 assert.equal(helpers.getProjectFontOptions([],'unavailable')[0].id,'unavailable');
});
test('real project form retains selected options when grouped, inactive or library unavailable',()=>{
 for(const [library,current] of [[fonts,'bold'],[fonts,'inactive'],[[],'missing']]){
  const tree=form({fonts:library,initialValues:{titleFontAssetId:current,bodyFontAssetId:'body-missing'}});
  for(const select of nodes(tree,e=>e.type==='select'&&['titleFontAssetId','bodyFontAssetId'].includes(e.props.name)))assert(nodes(select,e=>e.type==='option').some(e=>e.props.value===select.props.defaultValue));
 }
});
test('missing native field retains previous ID while explicit system default clears it',()=>{
 const f=new FormData();assert.equal(helpers.projectFontFormValue(f,'title','bold'),'bold');f.set('title','');assert.equal(helpers.projectFontFormValue(f,'title','bold'),'');
});
test('settings supplies library including retained inactive faces, no data writes',async()=>{
 let query;const {default:Page}=loader({'@/lib/newsletter-repository':{getProjectBasicInfo:async()=>({project:{titleFontAssetId:'bold'}}),getFontAssets:async p=>{query=p;return{fonts};}}})('src/app/projects/[projectId]/settings/page.tsx');
 const tree=await Page({params:Promise.resolve({projectId:'fixture'})});assert.deepEqual(query,{activeOnly:false});const node=nodes(tree,e=>e.props?.mode==='edit')[0];assert.equal(node.props.fonts,fonts);assert.equal(node.props.initialValues.titleFontAssetId,'bold');
});

test('font save and revisit through actual form, API and repository without AI',{concurrency:false},async()=>{
 const oldFetch=global.fetch,OldFormData=global.FormData,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='mock-key';
 const db={id:'11111111-1111-4111-8111-111111111111',slug:'fixture',title:'Issue',title_font_asset_id:'bold',body_font_asset_id:'inactive'};
 const writes=[],project={...db,statusCode:'private',assigneeName:'writer'};
 const load=loader({
  '@/lib/app-auth':{requireApiUser:async()=>({id:'u',name:'writer',role:'admin'}),unauthorizedJsonResponse:()=>Response.json({ok:false},{status:401})},
  '@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:true,project,user:{id:'u',name:'writer',role:'admin'}})},
  '@/lib/article-image-api-origin':{requireImageSameOrigin:()=>{}},
  '@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p,getSupabaseConfigStatus:()=>({url:'https://db.invalid',anonKey:'mock',hasServiceRoleKey:true,isConfigured:true,missing:[]})},
 });
 const route=load('src/app/api/projects/route.ts');
 const input={title:'Issue',organizationName:'Fixture',assigneeName:'writer',publishedDate:'2026-11-01',slug:'fixture',primaryColor:'#092046',status:'private',packageTier:'basic',productionMode:'hybrid',projectType:'integrated',ebookSource:'internal',articleTtsVoice:'marin'};
 try{
  global.fetch=async(url,o)=>{
   if(url==='/api/projects')return route.PATCH(new Request('https://fixture.local/api/projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:o.body}));
   assert(String(url).startsWith('https://db.invalid/rest/v1/newsletter_projects?'));assert.equal(o.method,'PATCH');const body=JSON.parse(o.body);writes.push(body);Object.assign(db,body);return Response.json([db]);
  };
  global.FormData=class{constructor(source){this.source=source;}get(key){return this.source.get(key);}};
  const native=new OldFormData();for(const [k,v] of Object.entries({...input,projectId:'fixture',titleFontAssetId:'regular',bodyFontAssetId:'inactive'}))native.set(k,v);
  const tree=form({fonts,initialValues:{...input,projectId:'fixture',titleFontAssetId:'bold',bodyFontAssetId:'inactive'}});
  await nodes(tree,e=>e.type==='form')[0].props.onSubmit({preventDefault(){},currentTarget:native});
  assert.equal(writes.length,1);assert.equal(db.title_font_asset_id,'regular');assert.equal(db.body_font_asset_id,'inactive');assert(!Object.hasOwn(writes[0],'status'));
  const revisited=form({fonts,initialValues:{titleFontAssetId:db.title_font_asset_id,bodyFontAssetId:db.body_font_asset_id}});
  assert.equal(nodes(revisited,e=>e.type==='select'&&e.props.name==='titleFontAssetId')[0].props.defaultValue,'regular');assert.equal(nodes(revisited,e=>e.type==='select'&&e.props.name==='bodyFontAssetId')[0].props.defaultValue,'inactive');
  const omitted=await route.PATCH(new Request('https://fixture.local/api/projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,projectId:'fixture'})}));assert.equal(omitted.status,200);assert(!Object.hasOwn(writes.at(-1),'title_font_asset_id'));assert(!Object.hasOwn(writes.at(-1),'body_font_asset_id'));assert.equal(db.title_font_asset_id,'regular');
  const clear=await route.PATCH(new Request('https://fixture.local/api/projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,projectId:'fixture',titleFontAssetId:''})}));assert.equal(clear.status,200);assert.equal(db.title_font_asset_id,null);assert.equal(db.body_font_asset_id,'inactive');
 }finally{global.fetch=oldFetch;global.FormData=OldFormData;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
