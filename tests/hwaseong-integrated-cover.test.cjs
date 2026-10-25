/* eslint-disable @typescript-eslint/no-require-imports -- Isolated rendering, no remote services. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const {sampleHref}=loader()('src/lib/hwaseong-proposal-sample.ts');
const slug='hwaseong-2026-10-samples';
const cover={coverImageSrc:'/api/public-files/preview?bucket=mobile-assets&path=fixture.webp',coverFit:'cover',coverLayout:'image_info',coverTitle:'설정에 저장한 제목',coverSubtitle:'설정에 저장한 부제',coverIssueText:'2026.10 · 비공개 제안 시안',masthead:'프로젝트 제호'};
const samples=Array.from({length:7},(_,i)=>({article:{id:`a${i+1}`,blocks:[]},kind:'policy',headline:`기사 ${i+1}`,summary:'기사 요약',cover:'/retained.webp',eyebrow:`0${i+1}`,pale:'#fff',color:'#123456'}));
const Link=({children,href,...props})=>React.createElement('a',{...props,href},children);
function render(props={}) {
 const load=loader({'next/link':Link,'next/navigation':{useSearchParams:()=>null,useRouter:()=>({push:()=>{}})},'@/components/public-mobile-article-reader':{ArticleCard:()=>React.createElement('p',null,'보존된 기사 본문'),PublicNewsletterCoverView:p=>React.createElement('section',{'data-cover':true},p.coverTitle,React.createElement('img',{src:p.coverImageSrc,alt:p.coverImageAlt}),React.createElement('button',null,p.tocLabel),React.createElement('button',null,'첫 기사 읽기'))},'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null}});
 return renderToStaticMarkup(React.createElement(load('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader,{slug,samples,fonts:[],backgrounds:{},textDesigns:{},detail:false,width:390,cover,...props}));
}
test('default entry renders project cover and client notices without QA controls',()=>{
 const h=render();assert.match(h,/설정에 저장한 제목/);assert.match(h,/콘텐츠 둘러보기/);assert.match(h,/첫 기사 읽기/);assert.match(h,/실제 화성 풍경 사진이 아닙니다/);assert(!h.includes('>390px<'));assert(!h.includes('Production'));assert.match(h,/정식 발행물 아님/);
});
test('contents and retained article deep links bypass cover; old summary/detail remains available',()=>{
 const toc=render({contents:true});assert(!toc.includes('data-cover'));assert.match(toc,/처음으로/);for(let i=1;i<=7;i++)assert(toc.includes(`articleId=a${i}`));
 const summary=render({selectedId:'a3'});assert(!summary.includes('data-cover'));assert.match(summary,/view=contents/);assert.match(summary,/articleId=a3&amp;view=detail/);assert.match(summary,/articleId=a2/);assert.match(summary,/articleId=a4/);
 const detail=render({selectedId:'a3',detail:true});assert.match(detail,/보존된 기사 본문/);assert.match(detail,/이전 페이지 · 이 기사 요약/);
 assert(!render({cover:undefined}).includes('data-cover'));assert.match(render({qa:true}),/390px/);
});
test('navigation preserves QA, width and article context; contents is distinct from cover',()=>{
 const base=new URL(sampleHref(slug,undefined,false,520),'https://fixture');assert(!base.searchParams.has('view'));
 const toc=new URL(sampleHref(slug,undefined,false,520,{contents:true,qa:true}),'https://fixture');assert.equal(toc.searchParams.get('view'),'contents');assert.equal(toc.searchParams.get('qa'),'1');assert.equal(toc.searchParams.get('width'),'520');
 const detail=new URL(sampleHref(slug,'a6',true,390,{contents:true,qa:true}),'https://fixture');assert.equal(detail.searchParams.get('view'),'detail');assert.equal(detail.searchParams.get('articleId'),'a6');
 assert(!render({selectedId:'a1'}).includes('articleId=a0'));assert(!render({selectedId:'a7'}).includes('articleId=a8'));
});
test('shared cover retains ordinary reader defaults and renders HTML independently of image',()=>{
 const View=loader({'next/link':Link})('src/components/public-mobile-article-reader.tsx').PublicNewsletterCoverView;
 const props={...cover,masthead:undefined,slug,hasArticles:true,onOpenToc:()=>{},onStartReading:()=>{}};
 const normal=renderToStaticMarkup(React.createElement(View,props));assert.match(normal,/목차 보기/);assert.match(normal,/첫 기사 읽기/);assert(!normal.includes('30svh'));assert(!normal.includes('data-public-text-scale-target'));
 const compact=renderToStaticMarkup(React.createElement(View,{...props,compact:true,masthead:'프로젝트 제호',tocLabel:'7가지 콘텐츠 둘러보기'}));assert.match(compact,/data-public-text-scale-target="article-title"/);assert.match(compact,/설정에 저장한 부제/);assert.match(compact,/프로젝트 제호/);assert.equal((compact.match(/<img /g)||[]).length,1);
});
test('Staging route uses the existing project cover contract and retains access guard',async()=>{
 const project={id:'p',coverEnabled:true,coverImagePath:'path/cover.webp',coverImageUrl:'ignored',coverFit:'contain',coverLayout:'image_info',coverTitle:'DB 제목',coverSubtitle:'DB 부제',coverIssueText:'DB 호수',title:'DB 제호'};
 const load=loader({'next/navigation':{notFound:()=>{throw Error('404');}},'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true},'@/lib/project-admin-preview-access':{requireProjectAdminPreviewAccess:async()=>true},'@/lib/newsletter-repository':{getProjectWorkspace:async()=>({project}),getProjectContent:async()=>({source:'supabase',articles:[]}),getFontAssets:async()=>({fonts:[]}),makePublicStoragePreviewHref:(b,p)=>`/${b}/${p}`},'@/lib/article-composition-repository':{getArticleHeroBackgrounds:async()=>({}),getArticleTextDesigns:async()=>({})}});
 const page=load('src/app/projects/[projectId]/samples/page.tsx').default;
 const element=await page({params:Promise.resolve({projectId:slug}),searchParams:Promise.resolve({view:'contents',qa:'1'})});const p=element.props.children[1].props;
 assert.equal(p.cover.coverImageSrc,'/mobile-assets/path/cover.webp');assert.equal(p.cover.coverTitle,'DB 제목');assert.equal(p.cover.masthead,'DB 제호');assert.equal(p.contents,true);assert.equal(p.qa,true);
 project.coverEnabled=false;assert.equal((await page({params:Promise.resolve({projectId:slug}),searchParams:Promise.resolve({})})).props.children[1].props.cover,undefined);
 for(const [interest,expected] of [['pets','pets'],['culture','culture'],['civic','civic'],['invalid','all'],[['pets','culture'],'all']])assert.equal((await page({params:Promise.resolve({projectId:slug}),searchParams:Promise.resolve({interest})})).props.children[1].props.interest,expected);
});
