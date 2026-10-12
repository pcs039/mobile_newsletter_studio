/* eslint-disable @typescript-eslint/no-require-imports -- Existing isolated TypeScript test loader. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const load = require('./canva-test-loader.cjs')();
const { buildCanonicalCanvaAutofillPayload: build } = load('src/lib/canva-autofill-payload.ts');
const { getCanonicalCanvaTemplate: get } = load('src/lib/canva-template-registry.ts');
const project = { id: 'p', title: '기관 소식지', issue: '10월호' };
const article = { title: '청년 지원 안내', summary: '기사 요약', body: '지원금은 100만원입니다. 임의 숫자 추출 금지.', articleType: 'welfare_health',
  publicInfo: { target: '청년', period: '10월', method: '온라인 신청', support: '100만원 지원', private: 'SECRET' },
  blocks: [{ id: '00000000-0000-4000-8000-000000000001', type: 'paragraph', isVisible: true, title: '주의', body: '증빙 서류를 확인하세요.', metadata: { body_design: { kind: 'info', tone: 'warning' } } }],
  links: [{ id: 'link', label: '신청하기', isVisible: true, targetValue: 'https://example.org' }], secret: 'SECRET' };
const base = { templateId: 'policy_support_02', article, project };
const image = (field = 'MAIN_IMAGE', overrides = {}) => ({ field, asset: { id: 'asset', projectId: 'p', approvalStatus: 'approved', isActive: true, mimeType: 'image/png', storagePath: 'PRIVATE' }, sourceHash: 'a'.repeat(64), upload: { sourceAssetId: 'asset', sourceHash: 'a'.repeat(64), status: 'success', jobId: 'job', assetId: 'CANVA_IMAGE' }, ...overrides });
const completeMappings = templateId => get(templateId).requiredFields.map(field => ({ field, type: 'text', source: 'article.summary' }));

test('verified canonical ID/external ID resolve identically; needs_republish/unknown/mismatched IDs reject', () => {
  const expected = build(base);
  assert.deepEqual(build({ ...base, templateId: undefined, canvaBrandTemplateId: 'EAHXyEzk03Q' }), expected);
  for (const templateId of ['culture_tourism_01', 'cardnews_02']) assert.throws(() => build({ ...base, templateId }), e => e.status === 409);
  for (const patch of [{ templateId: 'unknown' }, { canvaBrandTemplateId: 'unknown' }, { canvaBrandTemplateId: 'EAHXxK9PTF8' }, { templateId: undefined }]) assert.throws(() => build({ ...base, ...patch }), e => e.status === 400);
});

test('only actual article values populate exact registered text fields with auditable source/IDs', () => {
  const result = build(base);
  assert.deepEqual(Object.keys(result.textFields), get(base.templateId).requiredFields);
  assert.deepEqual(Object.keys(result.imageFields), ['MAIN_IMAGE']);
  for (const [field, source, text] of [
    ['TITLE', 'article.title', article.title], ['SUMMARY', 'article.summary', article.summary],
    ['TARGET', 'publicInfo.target', '청년'], ['PERIOD', 'publicInfo.period', '10월'],
    ['METHOD', 'publicInfo.method', '온라인 신청'], ['SUPPORT_CONTENT', 'publicInfo.support', '100만원 지원'],
    ['NOTICE', 'infoBox.body', '증빙 서류를 확인하세요.'], ['CTA', 'article.links.label', '신청하기'],
  ]) { assert.equal(result.textFields[field].text, text); assert.equal(result.textFields[field].source, source); }
  assert.equal(result.textFields.NOTICE.blockId, article.blocks[0].id);
  assert.equal(result.textFields.CTA.linkId, 'link');
  assert.deepEqual(result.missingFields.map(m => m.field), ['CATEGORY', 'PRIMARY_VALUE', 'MAIN_IMAGE']);
  assert.equal(result.isReady, false); assert.equal(result.payload, null);
  assert(!JSON.stringify(result).includes('SECRET'));
  const recruitment = build({ ...base, article: { ...article, articleType: 'application_recruitment', publicInfo: { benefit: '기존 혜택 값' } } });
  assert.equal(recruitment.textFields.SUPPORT_CONTENT.text, '기존 혜택 값');
  assert.equal(recruitment.textFields.SUPPORT_CONTENT.source, 'publicInfo.benefit');
});

test('unknown fields, source/type mismatch, duplicates and arbitrary source paths cannot enter payload', () => {
  for (const fieldMappings of [
    [{ field: 'INJECTED', type: 'text', source: 'article.title' }],
    [{ field: 'TITLE', type: 'image', source: 'article.primaryImage' }],
    [{ field: 'TITLE', type: 'text', source: 'article.primaryImage' }],
    [{ field: 'TITLE', type: 'text', source: 'private.token' }],
    [{ field: 'TITLE', type: 'text', source: 'article.title' }, { field: 'TITLE', type: 'text', source: 'article.body' }],
  ]) assert.throws(() => build({ ...base, fieldMappings }));
  assert.throws(() => build({ ...base, images: [image('TITLE')] }));
  assert.throws(() => build({ ...base, images: [image(), image()] }));
});

test('approved same-project upload-success image reference produces image asset_id only, never bytes/path/URL', () => {
  const result = build({ ...base, fieldMappings: completeMappings(base.templateId), images: [image()] });
  assert.equal(result.isReady, true);
  assert.deepEqual(result.payload.data.MAIN_IMAGE, { type: 'image', asset_id: 'CANVA_IMAGE' });
  assert.equal(result.imageFields.MAIN_IMAGE.sourceAssetId, 'asset');
  assert(!JSON.stringify(result).includes('PRIVATE'));
  assert.deepEqual(Object.keys(result.payload.data), [...get(base.templateId).requiredFields, 'MAIN_IMAGE']);
  assert(result.textFields.TITLE.type === 'text' && result.imageFields.MAIN_IMAGE.type === 'image');
});

test('missing/pending/stale/invalid image reference blocks readiness without upload or inferred URLs', () => {
  for (const binding of [image(undefined, { upload: undefined }), image(undefined, { upload: { ...image().upload, status: 'in_progress' } })]) {
    const result = build({ ...base, images: [binding] });
    assert.equal(result.imageFields.MAIN_IMAGE.status, 'missing');
    assert(result.missingFields.some(m => m.field === 'MAIN_IMAGE' && m.reason === 'upload_required'));
  }
  for (const binding of [
    image(undefined, { asset: { ...image().asset, projectId: 'other' } }),
    image(undefined, { asset: { ...image().asset, approvalStatus: 'draft' } }),
    image(undefined, { asset: { ...image().asset, isActive: false } }),
    image(undefined, { asset: { ...image().asset, mimeType: 'text/html' } }),
    image(undefined, { upload: { ...image().upload, sourceHash: 'b'.repeat(64) } }),
    image(undefined, { upload: { ...image().upload, sourceAssetId: 'other' } }),
    image(undefined, { upload: { ...image().upload, assetId: 'https://private.example/token' } }),
  ]) { const result = build({ ...base, images: [binding] }); assert.equal(result.imageFields.MAIN_IMAGE.status, 'invalid'); assert.equal(result.isReady, false); assert.equal(result.payload, null); }
});

test('image-less statistics 02 is valid; complete explicit source mappings make a text-only ready payload', () => {
  const templateId = 'statistics_performance_02';
  const missing = build({ ...base, templateId });
  assert.deepEqual(Object.keys(missing.imageFields), []); assert(!missing.missingFields.some(m => m.type === 'image')); assert.equal(missing.isReady, false);
  const ready = build({ ...base, templateId, fieldMappings: completeMappings(templateId) });
  assert.equal(ready.isReady, true); assert.equal(ready.payload.type, 'create_from_brand_template'); assert.equal(ready.payload.brand_template_id, 'EAHXyJwJhts');
  assert(Object.values(ready.payload.data).every(value => value.type === 'text'));
});

test('empty/overlong text remains missing/invalid; title lines derive display title without inventing missing lines', () => {
  const invalid = build({ ...base, article: { ...article, summary: 'x'.repeat(10001) } });
  assert.equal(invalid.textFields.SUMMARY.status, 'invalid'); assert.equal(invalid.payload, null);
  const templateId = 'recruitment_contest_02';
  const short = build({ ...base, templateId });
  assert.equal(short.textFields.TITLE_LINE_1.text, article.title);
  assert.equal(short.textFields.TITLE_LINE_2.status, 'missing'); assert.equal(short.textFields.TITLE_LINE_3.status, 'missing');
  const lines = build({ ...base, templateId, article: { ...article, title: '첫째 줄\n둘째 줄\n셋째 줄' } });
  assert.equal(lines.textFields.TITLE_LINE_2.text, '둘째 줄'); assert.equal(lines.textFields.TITLE_LINE_2.transform, 'title_line_2');
  const blank = build({ ...base, article: { ...article, title: '', summary: '' } });
  assert(blank.missingFields.some(m => m.field === 'TITLE')); assert(blank.missingFields.some(m => m.field === 'SUMMARY'));
});

test('multiple blocks/actions are not silently first-picked; explicit block mapping resolves one existing visible block', () => {
  const second = { ...article.blocks[0], id: '00000000-0000-4000-8000-000000000002', body: '두 번째 안내' };
  const input = { ...base, article: { ...article, blocks: [...article.blocks, second], links: [...article.links, { ...article.links[0], id: 'two', label: '문의하기' }] } };
  const result = build(input); assert.equal(result.textFields.NOTICE.status, 'missing'); assert.equal(result.textFields.CTA.status, 'missing');
  const explicit = build({ ...input, fieldMappings: [{ field: 'NOTICE', type: 'text', source: 'infoBox.body', blockId: second.id }] });
  assert.equal(explicit.textFields.NOTICE.text, '두 번째 안내'); assert.equal(explicit.textFields.NOTICE.blockId, second.id);
  const hidden = build({ ...input, article: { ...input.article, blocks: [{ ...second, isVisible: false }] }, fieldMappings: [{ field: 'NOTICE', type: 'text', source: 'infoBox.body', blockId: second.id }] });
  assert.equal(hidden.textFields.NOTICE.status, 'missing');
});

test('identical input is deterministic, source content unchanged, and all work is synchronous with no provider calls', () => {
  const before = crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
  const old = global.fetch; global.fetch = () => { throw Error('unexpected API request'); };
  try { assert.deepEqual(build(base), build(base)); } finally { global.fetch = old; }
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex'), before);
});
