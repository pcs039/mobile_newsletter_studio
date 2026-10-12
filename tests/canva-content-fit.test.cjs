/* eslint-disable @typescript-eslint/no-require-imports -- Existing isolated TS harness. */
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const load = require('./canva-test-loader.cjs')();
const { fitCanvaEventField: fit, prepareCanvaContentFit: preflight, canvaEventFitCalibration: calibration } = load('src/lib/canva-content-fit.ts');
const { buildCanonicalCanvaAutofillPayload: build } = load('src/lib/canva-autofill-payload.ts');
const project = { id: 'project', title: '소식지', issue: '10월' };
const article = { title: '문화축제', summary: '시민과 함께 즐겨요.', body: '원본 본문', articleType: 'event_festival',
  publicInfo: { dateTime: '10월 25일', place: '시청광장' }, blocks: [], links: [{ id: 'cta', isVisible: true, label: '일정 확인' }] };
const image = { field: 'MAIN_IMAGE', asset: { id: 'asset', projectId: project.id, approvalStatus: 'approved', isActive: true, mimeType: 'image/png' },
  sourceHash: 'a'.repeat(64), upload: { status: 'success', sourceAssetId: 'asset', sourceHash: 'a'.repeat(64), jobId: 'UPLOAD', assetId: 'IMAGE' } };
const input = { templateId: 'event_festival_02', project, article, images: [image] };
test('short title and concise fields pass; payload is copied and source provenance retained', () => {
  const raw = build(input), output = preflight(raw);
  assert.equal(raw.isReady, true); assert.equal(output.visualReady, true);
  assert.equal(fit('TITLE', '문화축제').fitStatus, 'ok');
  assert.notEqual(output.payload, raw.payload); assert.notEqual(output.payload.data.MAIN_IMAGE, raw.payload.data.MAIN_IMAGE);
  assert.deepEqual(output.payload.data.MAIN_IMAGE, raw.payload.data.MAIN_IMAGE);
  assert.equal(output.fields.find(f => f.field === 'TITLE').provenance.source, 'article.title');
  assert.equal(output.fields.find(f => f.field === 'CTA').provenance.linkId, 'cta');
});
test('long title overflow preserves full original copy, including unbroken words', () => {
  for (const text of ['가을빛으로 물드는 도심,\n2026 시민문화축제 개최', '아주긴행사제목문구입니다']) {
    const result = fit('TITLE', text); assert.equal(result.fitStatus, 'overflow');
    assert.equal(result.originalText, text); assert.equal(result.fittedText, text); assert.equal(result.changed, false);
  }
});
test('factual date/place overflow is detected without changing facts or hiding administrative information', () => {
  for (const [field, text] of [['EVENT_DATE', '2026년 10월 25일 10:00~18:00'], ['EVENT_PLACE', '시청광장 및 시민문화회관 대강당 입구']]) {
    const r = fit(field, text); assert.equal(r.fitStatus, 'overflow'); assert.equal(r.fittedText, text); assert.equal(r.strategy, 'manual_fit_required');
  }
});
test('long summary overflows and CTA enforces one line and width without truncation', () => {
  assert.equal(fit('EVENT_SUMMARY', '시민을 위한 매우 중요한 안내입니다. '.repeat(12)).fitStatus, 'overflow');
  assert.equal(fit('CTA', '행사 일정 확인').fitStatus, 'ok');
  assert.equal(fit('CTA', '행사 일정과 장소 및 신청 방법 자세히 확인').fitStatus, 'ok');
  for (const text of ['행사\n일정 확인', '행사 일정과 장소 및 신청 방법 자세히 확인 행사 일정과 장소 및 신청 방법 자세히 확인']) {
    const r = fit('CTA', text); assert.equal(r.fitStatus, 'overflow'); assert.equal(r.fittedText, text);
  }
});
test('line-ending adjustment is auditable; no factual shortening or manual newline removal', () => {
  const r = fit('TITLE', '문화\r\n축제');
  assert.equal(r.fitStatus, 'adjusted'); assert.equal(r.originalText, '문화\r\n축제');
  assert.equal(r.fittedText, '문화\n축제'); assert.equal(r.changed, true); assert.equal(r.strategy, 'normalize_line_endings');
  assert.equal(fit('EVENT_PLACE', '시청\n중앙\n광장').fitStatus, 'overflow');
});
test('actual E2E copy remains data-ready but visually blocked with no executable fitted payload', () => {
  const raw = build({ ...input, article: { ...article, title: '가을빛으로 물드는 도심, 2026 시민문화축제 개최',
    summary: '시민이 함께 만드는 지역 대표 문화행사가 오는 10월 25일 시청광장에서 열립니다. 공연·체험·전시·가족 프로그램이 하루 동안 이어지며, 누구나 무료로 참여할 수 있습니다.',
    publicInfo: { dateTime: '2026년 10월 25일 10:00~18:00', place: '시청광장' }, links: [{ ...article.links[0], label: '행사 일정 확인' }] } });
  const r = preflight(raw); assert.equal(r.isReady, true); assert.equal(r.visualReady, false); assert.equal(r.payload, null);
  for (const f of ['TITLE', 'EVENT_DATE', 'EVENT_SUMMARY']) assert.equal(r.fields.find(x => x.field === f).fitStatus, 'overflow');
  assert.equal(r.fields.find(x => x.field === 'EVENT_PLACE').fitStatus, 'ok');
});
test('source article/raw payload hashes unchanged; deterministic and no provider calls', () => {
  const raw = build(input), hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const articleHash = hash(input), rawHash = hash(raw), originalFetch = global.fetch;
  global.fetch = () => { throw Error('No API calls allowed'); };
  try { assert.deepEqual(preflight(raw), preflight(raw)); } finally { global.fetch = originalFetch; }
  assert.equal(hash(input), articleHash); assert.equal(hash(raw), rawHash);
});
test('unsupported/mismatched templates, missing fields and tampered text fail closed', () => {
  const raw = build(input);
  for (const patch of [{ templateId: 'event_festival_01' }, { canvaBrandTemplateId: 'OTHER' }, { isReady: false },
    { payload: null }, { missingFields: [{ field: 'MAIN_IMAGE' }] }, { textFields: {} },
    { payload: { ...raw.payload, data: { ...raw.payload.data, CTA: { type: 'text', text: 'changed' } } } }]) {
    const result = preflight({ ...raw, ...patch }); assert.equal(result.visualReady, false); assert.equal(result.payload, null);
  }
});
test('invalid/control/empty inputs overflow; explicit field allowlist and emoji width are conservative', () => {
  for (const text of ['', ' ', '문화\t축제', '문화\u2028축제', '🙂'.repeat(10)]) assert.equal(fit('TITLE', text).fitStatus, 'overflow');
  assert.throws(() => fit('UNKNOWN', 'value'));
  assert.throws(() => fit('toString', 'value'));
  assert.equal(fit('TITLE', '가').explicitLines, 1);
});
test('actual Canva short/medium/long/boundary observations set visualReady without modifying display inputs', () => {
  const observations = require('./fixtures/canva-content-fit-calibration.json');
  for (const sample of Object.values(observations.samples)) {
    const raw = build(input);
    for (const [field, text] of Object.entries(sample.values)) {
      raw.textFields[field] = { ...raw.textFields[field], text };
      raw.payload.data[field] = { type: 'text', text };
    }
    const snapshot = JSON.stringify(raw), result = preflight(raw);
    assert.equal(result.visualReady, sample.visualReady);
    assert.equal(JSON.stringify(raw), snapshot);
  }
  assert.equal(fit('EVENT_SUMMARY', observations.samples.boundary.values.EVENT_SUMMARY).fitStatus, 'overflow');
  assert.equal(fit('CTA', observations.samples.long.values.CTA).fitStatus, 'ok');
});
test('calibration counts are exact observed code-point counts, not inferred maximum capacities', () => {
  const observations = require('./fixtures/canva-content-fit-calibration.json');
  const count = text => Array.from(text).length;
  for (const field of ['TITLE', 'EVENT_DATE', 'EVENT_PLACE', 'EVENT_SUMMARY']) {
    assert.equal(calibration[field].safeChars, count(observations.samples.medium.values[field]));
    assert.equal(calibration[field].safeLines, observations.samples.medium.observedLines[field]);
    assert.equal(calibration[field].overflowObservedAt, count(observations.samples.long.values[field]));
  }
  assert.equal(calibration.EVENT_SUMMARY.borderlineChars, count(observations.samples.boundary.values.EVENT_SUMMARY));
  assert.equal(calibration.CTA.safeChars, count(observations.samples.long.values.CTA));
  assert.equal(calibration.CTA.overflowObservedAt, count(observations.samples.boundary.values.CTA));
});
