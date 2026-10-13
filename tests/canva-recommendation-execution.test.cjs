/* eslint-disable @typescript-eslint/no-require-imports -- Existing isolated TS test harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const loader = require('./canva-test-loader.cjs');
const pure = loader();
const { digest } = pure('src/lib/canva-connect-contract.ts');
const { buildCanonicalCanvaAutofillPayload: build } = pure('src/lib/canva-autofill-payload.ts');
const { canProduceCanva, canvaEditLink, canvaExecutionMessage } = pure('src/lib/canva-recommendation-execution.ts');
const articleId = '00000000-0000-4000-8000-000000000001', requestKey = '00000000-0000-4000-8000-000000000002';
const project = { id: 'project', slug: 'test', title: '소식지', issue: '10월호' };
const values = require('./fixtures/canva-content-fit-calibration.json').samples.short.values;
const article = { id: articleId, title: values.TITLE, summary: values.EVENT_SUMMARY, body: '원문', articleType: 'event_festival', blocks: [],
  publicInfo: { dateTime: values.EVENT_DATE, place: values.EVENT_PLACE }, links: [{ id: 'cta', isVisible: true, label: values.CTA }] };
const upload = { sourceAssetId: 'asset', sourceHash: 'a'.repeat(64), status: 'success', jobId: 'UPLOAD', assetId: 'IMAGE' };
function setup(options = {}) {
  let saved = { ...article, ...options.article };
  const row = { access_token: 'NOT_OUTPUT', refresh_token: 'NOT_OUTPUT', expires_at: '2099-01-01', execution: { backgroundUpload: upload, ...options.execution } };
  const calls = [];
  const json = (value, status = 200) => Response.json(value, { status });
  const load = loader({
    '@/lib/canva-api-access': { canvaJson: json, canvaFailure: e => json({ ok: false, message: e.message }, e.status ?? 502), sameOrigin() { if (options.csrf) throw Error('CSRF'); },
      canvaAdmin: async () => options.anon ? { ok: false, response: json({}, 403) } : { ok: true, project, user: { id: 'admin' } } },
    '@/lib/staging-environment': { stagingRequestAllowed: () => !options.preview, requireStagingE2E() { if (options.preview) throw Error('STAGING'); } },
    '@/lib/newsletter-repository': { getProjectContent: async () => ({ source: 'supabase', articles: options.crossProject ? [] : [saved] }) },
    '@/lib/canva-connection-repository': { getConnection: async () => options.disconnected ? null : row },
    '@/lib/canva-background-repository': { readCanvaBackground: async (p, id) => { assert.equal(p, project.id); assert.equal(id, upload.sourceAssetId); if (options.invalidAsset) throw Error('revoked'); return { id, hash: upload.sourceHash }; } },
    '@/lib/canva-confirmation': { createCanvaConfirmation: digest, verifyCanvaConfirmation: (confirmation, binding) => confirmation === digest(binding) },
    '@/lib/canva-autofill-execution': { executeCanonicalCanvaAutofill: async (req, input) => { calls.push(input); return { ok: true, status: options.pending ? 'in_progress' : 'created', editUrl: 'https://www.canva.com/design/D/edit', duplicate: !!options.duplicate }; } },
  });
  const post = load('src/app/api/canva/recommendation-execution/route.ts').POST;
  const run = async patch => { const response = await post(new Request('https://canva-staging.datadiction.co.kr/api/canva/recommendation-execution', { method: 'POST', body: JSON.stringify({ action: 'prepare', projectSlug: 'test', articleId, templateId: 'event_festival_02', ...patch }) })); return { status: response.status, value: await response.json() }; };
  return { run, row, calls, change: patch => { saved = { ...saved, ...patch }; } };
}
test('supported safe saved payload is prepared read-only, redacted and only explicit execute calls adapter', async () => {
  const c = setup(), snapshot = JSON.stringify([article, c.row]); const ready = (await c.run()).value;
  assert(canProduceCanva(ready)); assert.equal(c.calls.length, 0); assert.equal(JSON.stringify([article, c.row]), snapshot);
  assert(!JSON.stringify(ready).includes('NOT_OUTPUT')); assert(!JSON.stringify(ready).includes('IMAGE')); assert(!JSON.stringify(ready).includes(article.title));
  assert.equal((await c.run({ action: 'execute', requestKey, confirmation: ready.confirmation })).value.status, 'created');
  assert.equal(c.calls.length, 1); assert.equal(c.calls[0].prepared.payload.data.MAIN_IMAGE.asset_id, 'IMAGE');
});
test('unsafe / missing input never reaches adapter and exposes field IDs only', async () => {
  const c = setup({ article: { title: '매우 긴 제목으로 실제 안전 길이를 초과하는 원문입니다.' } });
  const ready = (await c.run()).value; assert(!canProduceCanva(ready)); assert(ready.visualIssues.some(f => f.field === 'TITLE'));
  const result = (await c.run({ action: 'execute', requestKey })).value;
  assert.equal(result.status, 'visual_not_ready'); assert(!JSON.stringify(result).includes('매우 긴')); assert.equal(c.calls.length, 0);
  const missing = setup({ invalidAsset: true }); assert.deepEqual((await missing.run()).value.missingFields, ['MAIN_IMAGE']);
  assert.equal((await missing.run({ action: 'execute', requestKey })).value.status, 'not_ready'); assert.equal(missing.calls.length, 0);
});
test('unsupported and ordinary Preview stay disabled without connection reads or adapter calls', async () => {
  for (const [options, templateId] of [[{}, 'statistics_performance_02'], [{ preview: true }, 'event_festival_02']]) {
    const c = setup(options), result = (await c.run({ templateId })).value;
    assert(!canProduceCanva(result)); assert.equal(c.calls.length, 0);
    assert.notEqual((await c.run({ action: 'execute', requestKey, templateId })).status, 200);
  }
});
test('admin / project / CSRF / unverified guards block adapter', async () => {
  for (const options of [{ anon: true }, { crossProject: true }, { csrf: true }]) { const c = setup(options); assert.notEqual((await c.run()).status, 200); assert.equal(c.calls.length, 0); }
  const c = setup(); assert.equal((await c.run({ templateId: 'culture_tourism_01' })).status, 400); assert.equal(c.calls.length, 0);
});
test('disconnected Canva reports auth_required and never calls adapter', async () => {
  const c = setup({ disconnected: true }); assert.equal((await c.run()).value.connected, false);
  // Missing upload is independently not-ready; no credentials are manufactured.
  assert.equal((await c.run({ action: 'execute', requestKey })).value.status, 'not_ready'); assert.equal(c.calls.length, 0);
});
test('confirmation rejects changed saved article/hash and absent/forged confirmation', async () => {
  const c = setup(), ready = (await c.run()).value;
  c.change({ summary: '다른 요약' });
  assert.equal((await c.run({ action: 'execute', requestKey, confirmation: ready.confirmation })).status, 409);
  assert.equal((await c.run({ action: 'execute', requestKey, confirmation: 'forged' })).status, 409); assert.equal(c.calls.length, 0);
});
test('poll cannot create with absent, mismatched, failed or sending-only job', async () => {
  for (const execution of [{}, { key: requestKey, job: { status: 'failed' } }, { key: 'other', job: { status: 'in_progress' } }]) {
    const c = setup({ execution }), ready = (await c.run()).value;
    assert.equal((await c.run({ action: 'poll', requestKey, confirmation: ready.confirmation })).status, 409); assert.equal(c.calls.length, 0);
  }
});
test('matching persisted pending/success poll reuses adapter with same key and current input', async () => {
  const raw = build({ templateId: 'event_festival_02', article, project, images: [{ field: 'MAIN_IMAGE', sourceHash: upload.sourceHash, upload,
    asset: { id: 'asset', projectId: project.id, approvalStatus: 'approved', isActive: true, mimeType: 'image/png' } }] });
  for (const status of ['in_progress', 'success']) {
    const c = setup({ execution: { key: requestKey, articleId, templateId: 'event_festival_02', hash: digest(JSON.stringify(raw.payload)), job: { status, id: 'JOB' } } });
    const ready = (await c.run()).value;
    assert.equal((await c.run({ action: 'poll', requestKey, confirmation: ready.confirmation })).value.status, 'created'); assert.equal(c.calls.length, 1);
  }
});
test('result UX separates reuse / auth / dataset / fit; edit URL accepts Canva HTTPS only', () => {
  assert.match(canvaExecutionMessage({ status: 'created', duplicate: true }), /재사용/);
  assert.match(canvaExecutionMessage({ status: 'auth_required' }), /다시 연결/);
  assert.equal(canvaExecutionMessage({ status: 'dataset_mismatch' }), '템플릿 정보를 다시 확인해야 합니다.');
  assert.equal(canvaExecutionMessage({ status: 'visual_not_ready' }), '내용 확인 필요');
  for (const url of ['javascript:alert(1)', 'https://evil.test', 'https://www.canva.com.evil.test/design/D/edit']) assert.equal(canvaEditLink(url), null);
});
