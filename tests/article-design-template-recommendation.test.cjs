/* eslint-disable @typescript-eslint/no-require-imports -- Existing isolated TypeScript test loader. */
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./canva-test-loader.cjs')();
const { recommendArticleDesignTemplates: recommend } = load('src/lib/article-design-template-recommendation.ts');
const { getCanonicalCanvaTemplate: get } = load('src/lib/canva-template-registry.ts');
const article = (title, body = '', overrides = {}) => ({ title, body, summary: '', blocks: [], articleType: 'general', publicInfo: {}, ...overrides });

const cases = [
  ['지원금', article('청년 지원금과 혜택 안내', '지원 대상 청년에게 보조금 100만원을 지급합니다. 신청 접수 기간을 확인하세요.'), 'policy_support_02'],
  ['신청 절차', article('복지 지원사업 신청 절차', '신청 대상 확인, 접수, 심사 등 3단계 순서로 진행합니다.'), 'policy_support_03'],
  ['축제', article('시민 문화축제 개최', '행사 일정과 장소를 확인하고 시민 참여 프로그램을 관람하세요.'), 'event_festival_01'],
  ['공연', article('시민 콘서트 공연 개최', '행사 일정과 공연장 장소, 관람 안내를 확인하세요.'), 'event_festival_02'],
  ['전시', article('새 전시 행사 개최', '전시장에서 행사 일정과 관람 장소를 확인하세요.'), 'event_festival_03'],
  ['박람회', article('산업 박람회 엑스포 개최', '행사 일정과 장소, 시민 참여 안내입니다.'), 'event_festival_04'],
  ['모집', article('청년 참여기업 모집', '신청 접수 마감과 지원 대상 자격을 확인하세요.'), 'recruitment_contest_01'],
  ['공모', article('시민 아이디어 공모전', '공모 참여 신청 접수와 마감 기한을 안내합니다.'), 'recruitment_contest_04'],
  ['인터뷰', article('주민 이야기 인터뷰', '주민 대표의 발언을 인용하며 질문과 답변을 소개합니다.'), 'interview_person_02'],
  ['관광명소', article('해안 문화 관광명소 여행', '지역 명소 방문과 풍경 이야기를 소개합니다.'), 'culture_tourism_02'],
  ['통계 비교', article('두 값 통계 비교', '작년 100건과 올해 150건의 수치 증감과 증가율 50%를 비교합니다.'), 'statistics_performance_02'],
  ['추이', article('월별 통계 추이', '연도별 수치가 100건에서 150건으로 증가하는 추세를 살펴봅니다.'), 'statistics_performance_03'],
  ['복수 KPI', article('종합 성과 복수 KPI', 'KPI 1 100건, KPI 2 200명, KPI 3 30% 지표를 소개합니다.'), 'statistics_performance_04'],
  ['Q&A', article('Q&A 자주 묻는 질문', '질문: 어떤 서류인가요? 답변: 기본 서류입니다.'), 'cardnews_03'],
  ['체크리스트', article('안전 체크리스트', '준비물과 점검 항목, 확인 목록을 안내합니다.'), 'cardnews_04'],
  ['캐릭터 대화', article('캐릭터 대화 만화', '등장인물의 대사와 말풍선으로 상황을 보여줍니다.'), 'cartoon_03'],
  ['정책 설명 만화', article('복지 정책 설명 만화', '만화 캐릭터가 정책을 안내하고 설명합니다.'), 'cartoon_04'],
];

for (const [name, input, expected] of cases) {
  test(`${name}: expected family and variant leads the verified Top 3`, () => {
    const result = recommend(input);
    assert.equal(result[0].templateId, expected);
    assert.equal(result.length, 3);
    assert.equal(new Set(result.map(t => t.templateId)).size, 3);
    result.forEach((t, index) => {
      assert.equal(t.rank, index + 1);
      assert(Number.isFinite(t.score));
      assert(t.reason.length > 0);
      assert.equal(get(t.templateId).datasetStatus, 'verified');
      assert.equal(t.canvaBrandTemplateId, get(t.templateId).canvaBrandTemplateId);
      assert(!['culture_tourism_01', 'cardnews_02'].includes(t.templateId));
      if (index) assert(result[index - 1].score >= t.score);
    });
  });
}

test('single ambiguous keyword/date and an unsupported concept never classify; fallback is explicit and deterministic', () => {
  for (const title of ['', '일반 소식', '정책', '지원금', '축제', '명소']) {
    const result = recommend(article(title));
    assert.deepEqual(result.map(t => t.templateId), ['cardnews_01', 'cardnews_03', 'cardnews_04']);
    assert(result.every(t => t.score === 0 && t.reason.includes('근거가 부족')));
  }
  assert.deepEqual(recommend(article('', '', { publicInfo: { dateTime: '2026년 10월 25일' }, articleType: 'event_festival' })), recommend(article('')));
  assert(recommend(article('지원금', '', { publicInfo: { dateTime: '10월 25일' }, articleType: 'event_festival' })).every(t => t.score === 0));
  assert.deepEqual(recommend(article(''), { pattern: 'event', layoutDirection: 'friendly' }), recommend(article('')));
});

test('saved visible paragraph/info/quote text is used; private/image/link/hidden metadata is ignored; input never changes', () => {
  const input = article('시민 소식', '', { blocks: [
    { type: 'paragraph', title: '콘서트 공연', body: '행사 개최 일정과 장소 관람 안내', isVisible: true, metadata: { body_design: { kind: 'info' } } },
    { type: 'paragraph', title: '캐릭터 만화', body: '대화 말풍선', isVisible: false, metadata: {} },
    { type: 'image', title: '만화 캐릭터 대화', body: 'PRIVATE', isVisible: true, metadata: {} },
  ], privateMetadata: '만화 캐릭터 대화', review: { token: 'secret' }, storagePath: 'secret' });
  const before = JSON.stringify(input);
  assert.equal(recommend(input)[0].templateId, 'event_festival_02');
  assert.equal(JSON.stringify(input), before);
  const secretOnly = article('', '', { blocks: [...input.blocks.slice(1), { type: 'paragraph', title: '만화 캐릭터', body: '대화 말풍선', isVisible: true, metadata: { body_design: { kind: 'quote', enabled: false } } }], privateMetadata: input.privateMetadata, publicInfo: { secret: '만화 캐릭터 대화' } });
  assert(recommend(secretOnly).every(t => t.score === 0));
});

test('publicInfo and existing concept are secondary evidence; repeats do not increase scores; long sources are bounded', () => {
  const input = article('시민 축제', '', { articleType: 'event_festival', publicInfo: { dateTime: '10월 25일', place: '시청광장' } });
  assert.equal(recommend(input)[0].family, 'event_festival');
  assert(recommend(input, { pattern: 'event', layoutDirection: 'information' })[0].score > recommend(input)[0].score);
  const base = article('행사 축제 개최', '장소 일정 안내');
  assert.deepEqual(recommend(base), recommend({ ...base, body: base.body.repeat(10) }));
  assert.deepEqual(recommend(base), recommend(base));
  assert.equal(recommend(article('', '가'.repeat(16000) + '만화 캐릭터 대화'))[0].score, 0);
});
