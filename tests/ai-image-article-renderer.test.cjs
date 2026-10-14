/* eslint-disable @typescript-eslint/no-require-imports -- Execute the existing reader card with inert unrelated controls. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const loader=require('./canva-test-loader.cjs'),load=loader({'@/lib/korean-title-breaks':loader()('src/lib/korean-title-breaks.tsx')});
const source=fs.readFileSync('src/components/public-mobile-article-reader.tsx','utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const passthrough=({children})=>React.createElement('div',null,children);
const components=new Proxy({}, {get:(o,key)=>key==='__esModule'?true:passthrough});
const req=name=>name==='@/components/article-hero-background-layer'?{ArticleHeroBackgroundLayer:({children,body})=>React.createElement('div',null,children,body)}:name==='@/lib/korean-title-breaks'?load('src/lib/korean-title-breaks.tsx'):name.startsWith('@/components/')?components:name.startsWith('@/')?load('src/'+name.slice(2)+'.ts'):name==='next/link'?{__esModule:true,default:({children,...p})=>React.createElement('a',p,children)}:require(name);
const mod={exports:{}};vm.runInThisContext('(function(require,module,exports){'+js+'\nexports.TestCard=ArticleCard;})')(req,mod,mod.exports);
const articleId='22222222-2222-4222-8222-222222222222',assetId='33333333-3333-4333-8333-333333333333';
const article={id:articleId,title:'원문 제목 유지',summary:'원문 요약 유지',body:'블록이 없어도 저장된 본문은 그대로 표시합니다.',articleType:'general',publicInfo:{},showPublicTitle:true,contentPresentation:'text',blocks:[],links:[{id:'link',label:'직접 행동',targetValue:'https://example.com',actionType:'url',displayStyle:'button',isVisible:true}],interestTags:[]};
const image=role=>({id:role,type:'image',title:'개념 이미지',body:'/api/public-files/preview?aiImageBlock='+role,isVisible:true,assetId:null,sortOrder:10,metadata:{managed_by:'ai_image_article_v1',source:'openai',source_asset_id:assetId,generated_for_article_id:articleId,visual_strategy:'ai_generated_image',generation_key:'a'.repeat(64),variant_index:1,applied_role:role}});
function render(a){return renderToStaticMarkup(React.createElement(mod.exports.TestCard,{article:a,index:0,fontAssets:[],showAdminPreviewControls:false,slug:'fixture',onOpenArticleImage(){}}));}
for(const role of ['hero','body'])test('managed '+role+' preserves HTML source, even without paragraph blocks',()=>{
 const html=render({...article,blocks:[image(role)]});
 for(const value of [article.title,article.summary,article.body])assert(html.includes(value),value);
 assert.equal((html.match(/<img /g)||[]).length,1);if(role==='hero')assert(html.indexOf('<figure')<html.indexOf('<h2'));
});
test('ordinary image article and paragraph rendering do not acquire AI suppression',()=>{
 const plain={id:'paragraph',type:'paragraph',title:'소제목',body:'기존 문단 원문',isVisible:true,sortOrder:0,metadata:{}};
 const cta={id:'cta',type:'button_group',title:'직접 행동',body:'https://example.com',linkActionId:'link',isVisible:true,sortOrder:20,metadata:{}};
 const html=render({...article,blocks:[plain,image('hero'),cta]});assert(html.includes('기존 문단 원문'));assert(html.includes(article.title));assert(html.includes('https://example.com'));assert.equal((html.match(/<img /g)||[]).length,1);
 const ordinary=render({...article,contentPresentation:'image',blocks:[{...image('body'),metadata:{}}]});assert(ordinary.includes('<img '));assert(!ordinary.includes('ai_image_article_v1'));
});
