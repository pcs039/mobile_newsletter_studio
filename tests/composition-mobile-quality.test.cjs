/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the shared reader with local fixtures. */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const loader = require('./canva-test-loader.cjs');
const load = loader({'@/lib/korean-title-breaks':loader()('src/lib/korean-title-breaks.tsx')});
const {ArticleCard} = load('src/components/public-mobile-article-reader.tsx');
const label = '주민문화행사참여신청과상세일정안내'.repeat(6)+' 신청하기';
const article = {id:'local-quality',title:'긴제목'.repeat(30),summary:'긴 요약 '.repeat(50),body:'긴 본문 '.repeat(100),articleType:'application_recruitment',publicInfo:{method:'온라인 신청'},showPublicTitle:true,contentPresentation:'mixed',blocks:[{id:'cta',type:'button_group',title:label,body:'https://example.com',isVisible:true,sortOrder:10,metadata:{}}],links:[],interestTags:[],publicationKind:'regular',urgency:'normal',motionPreset:'none',motionSpeed:'normal'};
function render(renderMode) {
  return renderToStaticMarkup(React.createElement(ArticleCard,{article,index:0,fontAssets:[],slug:'fixture',analyticsDisabled:true,showAdminPreviewControls:false,onOpenArticleImage(){},heroBackground:renderMode?{url:'/local-background.png',visible:true,settings:{renderMode,rotation:25,scale:1.5,zIndex:20}}:undefined}));
}
test('long application action remains complete and attached to public info inside the fluid frame',()=>{
 const before=JSON.stringify(article),html=render('fluid_frame');
 assert(html.includes(label));assert(html.includes(article.summary));assert(html.includes('온라인 신청'));
 assert(html.indexOf('data-article-fluid-frame')<html.indexOf('data-article-action="button"'));
 assert.equal((html.match(/data-article-action="button"/g)||[]).length,1);
 assert(html.includes('href="https://example.com/"'));assert.equal(JSON.stringify(article),before);
});
test('image backgrounds keep decorative pointer and stacking rules; undecorated articles gain no frame',()=>{
 const html=render('image');assert(html.includes('pointer-events-none'));assert(html.includes('z-index:20'));assert(html.includes('rotate(25deg)'));assert(html.includes('bg-white/90'));assert(!html.includes('data-article-fluid-frame'));
 assert(!render().includes('data-article-hero='));
});
test('public-info CTA stays bounded in fluid/image/no-background cards without truncating labels or icons',()=>{
 for(const mode of ['fluid_frame','image',undefined]) {
  const html=render(mode),tag=html.match(/<a[^>]*data-article-action="button"[^>]*>/)?.[0];
  assert(tag);for(const value of ['min-w-0','max-w-full','whitespace-normal','[overflow-wrap:anywhere]'])assert(tag.includes(value));
  assert(!/overflow-hidden|line-clamp|truncate/.test(tag));
  assert(html.includes(`<span class="min-w-0">${label}</span>`));
  assert(html.includes('size-4 shrink-0 fill-none stroke-current'));
 }
});
