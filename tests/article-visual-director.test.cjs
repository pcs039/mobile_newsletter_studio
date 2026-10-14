/* eslint-disable @typescript-eslint/no-require-imports -- Isolated deterministic contract tests. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const load=loader(),{buildVisualDirectorResult:recommend,analyzeArticleVisualNeeds:analyze}=load('src/lib/article-visual-director.ts');
const article=(title,body,patch={})=>({title,body,summary:'',articleType:'general',publicInfo:{},blocks:[],links:[],...patch});
const fixtures={
 festival:article('시민 문화축제 개최','행사 공연과 체험에 참여하세요. 일정과 장소, 입장 안내를 확인하세요.',{articleType:'event_festival',publicInfo:{dateTime:'10월 25일',place:'시청광장'},links:[{isVisible:true,label:'행사 안내'}]}),
 interview:article('김민수 시장 인터뷰','기관장과 질문과 답변을 통해 주민 의견과 실제 정책 방향을 소개합니다.'),
 procedure:article('청년 지원금 신청 절차','지원 대상 확인, 접수, 심사 등 3단계 순서로 서류를 제출합니다.',{articleType:'application_recruitment',publicInfo:{target:'청년',method:'서류 제출 후 심사'}}),
 urgent:article('긴급 교통 통제','즉시 우회하세요. 도로 공사로 통행이 중단되며 변경 내용을 안내합니다.',{articleType:'emergency',urgency:'urgent',publicationKind:'rolling',publicInfo:{affectedArea:'중앙로',action:'우회'}}),
 seasonal:article('가을 문화와 계절의 감성','생활정보와 계절 분위기를 소개합니다. 상징과 개념을 활용한 편안한 배경으로 문화 이야기를 전합니다.'),
 hybrid:article('새 도서관 개관 현장 기록','실제 시설 외관 사진과 이용 정보표를 소개합니다. 방문 인원 100명과 200명을 비교합니다.',{articleType:'local_news',publicInfo:{area:'중앙동',place:'도서관'}}),
};
for(const [key,expected] of Object.entries({festival:'canva_full_layout',interview:'institution_asset',procedure:'information_graphic',urgent:'html_first',seasonal:'ai_generated_image',hybrid:'hybrid'})){
 test(key+' strategy combines content structure and evidence',()=>{
  const before=JSON.stringify(fixtures[key]),r=recommend(fixtures[key]);assert.equal(r.primaryStrategy,expected);assert(r.reasons.length);assert(Number.isFinite(r.confidence));assert.equal(JSON.stringify(fixtures[key]),before);assert.deepEqual(r,recommend(fixtures[key]));
  if(['interview','hybrid'].includes(key)){assert(r.needsRealPhoto);assert(!r.needsGeneratedImage);assert(r.humanInputRequired);}
  if(key==='urgent'){assert(!r.needsVisual);assert(!r.needsGeneratedImage);}
  if(key==='procedure')assert(r.needsInformationGraphic);
  if(key==='seasonal')assert(r.needsGeneratedImage);
  if(key==='hybrid'){assert(r.needsInformationGraphic);assert.equal(r.secondaryStrategy,'information_graphic');}
 });
}
test('only Canva strategy delegates; candidates exactly reuse existing verified recommender',()=>{
 const {recommendArticleDesignTemplates}=load('src/lib/article-design-template-recommendation.ts');const r=recommend(fixtures.festival);
 assert.deepEqual(r.canvaRecommendations,recommendArticleDesignTemplates(fixtures.festival));assert.deepEqual(r.canvaTemplateCandidates,r.canvaRecommendations.map(t=>t.templateId));assert.equal(r.canvaFamily,'event_festival');
 let calls=0;const delegated=loader({'@/lib/article-design-template-recommendation':{recommendArticleDesignTemplates:()=>{calls++;return r.canvaRecommendations;}}})('src/lib/article-visual-director.ts');
 for(const f of Object.values(fixtures).slice(1))delegated.buildVisualDirectorResult(f);assert.equal(calls,0);delegated.buildVisualDirectorResult(fixtures.festival);assert.equal(calls,1);
});
test('insufficient information, lone keywords and image-less notice are normal human/HTML fallback',()=>{
 for(const title of ['','축제','시설','취재','정보표','일정표','지원 조건','지도']){const r=recommend(article(title,''));assert.equal(r.primaryStrategy,'html_first');assert(r.humanInputRequired);assert(r.humanInputReason);assert(!r.needsGeneratedImage);assert(!r.canvaTemplateCandidates);}
 const r=recommend(article('운영시간 변경 공지','월요일부터 안내 창구 운영시간이 바뀝니다. 변경된 시간은 본문에서 확인하세요.'));assert.equal(r.primaryStrategy,'html_first');assert(!r.needsVisual);
});
test('real person, actual event record, specific facilities/products and institution poster outrank conceptual imagery',()=>{
 for(const f of [fixtures.interview,article('축제 현장 기록','행사가 열렸다. 실제 현장 사진으로 시민 참여를 기록하고 가을 분위기를 전합니다.'),article('중앙도서관 개관','시설 외관을 방문해 촬영합니다. 계절 감성 배경이 아니라 건물 내부를 소개합니다.'),article('실제 제품 소개','실제 제품의 외관을 확인하는 자료이며 개념 분위기를 표현하는 배경이 아닙니다.')]){const r=recommend(f);assert.equal(r.primaryStrategy,'institution_asset');assert(!r.needsGeneratedImage);assert(r.needsRealPhoto);}
 const poster=recommend(article('기관 제공 공식 포스터 안내','이미 제작된 포스터 원본으로 행사 참여 일정과 장소를 확인하고 홍보합니다.'));assert.equal(poster.primaryStrategy,'institution_asset');assert(poster.humanInputRequired);
 const provided=recommend(fixtures.interview,{institutionVisualAvailable:true});assert(provided.humanInputRequired);assert(provided.humanInputReason.includes('실제 대상'));assert.deepEqual(provided.adobeTasks,[]);assert.deepEqual(recommend({...fixtures.interview,body:fixtures.interview.body+' 기관 제공 사진 보정이 필요합니다.'},{institutionVisualAvailable:true}).adobeTasks,['retouch']);assert(!Object.hasOwn(load('src/lib/article-visual-director.ts').visualStrategies,'adobe'));
});
test('article changes recalculate, urgency/priority/type/public info contribute without alone inventing facts',()=>{
 assert.notDeepEqual(recommend(fixtures.festival),recommend({...fixtures.festival,...fixtures.urgent}));
 assert.equal(recommend({...fixtures.festival,urgency:'urgent'}).primaryStrategy,'html_first');
 const place=article('봄 문화 탐방','지역 문화를 방문하고 시설에 대한 정보를 전달합니다.',{articleType:'tourism_place',publicInfo:{location:'중앙박물관'}});assert.equal(recommend(place).primaryStrategy,'institution_asset');
 assert(recommend({...fixtures.procedure,institutionPriority:5}).reasons.some(r=>r.includes('기관 우선순위')));
 const map=recommend(article('지도 경로 안내','지도 원본으로 이동 위치와 경로 구간을 비교하여 주민이 쉽게 이해하도록 안내합니다.'));assert(map.humanInputRequired);assert(map.humanInputReason.includes('지도 원본'));
});
test('private/hidden/image paths and arbitrary metadata do not influence signals or leak into results',()=>{
 const f={...fixtures.seasonal,blocks:[{type:'image',body:'/private/token',isVisible:true,metadata:{canvaToken:'secret'}},{type:'paragraph',title:'기관장 인터뷰',body:'실제 현장 기록 행사 열렸다',isVisible:false,metadata:{}}]};
 const r=recommend(f);assert.equal(r.primaryStrategy,'ai_generated_image');assert(!JSON.stringify(r).includes('private'));assert(!JSON.stringify(r).includes('secret'));assert(!analyze(f).needsRealPhoto);
});
test('UI labels are compact and safe; only existing flow receives read-only result',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const View=load('src/components/design/article-visual-director-result.tsx').ArticleVisualDirectorResult;
 const html=renderToStaticMarkup(React.createElement(View,{result:recommend(fixtures.interview)}));assert(html.includes('AI 시각 전략'));assert(html.includes('기관 제공 자료'));assert(html.includes('자료 확인 필요'));assert(!html.includes('<button'));assert(!html.includes('<input'));assert(html.includes('min-w-0'));
});
test('specific local field plus on-site content requires institution imagery even with seasonal tone',()=>{
 const r=recommend(article('가을 지역 소식','지역 현장 풍경과 계절 감성을 전달하는 기사입니다.',{articleType:'local_news',publicInfo:{area:'서울 중구'}}));assert.equal(r.primaryStrategy,'institution_asset');assert(r.needsRealPhoto);assert(!r.needsGeneratedImage);
});
test('visual strategy view recalculates on article rerender without persisted recommendation state',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const View=load('src/components/design/article-visual-director-result.tsx').ArticleVisualDirectorResult;
 const show=f=>renderToStaticMarkup(React.createElement(View,{result:recommend(f)}));assert(show(fixtures.festival).includes('Canva 완성형'));assert(show(fixtures.urgent).includes('HTML 중심'));assert(!show(fixtures.urgent).includes('Canva 완성형'));
});

test('existing draft UI integrates director first and only exposes delegated Canva cards for full-layout strategy',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const template=loader({'@/components/design/canva-recommendation-execution-controls':{CanvaRecommendationExecutionControls:()=>null}})('src/components/design/article-template-recommendations.tsx');
 const ui=loader({'@/components/design/hybrid-visual-controls':{HybridVisualControls:()=>null},'@/components/design/institution-asset-match-controls':{InstitutionAssetMatchControls:()=>null},'@/components/design/information-graphic-controls':{InformationGraphicControls:()=>null},'@/components/design/visual-director-image-controls':{VisualDirectorImageControls:()=>null},'@/components/design/article-visual-asset-generator':{ArticleVisualAssetGenerator:()=>null},'@/components/design/article-template-recommendations':template,'@/components/design/article-visual-director-result':load('src/components/design/article-visual-director-result.tsx')})('src/components/design/article-design-draft-controls.tsx').ArticleDesignDraftControls;
 const show=article=>renderToStaticMarkup(React.createElement(ui,{article,projectSlug:'fixture',articleId:'fixture',composition:{settings:{},assets:[],updatedAt:'test'},onApplied(){},disabled:false}));
 const festival=show(fixtures.festival),person=show(fixtures.interview);assert(festival.indexOf('AI 시각 전략')<festival.indexOf('추천 디자인 Top 3'));assert(festival.includes('행사·축제 02'));assert(!person.includes('추천 디자인 Top 3'));assert(!person.includes('확인할 수 없습니다'));assert(person.includes('디자인 콘셉트 제안받기'));
});
