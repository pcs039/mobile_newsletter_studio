/* eslint-disable @typescript-eslint/no-require-imports -- Pure contracts and installed unavailable provider only; no mock provider or external writes. */
const test = require('node:test'), assert = require('node:assert/strict');
const load = require('./canva-test-loader.cjs')(), a = load('src/lib/adobe-post-processing.ts');
const execution = load('src/lib/adobe-post-processing-execution.ts');
const metadata = load('src/lib/design-asset-metadata.ts');
const { renderToStaticMarkup } = require('react-dom/server');
const { AdobePostProcessingControls } = load('src/components/design/adobe-post-processing-controls.tsx');
const project = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222', resultId = '33333333-3333-4333-8333-333333333333';
const source = { id, projectId: project, assetType: 'reference', name: '기관장 실제 인물 사진', altText: '기관장 인물 사진', usageNote: '실제 인물 사진', metadata: { source: 'institution', usageTags: ['interview'], transparency: 'no' }, language: 'ko', variant: 'primary', approvalStatus: 'approved', isActive: true, mimeType: 'image/png', privateImageVerified: true, updated: '2026-10-15', dimensions: { width: 600, height: 600 } };
const plan = () => a.buildAdobePostProcessingPlan(project, source, 'remove_background');
test('same-project active raster: deterministic immutable plan, draft also usable, archived/deleted not usable', () => {
  const before = JSON.stringify(source), p = plan(); assert(p); assert.equal(p.preserveSource, true); assert.equal(p.humanReviewRequired, true); assert.equal(p.outputFormat, 'png'); assert.deepEqual(p, plan()); assert.equal(JSON.stringify(source), before);
  assert(a.buildAdobePostProcessingPlan(project, { ...source, approvalStatus: 'draft' }, 'remove_background'));
  assert.equal(a.buildAdobePostProcessingPlan(project, { ...source, approvalStatus: 'archived' }, 'remove_background'), null);
});
for (const [name, patch] of Object.entries({ cross_project: { projectId: resultId }, inactive: { isActive: false }, missing_storage: { privateImageVerified: false }, invalid_mime: { mimeType: 'image/svg+xml' }, invalid_id: { id: 'invalid' } })) test(name + ' blocks plan', () => assert.equal(a.buildAdobePostProcessingPlan(project, { ...source, ...patch }, 'remove_background'), null));
test('background removal prefers standalone subjects, not landscape/event/poster or already transparent', () => {
  assert(a.recommendAdobeOperations(project, source).includes('remove_background'));
  for (const description of ['행사 현장 사진', '지역 풍경 사진', '기관장 포스터']) assert(!a.recommendAdobeOperations(project, { ...source, name: description, altText: description, usageNote: description }).includes('remove_background'));
  assert(!a.recommendAdobeOperations(project, { ...source, metadata: { ...source.metadata, transparency: 'yes' } }).includes('remove_background'));
  assert(a.recommendAdobeOperations(project, { ...source, name: '마스코트 캐릭터', altText: '캐릭터', usageNote: '' }).includes('remove_background'));
});
test('upscale only explicit insufficient dimensions; unknown/high resolution not recommended', () => {
  const target = { targetWidth: 1024, targetHeight: 1280 };
  assert(a.recommendAdobeOperations(project, source, target).includes('upscale'));
  assert(!a.recommendAdobeOperations(project, { ...source, dimensions: undefined }, target).includes('upscale'));
  assert(!a.recommendAdobeOperations(project, { ...source, dimensions: { width: 2048, height: 2560 } }, target).includes('upscale'));
});
test('extend needs explicit crop risk and measured ratio mismatch, never invents dimensions', () => {
  const target = { targetWidth: 1024, targetHeight: 1280, cropWouldCutSubject: true };
  assert(a.recommendAdobeOperations(project, source, target).includes('extend_canvas'));
  assert(!a.recommendAdobeOperations(project, source, { ...target, cropWouldCutSubject: false }).includes('extend_canvas'));
  assert(!a.recommendAdobeOperations(project, { ...source, dimensions: { width: 1024, height: 1280 } }, target).includes('extend_canvas'));
});
test('parameters reject arbitrary keys, invalid targets and unimplemented operations', () => {
  for (const [operation, parameters] of [['retouch', {}], ['upscale', {}], ['extend_canvas', { targetWidth: 100000, targetHeight: 1280 }], ['remove_background', { token: 'SECRET' }]]) assert.equal(a.buildAdobePostProcessingPlan(project, source, operation, parameters), null);
});
test('stable key reflects source metadata/parameters/version without raw credential/path/url', async () => {
  const key = await a.buildAdobeProcessingKey(project, source, plan()); assert.match(key, /^[a-f0-9]{64}$/); assert.equal(key, await a.buildAdobeProcessingKey(project, { ...source }, plan()));
  const secret = { ...source, token: 'SECRET', storagePath: 'private/SECRET.png', signedUrl: 'https://private.test/SECRET', adobeCredential: 'SECRET' };
  assert.equal(key, await a.buildAdobeProcessingKey(project, secret, plan())); assert(!JSON.stringify(a.adobeSafeSourceSnapshot(secret)).includes('SECRET'));
  assert.notEqual(key, await a.buildAdobeProcessingKey(project, { ...source, metadata: { ...source.metadata, transparency: 'unknown' } }, plan()));
  const p = a.buildAdobePostProcessingPlan(project, source, 'upscale', { targetWidth: 1024, targetHeight: 1280 });
  assert.notEqual(key, await a.buildAdobeProcessingKey(project, source, p));
});
test('capability availability requires both verified entitlement and ready adapter; installed provider cannot execute', async () => {
  assert(Object.values(a.getAdobeCapabilities()).every(c => !c.available));
  assert(!a.getAdobeCapabilities({ remove_background: { entitlementVerified: true, adapterReady: false } }).remove_background.available);
  assert(!a.getAdobeCapabilities({ remove_background: { entitlementVerified: false, adapterReady: true } }).remove_background.available);
  assert(a.getAdobeCapabilities({ remove_background: { entitlementVerified: true, adapterReady: true } }).remove_background.available);
  const provider = load('src/lib/design-processing/adobe-post-processing-provider.ts').getAdobePostProcessingProvider();
  assert(Object.values(provider.getCapabilities()).every(c => !c.available)); assert.equal((await provider.execute(plan())).status, 'unavailable');
});
test('unavailable execution never calls fetch, mutates source or produces a fake asset/job', async () => {
  const fetch = global.fetch, before = JSON.stringify(source); global.fetch = () => { throw Error('unexpected provider/DB/Storage request'); };
  try { const r = await execution.executeAdobePostProcessing({ projectId: project, source, operation: 'remove_background', expectedKey: await a.buildAdobeProcessingKey(project, source, plan()) }); assert.equal(r.status, 'unavailable'); assert.equal(r.assetId, undefined); assert.equal(JSON.stringify(source), before); } finally { global.fetch = fetch; }
});
test('changed/inactive source invalidates execution before provider; fresh receipt ownership enforced', async () => {
  const key = await a.buildAdobeProcessingKey(project, source, plan());
  assert.equal((await execution.executeAdobePostProcessing({ projectId: project, source: { ...source, updated: '2026-10-16' }, operation: 'remove_background', expectedKey: key })).status, 'conflict');
  assert.equal((await execution.executeAdobePostProcessing({ projectId: project, source: { ...source, isActive: false }, operation: 'remove_background', expectedKey: key })).status, 'invalid_source');
  assert.equal(a.adobeReceiptPolicy({ projectId: resultId, sourceAssetId: id, processingKey: key, status: 'success', assetId: resultId }, project, id, key), 'conflict');
});
test('receipt policy reuses success and never retries processing/unknown/failed', async () => {
  const key = await a.buildAdobeProcessingKey(project, source, plan()), base = { projectId: project, sourceAssetId: id, processingKey: key };
  const fetch = global.fetch; global.fetch = () => { throw Error('automatic retry'); };
  try {
    for (const [status, expected] of [['success', 'success'], ['in_progress', 'in_progress'], ['unknown', 'unknown'], ['failed', 'failed']]) {
      const r = await execution.executeAdobePostProcessing({ projectId: project, source, operation: 'remove_background', expectedKey: key, receipt: { ...base, status, assetId: resultId } }); assert.equal(r.status, expected); if (status === 'success') { assert.equal(r.assetId, resultId); assert.equal(r.duplicate, true); }
    }
  } finally { global.fetch = fetch; }
});
test('new result contract has strict adobe provenance, draft, source preserved; FK only source_design', async () => {
  const p = plan(), key = await a.buildAdobeProcessingKey(project, source, p), before = JSON.stringify(source);
  const row = await a.buildAdobeResultRegistration(project, source, p, key, resultId);
  assert.equal(row.id, resultId); assert.equal(row.parent_source_asset_id, null); assert.equal(row.metadata.adobeProcessing.sourceAssetId, id); assert.equal(row.metadata.source, 'adobe'); assert.equal(row.approval_status, 'draft'); assert(row.is_active); assert(metadata.validateDesignAssetMetadata(row.metadata).ok); assert.equal(JSON.stringify(source), before);
  const editable = { ...source, assetType: 'source_design' }, editablePlan = a.buildAdobePostProcessingPlan(project, editable, 'remove_background'), editableKey = await a.buildAdobeProcessingKey(project, editable, editablePlan);
  assert.equal((await a.buildAdobeResultRegistration(project, editable, editablePlan, editableKey, resultId)).parent_source_asset_id, id);
  await assert.rejects(a.buildAdobeResultRegistration(project, source, p, key, id)); await assert.rejects(a.buildAdobeResultRegistration(project, { ...source, updated: '2026-10-16' }, p, key, resultId));
  assert(!metadata.validateDesignAssetMetadata({ ...row.metadata, adobeProcessing: { ...row.metadata.adobeProcessing, token: 'SECRET' } }).ok);
  assert(!metadata.validateDesignAssetMetadata({ ...row.metadata, source: 'openai' }).ok); assert(metadata.validateDesignAssetMetadata(null).ok);
});
test('compact UI keeps all three unavailable buttons disabled without network/event handler or private paths', () => {
  const markup = renderToStaticMarkup(AdobePostProcessingControls({ asset: { ...source, storageBucket: 'design-production-assets', storagePath: 'private/SECRET.png', externalUrl: '' } }));
  assert(markup.includes('Adobe 후처리')); assert(markup.includes('현재 Adobe 자동 처리 연결을 확인 중입니다.')); assert.equal((markup.match(/disabled=""/g) || []).length, 3); assert(!markup.includes('SECRET')); assert(markup.includes('자동 승인·기사 적용은 하지 않습니다.'));
  assert.equal(AdobePostProcessingControls({ asset: { ...source, mimeType: 'application/pdf' } }), null);
});
test('server source reader checks same-project private bucket, object and MIME without exposing private reference', async () => {
  const loader = require('./canva-test-loader.cjs'), oldFetch = global.fetch, oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'SECRET'; let selected = { ...source, storageBucket: 'design-production-assets', storagePath: project + '/SECRET.png', externalUrl: '' }, isPublic = false, objectStatus = 200, calls = [];
  const read = loader({ '@/lib/newsletter-repository': { getProjectDesignAssets: async () => ({ ok: true, assets: [selected] }) }, '@/lib/supabase-config': { getSupabaseStorageEndpoint: path => 'https://storage.test' + path } })('src/lib/design-processing/adobe-source.ts').readAdobePostProcessingSource;
  global.fetch = async (url, options) => { calls.push(options.method || 'GET'); return url.includes('/bucket/') ? Response.json({ public: isPublic }) : new Response(null, { status: objectStatus, headers: { 'Content-Type': 'image/png' } }); };
  try {
    const r = await read('test', project, id); assert(r.privateImageVerified); assert(!JSON.stringify(r).includes('SECRET')); assert.deepEqual(calls, ['GET', 'HEAD']);
    selected = { ...selected, projectId: resultId }; calls = []; assert.equal(await read('test', project, id), null); assert.equal(calls.length, 0);
    selected = { ...selected, projectId: project }; isPublic = true; assert.equal(await read('test', project, id), null);
    isPublic = false; objectStatus = 404; assert.equal(await read('test', project, id), null);
  } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey; }
});
