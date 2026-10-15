/* eslint-disable @typescript-eslint/no-require-imports -- Render the real reader and preview with the existing isolated TS loader. */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const loader = require('./canva-test-loader.cjs');
const load = loader({ '@/lib/korean-title-breaks': loader()('src/lib/korean-title-breaks.tsx') });
const { CompositionMobilePreview, localPreviewLayer } = load('src/components/design/composition-mobile-preview.tsx');
const { ArticleCard } = load('src/components/public-mobile-article-reader.tsx');
const article = {
 id:'22222222-2222-4222-8222-222222222222', title:'행사 안내 제목',summary:'요약 전문',body:'짧은 본문',articleType:'event_festival',publicInfo:{dateTime:'10월 25일',place:'시청광장'},
 showPublicTitle:true,contentPresentation:'mixed',textAlignment:'left',titleAlignment:'left',summaryAlignment:'left',bodyAlignment:'left',
 blocks:[],links:[],interestTags:[],publicationKind:'regular',urgency:'normal',motionPreset:'none',motionSpeed:'normal',contactName:'문화과',contactPhone:'032-123-4567',
};
const block = (id,type,body,extra={}) => ({id,type,body,title:'',isVisible:true,sortOrder:10,metadata:{},...extra});
const composition = {id:'c',articleId:article.id,status:'draft',settings:{textDesign:{subtitleEnabled:true,subtitle:'HTML 소제목',labelEnabled:true,label:'행사',captionStyled:true}},assets:[]};
const asset = (id,assetType) => ({id,assetType,previewHref:'/test-'+id+'.png',approvalStatus:'draft',isActive:true});
const placement = (id,slot,sortOrder=0,settings={}) => ({id,assetId:id,slot,isVisible:true,sortOrder,createdAt:'2026-10-01',settings});
function preview(a=article,c=composition,assets=[]){return renderToStaticMarkup(React.createElement(CompositionMobilePreview,{article:a,composition:c,assets,selectedPlacementId:null}));}
function card(a=article,c=composition,assets=[]){return renderToStaticMarkup(React.createElement(ArticleCard,{article:a,index:0,fontAssets:[],slug:'',analyticsDisabled:true,showAdminPreviewControls:false,onOpenArticleImage(){},textDesign:load('src/lib/article-text-design.ts').readArticleTextDesign(c.settings.textDesign),heroBackground:localPreviewLayer(c,assets,'hero_background'),topIllustration:localPreviewLayer(c,assets,'hero_illustration'),className:'mx-5 my-5'}));}
function innerCard(html){return html.slice(html.indexOf('<article '),html.lastIndexOf('</article>')+10);}
test('short/long/body-only copy matches the actual reader card without 360-character truncation',()=>{
 for(const body of ['짧은 본문', '보존되는 긴 본문입니다. '.repeat(160)+'마지막 문장까지 표시', '']){
  const a={...article,body};assert.equal(innerCard(preview(a)),innerCard(card(a)));
  if(body)assert(preview(a).replace(/<[^>]*>/g,'').includes(body.trim().slice(-10)));else assert(preview(a).includes('본문이 아직 입력되지 않았습니다.'));
 }
});
test('mixed visible/sorted blocks, HTML design, captions, public info and CTA reuse reader markup',()=>{
 const a={...article,blocks:[block('image','image','/example.png',{title:'이미지 캡션',sortOrder:20}),block('p','paragraph','본문 전체',{title:'단락 소제목',sortOrder:0}),block('info','paragraph','신청 전 확인',{metadata:{body_design:{kind:'info',enabled:true,tone:'default'}}}),block('quote','paragraph','인용 원문',{metadata:{body_design:{kind:'quote',enabled:true,source:'담당자'}}}),block('cta','button_group','https://example.com',{title:'행사 안내 확인'}),block('hidden','paragraph','비공개 문장',{isVisible:false})]};
 const html=preview(a);assert.equal(innerCard(html),innerCard(card(a)));
 for(const value of ['단락 소제목','본문 전체','이미지 캡션','10월 25일','시청광장','행사 안내 확인','HTML 소제목','신청 전 확인','인용 원문','032-123-4567','data-article-designed-caption','확대 보기'])assert(html.includes(value),value);
 assert(!html.includes('비공개 문장'));assert(html.indexOf('본문 전체')<html.indexOf('이미지 캡션'));
});
test('same shared hero geometry for cover/fluid frame and independent illustration',()=>{
 const assets=[asset('bg','background'),asset('top','illustration')];
 for(const renderMode of ['image','fluid_frame']){
  const c={...composition,assets:[placement('bg','hero_background',0,{renderMode,anchor:'top_right',offsetX:-12,offsetY:18,scale:1.2,rotation:12,opacity:0.6,zIndex:8}),placement('top','hero_illustration',0,{anchor:'bottom_left',rotation:-8,opacity:0.8})]};
  const html=preview(article,c,assets);assert.equal(innerCard(html),innerCard(card(article,c,assets)));
  assert(html.includes('rotate(-8deg)'));assert(html.includes('opacity:0.8'));
  if(renderMode==='fluid_frame')assert(html.includes('data-article-fluid-frame'));else {assert(html.includes('rotate(12deg)'));assert(html.includes('opacity:0.6'));}
 }
});
test('only the first valid visible layer per supported slot; unsupported slots remain data-only',()=>{
 const c={...composition,assets:[placement('hidden','hero_background',-10),placement('later','hero_background',20),placement('first','hero_background',0),...['title_icon','body_decoration','footer_banner'].map(slot=>placement(slot,slot))]};c.assets[0].isVisible=false;
 const assets=['hidden','later','first','title_icon','body_decoration','footer_banner'].map(id=>asset(id,'background'));
 assert.equal(localPreviewLayer(c,assets,'hero_background').url,'/test-first.png');const html=preview(article,c,assets);assert(!html.includes('/test-later.png'));assert(!html.includes('/test-hidden.png'));assert(!html.includes('/test-title_icon.png'));assert(html.includes('공개 미지원'));assert.equal(c.assets.length,6);
});
test('invalid settings/type or missing assets fail safely; draft local inputs stay separate from public gating',()=>{
 for(const [settings,type] of [[{opacity:99},'background'],[{},'card_frame']])assert.equal(localPreviewLayer({...composition,assets:[placement('bg','hero_background',0,settings)]},[asset('bg',type)],'hero_background'),undefined);
 assert.equal(localPreviewLayer({...composition,assets:[placement('missing','hero_background')]},[],'hero_background'),undefined);
 assert(preview().includes('draft·미승인'));assert(preview().includes('즉시 미리보기 화면 폭'));
});
test('hidden title, ordinary image article and full-layout preserve the exact shared-reader policy',()=>{
 const full=block('full','image','/api/public-files/preview?fullLayoutBlock=full',{metadata:{managed_by:'canva_full_layout_v1',presentation_mode:'full_layout',design_source:'canva',design_asset_id:'33333333-3333-4333-8333-333333333333',template_id:'event_festival_02',source_snapshot:'a'.repeat(32),applied_snapshot:'b'.repeat(32)}});
 for(const a of [{...article,showPublicTitle:false},{...article,contentPresentation:'image',blocks:[block('img','image','/example.png')]},{...article,blocks:[full,block('p','paragraph','접근성 원문')]}])assert.equal(innerCard(preview(a)),innerCard(card(a)));
 const html=preview({...article,blocks:[full,block('p','paragraph','접근성 원문')]});assert(html.includes('텍스트로 읽기'));assert(html.includes('접근성 원문'));
});
test('renderer inputs and source content are not mutated',()=>{
 const a={...article,blocks:[block('second','paragraph','두 번째',{sortOrder:20}),block('first','paragraph','첫 번째',{sortOrder:0})]},before=JSON.stringify({a,composition});preview(a);assert.equal(JSON.stringify({a,composition}),before);
});
