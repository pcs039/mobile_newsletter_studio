/* eslint-disable @typescript-eslint/no-require-imports -- UI harness; no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),fs=require('node:fs');
const loader=require('./canva-test-loader.cjs');
const nodes=(tree,p)=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(t=>nodes(t,p)):[...(p(tree)?[tree]:[]),...nodes(tree.props?.children,p)];
function harness(props={}){
 const states=[],effects=[];let cursor=0;
 const hooks={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect(fn){effects.push(fn);}};
 const load=loader({react:hooks,'@/components/article-font-settings-context':{useArticleFontSettingsWorkspace:()=>current}}),{ArticleFontSettings}=load('src/components/article-font-settings.tsx');
 let current={articleId:'a',fonts:[],initialValues:{title:'bold',body:'body',caption:'',button:'cta'},...props};
 return{render(){cursor=0;return ArticleFontSettings(current);},effects,update(p){current={...current,...p};}};
}
const selectors=t=>nodes(t,e=>e.props?.onValueChange);
const saveButton=t=>nodes(t,e=>e.type==='button')[0];
test('one compact selector per role; each associates with existing article form, no new API',()=>{
 const h=harness(),items=selectors(h.render());assert.deepEqual(items.map(i=>i.props.name),['titleFontAssetId','bodyFontAssetId','captionFontAssetId','buttonFontAssetId']);
 assert(items.every(i=>i.props.compact&&i.props.form==='article-editor-a'));assert.equal(items[0].props.defaultValue,'bold');
 assert.equal(items[2].props.inheritedId,'body');
 const inherited=selectors(harness({initialValues:{title:'',body:'',caption:'',button:''},projectTitleFontAssetId:'project-title',projectBodyFontAssetId:'project-body'}).render());
 assert.deepEqual(inherited.map(i=>i.props.inheritedId),['project-title','project-body','project-body','project-body']);assert(inherited.every(i=>i.props.defaultValue===''));
 const source=fs.readFileSync('src/components/project-article-editor-form.tsx','utf8');assert(!source.includes('<SearchableFontSelect'));assert(source.includes('id={articleEditorFormId(article?.id)}'));assert(source.includes('new FormData(event.currentTarget)'));
});
test('fields independent, inheritance follows current body draft; dirty survives rerender and failed save',()=>{
 const reports=[],h=harness({onDirtyChange:v=>reports.push(v)});let t=h.render();h.effects.at(-1)();assert.equal(reports.at(-1),false);
 selectors(t)[1].props.onValueChange('new-body');t=h.render();h.effects.at(-1)();assert.equal(reports.at(-1),true);
 assert.equal(selectors(t)[2].props.inheritedId,'new-body');assert.equal(selectors(t)[0].props.defaultValue,'bold');assert.equal(selectors(t)[3].props.defaultValue,'cta');
 h.update({articleError:'저장 실패'});assert.match(JSON.stringify(h.render()),/선택한 글꼴을 유지/);assert.equal(selectors(h.render())[2].props.inheritedId,'new-body');
 h.update({articleError:''});selectors(h.render())[1].props.onValueChange('body');h.render();h.effects.at(-1)();assert.equal(reports.at(-1),false);
});
test('Composition unsaved or saving blocks article submit; article save disables controls',()=>{
 const h=harness({compositionUnsettled:true});assert(saveButton(h.render()).props.disabled);assert.match(JSON.stringify(h.render()),/세부 디자인의 변경사항을 먼저 저장/);
 h.update({compositionUnsettled:false,articleSaving:true});assert(saveButton(h.render()).props.disabled);assert(nodes(h.render(),e=>e.type==='fieldset')[0].props.disabled);
});
test('font save requests only native article submit; invalid article switches back, no submit',()=>{
 const oldDocument=global.document,oldForm=global.HTMLFormElement;let submits=0,opened=0;class Form{elements={namedItem:()=>null};checkValidity(){return this.valid;}requestSubmit(){submits++;}}const form=new Form();global.HTMLFormElement=Form;global.document={getElementById(id){assert.equal(id,'article-editor-a');return form;}};
 try{const h=harness({onInvalidArticle:()=>opened++});form.valid=false;saveButton(h.render()).props.onClick();assert.equal(opened,1);assert.equal(submits,0);
 form.valid=true;saveButton(h.render()).props.onClick();assert.equal(submits,1);
 h.update({compositionUnsettled:true});saveButton(h.render()).props.onClick();assert.equal(submits,1);
 }finally{global.document=oldDocument;global.HTMLFormElement=oldForm;}
});
test('workspace preserves panels, combines font dirty with Composition notice, scopes saving/error events',()=>{
 const oldWindow=global.window,listeners=new Map();global.window={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 try{const states=[];let cursor=0;const hooks={...React,useState(v){const i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=v];},useCallback:fn=>fn,useEffect(fn){const i=cursor++;if(!states[i]){states[i]=true;fn();}}};
 const {ArticleWorkspaceTabs}=loader({react:hooks})('src/components/article-workspace-tabs.tsx');const fontSettings=React.createElement('font-settings',{marker:true});const props={articleId:'a',initialTab:'composition',fontSettings,content:'content',composition:'composition',review:null};const render=()=>{cursor=0;return ArticleWorkspaceTabs(props);};
 let t=render();const font=()=>nodes(render(),e=>e.props?.value?.onDirtyChange)[0].props.value;font().onDirtyChange(true);assert(nodes(render(),e=>e.props?.isOpen!==undefined)[0].props.designUnsettled);
 listeners.get('article-editor-save-state')({detail:{articleId:'other',saving:true,error:'other'}});assert.equal(font().articleSaving,false);
 listeners.get('article-editor-save-state')({detail:{articleId:'a',saving:true,error:''}});assert(font().articleSaving);
 listeners.get('article-design-save-state')({detail:{articleId:'a',unsettled:true}});assert(font().compositionUnsettled);
 t=render();assert.equal(nodes(t,e=>e.props?.id==='article-workspace-panel-content')[0].props.children,'content');
 }finally{global.window=oldWindow;}
});

test('deferred RSC font slot stays intact while client context carries save state',async()=>{
 const {PassThrough}=require('node:stream');
 const {createFromNodeStream}=require('next/dist/compiled/react-server-dom-webpack/client.node');
 const {renderToStaticMarkup}=require('react-dom/server');
 const stream=new PassThrough();
 const root=createFromNodeStream(stream,{moduleMap:{},serverModuleMap:{},moduleLoading:null});
 stream.write('0:{"fontSettings":"$L1"}\n');
 const {fontSettings}=await root;
 assert.equal(fontSettings.$$typeof,Symbol.for('react.lazy'));
 assert.equal(React.isValidElement(fontSettings),false);
 // Prior implementation creates an element with undefined type, the production #130.
 assert.equal(React.cloneElement(fontSettings,{}).type,undefined);
 assert.throws(()=>renderToStaticMarkup(React.cloneElement(fontSettings,{})),/Element type is invalid/);
 stream.end('1:["$","section",null,{"children":"deferred font settings"}]\n');
 await new Promise(resolve=>setImmediate(resolve));
 const hooks={...React,useState:v=>[v,()=>{}],useEffect:()=>{},useCallback:fn=>fn};
 const {ArticleWorkspaceTabs}=loader({react:hooks})('src/components/article-workspace-tabs.tsx');
 const tree=ArticleWorkspaceTabs({articleId:null,initialTab:'content',fontSettings,content:'article content',composition:'composition',review:'review',publishHref:'/publish'});
 const provider=nodes(tree,e=>e.props?.value?.onDirtyChange)[0];
 assert.equal(provider.props.children,fontSettings);
 assert.equal(provider.props.value.articleSaving,false);
 const html=renderToStaticMarkup(tree);
 assert.match(html,/deferred font settings/);
 assert.match(html,/article content/);
});
