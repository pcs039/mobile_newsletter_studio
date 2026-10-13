/* eslint-disable @typescript-eslint/no-require-imports -- Existing isolated server module harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const loader = require('./canva-test-loader.cjs');
const pure = loader();
const { buildCanonicalCanvaAutofillPayload: build } = pure('src/lib/canva-autofill-payload.ts');
const { getCanonicalCanvaTemplate: get } = pure('src/lib/canva-template-registry.ts');
const articleId = '00000000-0000-4000-8000-000000000001';
const requestKey = '00000000-0000-4000-8000-000000000002';
const project = { id: 'project', slug: 'test', title: '소식지', issue: '10월호' };
const article = { id: articleId, title: '통계 기사', summary: '실제 기사 요약', body: '기존 본문', articleType: 'general', publicInfo: {}, blocks: [], links: [] };
function prepared(templateId = 'statistics_performance_02', images = []) {
  return build({ templateId, article, project, fieldMappings: get(templateId).requiredFields.map(field => ({ field, type: 'text', source: 'article.summary' })), images });
}
const clone = value => JSON.parse(JSON.stringify(value));
function setup(options = {}) {
  let row = { access_token: 'token-not-output', refresh_token: 'refresh-not-output', expires_at: '2099-01-01T00:00:00Z', execution: null, ...options.row };
  const calls = [], patches = []; let locked = false;
  const update = async patch => { patches.push(clone(patch)); row = { ...row, ...patch }; return row; };
  const context = {};
  const load = loader({
    '@/lib/staging-environment': { requireStagingE2E() { if (options.production) throw new context.Error(403, 'blocked'); } },
    '@/lib/canva-api-access': { sameOrigin() { if (options.csrf) throw new context.Error(403, 'blocked'); }, canvaAdmin: async () => options.anon ? { ok: false } : { ok: true, project, user: { id: 'admin' } } },
    '@/lib/newsletter-repository': { getProjectContent: async () => ({ source: 'supabase', articles: options.crossProject ? [] : [{ ...article, ...options.article }] }) },
    '@/lib/canva-connection-repository': { getConnection: async () => options.disconnected ? null : row, withConnectionLock: async (p, u, action) => {
      assert.equal(p, project.id); assert.equal(u, 'admin');
      if (locked) throw new context.Error(409, 'busy'); locked = true;
      try { return await action(row, update); } finally { locked = false; }
    } },
    '@/lib/canva-background-repository': { readCanvaBackground: async (p, id) => { assert.equal(p, project.id); return { id, hash: options.imageStale ? 'b'.repeat(64) : 'a'.repeat(64) }; } },
    '@/lib/canva-connect-server': { accessToken: async () => { if (options.tokenFailure) throw new context.Error(401, 'PRIVATE'); return 'not-output'; }, connectedCanvaRequest: async (path, token, write, body) => {
      calls.push({ path, ...(body ? { body: clone(body) } : {}) });
      if (path.endsWith('/dataset')) return options.dataset ?? { dataset: Object.fromEntries([...get(options.templateId ?? 'statistics_performance_02').requiredFields.map(field => [field, { type: 'text' }]), ...get(options.templateId ?? 'statistics_performance_02').imageFields.map(field => [field, { type: 'image' }])]) };
      if (path === '/autofills') {
        assert.equal(row.execution.status, 'sending');
        if (options.postFailure) throw new context.Error(options.postFailure, 'SECRET token download URL');
        if (options.delay) await options.delay;
        return { job: { id: 'JOB', status: options.pending ? 'in_progress' : 'success', result: { type: 'create_design', design: { id: 'DESIGN', urls: { edit_url: 'https://www.canva.com/design/DESIGN/edit' } } } } };
      }
      assert.equal(path, '/autofills/JOB');
      return { job: { id: 'JOB', status: 'success', result: { type: 'create_design', design: { id: 'DESIGN', urls: { edit_url: 'https://www.canva.com/design/DESIGN/edit' } } } } };
    } },
  });
  context.Error = load('src/lib/canva-connect-contract.ts').CanvaConnectError;
  const execute = load('src/lib/canva-autofill-execution.ts').executeCanonicalCanvaAutofill;
  const input = { projectSlug: 'test', articleId, requestKey, canvaBrandTemplateId: get(options.templateId ?? 'statistics_performance_02').canvaBrandTemplateId, prepared: prepared(options.templateId) };
  return { run: patch => execute(new Request('https://canva-staging.datadiction.co.kr'), { ...input, ...patch }), calls, patches, row: () => row };
}

test('ready verified payload executes once and returns actual design identifiers; identical replay/new key reuse success', async () => {
  const ctx = setup(); const result = await ctx.run();
  assert.equal(result.status, 'created'); assert.equal(result.canvaDesignId, 'DESIGN'); assert.equal(result.editUrl, 'https://www.canva.com/design/DESIGN/edit');
  assert.equal((await ctx.run()).duplicate, true);
  assert.equal((await ctx.run({ requestKey: '00000000-0000-4000-8000-000000000003' })).duplicate, true);
  assert.equal(ctx.calls.filter(c => c.body).length, 1);
});

function eventFixture(values = require('./fixtures/canva-content-fit-calibration.json').samples.short.values) {
  const templateId = 'event_festival_02';
  const saved = { ...article, title: values.TITLE, summary: values.EVENT_SUMMARY, articleType: 'event_festival',
    publicInfo: { dateTime: values.EVENT_DATE, place: values.EVENT_PLACE }, links: [{ id: 'cta', isVisible: true, label: values.CTA }] };
  const upload = { sourceAssetId: 'asset', sourceHash: 'a'.repeat(64), status: 'success', jobId: 'UPLOAD', assetId: 'IMAGE' };
  const input = build({ templateId, project, article: saved, images: [{ field: 'MAIN_IMAGE', sourceHash: upload.sourceHash,
    asset: { id: 'asset', projectId: project.id, approvalStatus: 'approved', isActive: true, mimeType: 'image/png' }, upload }] });
  const execution = { key: 'old', hash: 'old', articleId, templateId, status: 'uploading', backgroundUpload: upload };
  return { templateId, saved, upload, input, execution };
}
test('data-ready unsafe event input returns redacted visual_not_ready before dataset/POST/credential refresh or writes', async () => {
  const values = require('./fixtures/canva-content-fit-calibration.json').samples.long.values;
  const f = eventFixture(values), ctx = setup({ templateId: f.templateId, article: f.saved, tokenFailure: true, row: { execution: f.execution } });
  assert.equal(f.input.isReady, true);
  const result = await ctx.run({ prepared: f.input });
  assert.equal(result.status, 'visual_not_ready'); assert.equal(result.contentFitStatus, 'blocked');
  assert.deepEqual(result.visualIssues.map(issue => issue.field), ['TITLE', 'EVENT_DATE', 'EVENT_PLACE', 'EVENT_SUMMARY']);
  assert(result.visualIssues.every(issue => issue.fitStatus === 'overflow'));
  assert(!JSON.stringify(result).includes(values.TITLE)); assert(!JSON.stringify(result).includes(values.EVENT_SUMMARY));
  assert.equal(ctx.calls.length, 0); assert.equal(ctx.patches.length, 0);
  assert.equal((await ctx.run({ prepared: { ...f.input, isReady: false } })).status, 'not_ready');
});
test('original E2E TITLE/date/summary are blocked even if caller claims visualReady=true or a saved success exists', async () => {
  const f = eventFixture({ TITLE: '가을빛으로 물드는 도심, 2026 시민문화축제 개최', EVENT_DATE: '2026년 10월 25일 10:00~18:00', EVENT_PLACE: '시청광장',
    EVENT_SUMMARY: '시민이 함께 만드는 지역 대표 문화행사가 오는 10월 25일 시청광장에서 열립니다. 공연·체험·전시·가족 프로그램이 하루 동안 이어지며, 누구나 무료로 참여할 수 있습니다.', CTA: '행사 일정 확인' });
  const digest = pure('src/lib/canva-connect-contract.ts').digest;
  const ctx = setup({ templateId: f.templateId, article: f.saved, row: { execution: { ...f.execution,
    hash: digest(JSON.stringify(f.input.payload)), status: 'success', job: { id: 'JOB', status: 'success', designId: 'OLD' } } } });
  const result = await ctx.run({ prepared: { ...f.input, visualReady: true } });
  assert.equal(result.status, 'visual_not_ready');
  assert.deepEqual(result.visualIssues.map(issue => issue.field), ['TITLE', 'EVENT_DATE', 'EVENT_SUMMARY']);
  assert.equal(ctx.calls.length, 0); assert.equal(ctx.patches.length, 0);
});
test('calibration short and medium event values pass gate; duplicate success adds no POST and preserves receipt/history', async () => {
  const samples = require('./fixtures/canva-content-fit-calibration.json').samples;
  for (const sample of [samples.short, samples.medium]) {
    const f = eventFixture(sample.values), old = { id: 'OLD', status: 'success', designId: 'OLD_DESIGN' };
    const ctx = setup({ templateId: f.templateId, article: f.saved, row: { execution: { ...f.execution, job: old } } });
    const result = await ctx.run({ prepared: f.input });
    assert.equal(result.status, 'created'); assert.equal(result.contentFitStatus, 'passed');
    assert.deepEqual(ctx.row().execution.backgroundUpload, f.upload);
    assert.deepEqual(ctx.row().execution.previousSuccess.job, old);
    assert.equal((await ctx.run({ prepared: f.input })).duplicate, true);
    assert.equal(ctx.calls.filter(call => call.body).length, 1);
  }
});
test('safe event async polling keeps receipt/previousSuccess without a repeated creation', async () => {
  const f = eventFixture(), old = { id: 'OLD', status: 'success', designId: 'OLD_DESIGN' };
  const ctx = setup({ templateId: f.templateId, article: f.saved, pending: true, row: { execution: { ...f.execution, job: old } } });
  assert.equal((await ctx.run({ prepared: f.input })).status, 'in_progress');
  assert.equal((await ctx.run({ prepared: f.input })).status, 'created');
  assert.equal(ctx.calls.filter(c => c.body).length, 1); assert.equal(ctx.calls.filter(c => c.path === '/autofills/JOB').length, 1);
  assert.deepEqual(ctx.row().execution.previousSuccess.job, old); assert.deepEqual(ctx.row().execution.backgroundUpload, f.upload);
});
test('fitted event copy only normalizes CRLF; replay uses unchanged raw source hash and never edits content', async () => {
  const f = eventFixture({ ...require('./fixtures/canva-content-fit-calibration.json').samples.short.values, TITLE: '문화\r\n축제' });
  const snapshot = JSON.stringify(f.saved), ctx = setup({ templateId: f.templateId, article: f.saved, row: { execution: f.execution } });
  assert.equal((await ctx.run({ prepared: f.input })).status, 'created');
  assert.equal(ctx.calls.find(c => c.body).body.data.TITLE.text, '문화\n축제');
  assert.equal(ctx.row().execution.hash, pure('src/lib/canva-connect-contract.ts').digest(JSON.stringify(f.input.payload)));
  assert.equal((await ctx.run({ prepared: f.input })).duplicate, true); assert.equal(ctx.calls.filter(c => c.body).length, 1);
  assert.equal(JSON.stringify(f.saved), snapshot);
});
test('other verified templates keep existing execution and explicit not_supported classification', async () => {
  const ctx = setup();
  assert.equal((await ctx.run()).contentFitStatus, 'not_supported');
  assert.equal((await ctx.run()).duplicate, true);
  assert.equal(ctx.calls.filter(c => c.body).length, 1);
});
test('not_ready, needs_republish, ID mismatch, extra fields and text/image mismatch perform no Canva requests', async () => {
  const base = prepared();
  const variants = [ { ...base, isReady: false }, { ...base, payload: null }, { ...base, templateId: 'cardnews_02' }, { ...base, datasetStatus: 'needs_republish' },
    { ...base, payload: { ...base.payload, brand_template_id: 'OTHER' } }, { ...base, payload: { ...base.payload, data: { ...base.payload.data, EXTRA: { type: 'text', text: 'wrong' } } } },
    { ...base, payload: { ...base.payload, data: { ...base.payload.data, TITLE: { type: 'image', asset_id: 'IMAGE' } } } },
    { ...base, payload: { ...base.payload, data: { ...base.payload.data, TITLE: { type: 'text' } } } }, { ...base, payload: { ...base.payload, data: null } } ];
  for (const value of variants) { const ctx = setup(); assert.equal((await ctx.run({ prepared: value })).status, 'not_ready'); assert.equal(ctx.calls.length, 0); assert.equal(ctx.patches.length, 0); }
  const ctx = setup(); assert.equal((await ctx.run({ canvaBrandTemplateId: 'OTHER' })).status, 'not_ready'); assert.equal(ctx.calls.length, 0);
});
test('live dataset exact field/type mismatch blocks POST and sending writes', async () => {
  const dataset = Object.fromEntries(get('statistics_performance_02').requiredFields.map(field => [field, { type: 'text' }]));
  for (const schema of [{}, { ...dataset, TITLE: { type: 'image' } }, { ...dataset, EXTRA: { type: 'text' } }, Object.fromEntries(Object.entries(dataset).filter(([k]) => k !== 'TITLE'))]) {
    const ctx = setup({ dataset: { dataset: schema } }); assert.equal((await ctx.run()).status, 'dataset_mismatch');
    assert.equal(ctx.calls.length, 1); assert.equal(ctx.patches.length, 0);
  }
});
test('missing admin/Canva auth, changed article, cross-project and Staging/CSRF gates never create', async () => {
  for (const options of [{ anon: true }, { disconnected: true }, { row: { access_token: null } }]) {
    const ctx = setup(options); assert.equal((await ctx.run()).status, 'auth_required'); assert.equal(ctx.calls.length, 0);
  }
  for (const options of [{ crossProject: true }, { article: { summary: '변경됨' } }, { production: true }, { csrf: true }]) {
    const ctx = setup(options); assert.equal((await ctx.run()).ok, false); assert.equal(ctx.calls.length, 0);
  }
  assert.equal((await setup({ tokenFailure: true }).run()).status, 'auth_required');
});
test('API failure is redacted, unknown status is durable, and even a new key cannot blindly retry', async () => {
  const ctx = setup({ postFailure: 504 }); const result = await ctx.run();
  assert.equal(result.status, 'canva_error'); assert(!JSON.stringify(result).includes('SECRET')); assert.equal(ctx.row().execution.status, 'unknown');
  await ctx.run(); await ctx.run({ requestKey: '00000000-0000-4000-8000-000000000003' });
  assert.equal(ctx.calls.filter(c => c.body).length, 1);
});
test('async job returns in_progress, explicit next invocation polls saved job, and never sends a second POST', async () => {
  const ctx = setup({ pending: true }); assert.equal((await ctx.run()).status, 'in_progress');
  assert.equal((await ctx.run()).status, 'created'); assert.equal(ctx.calls.filter(c => c.body).length, 1); assert.equal(ctx.calls.filter(c => c.path === '/autofills/JOB').length, 1);
});
test('request key cannot be reused with different template input; connection lease blocks concurrent creations', async () => {
  const ctx = setup(); await ctx.run();
  const other = prepared('statistics_performance_01', [{ field: 'MAIN_VISUAL', sourceHash: 'a'.repeat(64), asset: { id: 'asset', projectId: 'project', isActive: true, approvalStatus: 'approved', mimeType: 'image/png' }, upload: { sourceAssetId: 'asset', sourceHash: 'a'.repeat(64), status: 'success', jobId: 'UPLOAD', assetId: 'IMAGE' } }]);
  assert.equal((await ctx.run({ prepared: other, canvaBrandTemplateId: other.canvaBrandTemplateId })).ok, false);
  let release; const delay = new Promise(resolve => { release = resolve; });
  const concurrent = setup({ delay }); const first = concurrent.run();
  await new Promise(resolve => setImmediate(resolve)); const second = await concurrent.run(); release(); await first;
  assert.equal(second.status, 'canva_error'); assert.equal(concurrent.calls.filter(c => c.body).length, 1);
});
test('image execution reuses matching durable upload receipt and fresh approved background hash; no new upload', async () => {
  const templateId = 'policy_support_02';
  const upload = { sourceAssetId: 'asset', sourceHash: 'a'.repeat(64), status: 'success', jobId: 'UPLOAD', assetId: 'IMAGE' };
  const input = prepared(templateId, [{ field: 'MAIN_IMAGE', sourceHash: upload.sourceHash, asset: { id: 'asset', projectId: 'project', isActive: true, approvalStatus: 'approved', mimeType: 'image/png' }, upload }]);
  const options = { templateId, row: { execution: { backgroundUpload: upload, status: 'success', key: 'old', hash: 'old', articleId, templateId: 'old' } } };
  const ctx = setup(options); assert.equal((await ctx.run({ prepared: input })).status, 'created');
  assert.deepEqual(ctx.calls.find(c => c.body).body.data.MAIN_IMAGE, { type: 'image', asset_id: 'IMAGE' });
  assert.equal((await setup({ ...options, imageStale: true }).run({ prepared: input })).status, 'not_ready');
  assert.equal((await setup({ templateId }).run({ prepared: input })).status, 'not_ready');
});

function uploadOnlyFixture() {
  const templateId = 'policy_support_02';
  const upload = { sourceAssetId: 'asset', sourceHash: 'a'.repeat(64), status: 'success', jobId: 'UPLOAD', assetId: 'IMAGE' };
  const input = prepared(templateId, [{ field: 'MAIN_IMAGE', sourceHash: upload.sourceHash,
    asset: { id: 'asset', projectId: project.id, isActive: true, approvalStatus: 'approved', mimeType: 'image/png' }, upload }]);
  const execution = { backgroundUpload: upload, status: 'uploading', key: 'old-upload', hash: 'old-upload-hash', articleId, templateId };
  return { templateId, upload, input, execution };
}
test('completed matching upload-only execution reaches live dataset validation without creation or writes', async () => {
  const f = uploadOnlyFixture();
  const ctx = setup({ templateId: f.templateId, row: { execution: f.execution }, dataset: { dataset: {} } });
  assert.equal((await ctx.run({ prepared: f.input })).status, 'dataset_mismatch');
  assert.equal(ctx.calls.length, 1); assert(ctx.calls[0].path.endsWith('/dataset'));
  assert.equal(ctx.calls.filter(c => c.body).length, 0); assert.equal(ctx.patches.length, 0);
});
test('completed upload-only receipt survives mock sending and successful creation; duplicate replay creates nothing', async () => {
  const f = uploadOnlyFixture();
  const ctx = setup({ templateId: f.templateId, row: { execution: f.execution } });
  assert.equal((await ctx.run({ prepared: f.input })).status, 'created');
  const sending = ctx.patches.find(p => p.execution?.status === 'sending');
  assert.deepEqual(sending.execution.backgroundUpload, f.upload);
  assert.deepEqual(ctx.row().execution.backgroundUpload, f.upload);
  assert.equal((await ctx.run({ prepared: f.input })).duplicate, true);
  assert.equal(ctx.calls.filter(c => c.body).length, 1);
});
test('sending, unknown and in_progress background uploads remain blocked before all Canva calls', async () => {
  const f = uploadOnlyFixture();
  for (const status of ['sending', 'unknown', 'in_progress']) {
    const ctx = setup({ templateId: f.templateId, row: { execution: { ...f.execution, backgroundUpload: { ...f.upload, status } } } });
    assert.equal((await ctx.run({ prepared: f.input })).status, 'not_ready');
    assert.equal(ctx.calls.length, 0); assert.equal(ctx.patches.length, 0);
  }
});
test('upload-only receipt asset/source mismatch and stale hash remain blocked', async () => {
  const f = uploadOnlyFixture();
  for (const patch of [{ assetId: 'OTHER' }, { sourceAssetId: 'other-asset' }, { sourceHash: 'b'.repeat(64) }]) {
    const ctx = setup({ templateId: f.templateId, row: { execution: { ...f.execution, backgroundUpload: { ...f.upload, ...patch } } } });
    assert.equal((await ctx.run({ prepared: f.input })).status, 'not_ready');
    assert.equal(ctx.calls.length, 0); assert.equal(ctx.patches.length, 0);
  }
});
test('real sending/unknown Autofill, any retained job and pending PNG import cannot use upload-only exception', async () => {
  const f = uploadOnlyFixture();
  for (const patch of [{ status: 'sending' }, { status: 'unknown' }, { status: 'in_progress' },
    { job: { id: 'OLD', status: 'in_progress' } }, { job: { id: 'OLD', status: 'failed' } },
    ...['sending', 'unknown', 'in_progress', 'ready'].map(status => ({ pngImport: { status } }))]) {
    const ctx = setup({ templateId: f.templateId, row: { execution: { ...f.execution, ...patch } } });
    assert.equal((await ctx.run({ prepared: f.input })).status, 'canva_error');
    assert.equal(ctx.calls.length, 0); assert.equal(ctx.patches.length, 0);
  }
});
test('legacy successful job plus completed upload and new hash preserves flat previousSuccess; replay reuses current job', async () => {
  const f = uploadOnlyFixture();
  const oldJob = { id: 'OLD', status: 'success', designId: 'OLD_DESIGN', editUrl: 'https://www.canva.com/design/OLD_DESIGN/edit' };
  const old = { ...f.execution, job: oldJob, previousSuccess: { key: 'older', job: oldJob } };
  const ctx = setup({ templateId: f.templateId, row: { execution: old } });
  assert.equal((await ctx.run({ prepared: f.input })).status, 'created');
  const expected = { key: old.key, hash: old.hash, articleId: old.articleId, templateId: old.templateId, job: oldJob };
  assert.deepEqual(ctx.patches.find(p => p.execution?.status === 'sending').execution.previousSuccess, expected);
  assert.deepEqual(ctx.row().execution.previousSuccess, expected);
  assert.deepEqual(ctx.row().execution.backgroundUpload, f.upload);
  assert.equal((await ctx.run({ prepared: f.input })).duplicate, true);
  assert.equal(ctx.calls.filter(c => c.body).length, 1);
});
test('same key changed hash and pending/failed job or PNG import cannot archive a legacy execution', async () => {
  const f = uploadOnlyFixture();
  for (const patch of [{ key: requestKey, job: { id: 'OLD', status: 'success' } },
    { job: { id: 'OLD', status: 'in_progress' } }, { job: { id: 'OLD', status: 'failed' } },
    { job: { id: 'OLD', status: 'success' }, pngImport: { status: 'in_progress' } }]) {
    const ctx = setup({ templateId: f.templateId, row: { execution: { ...f.execution, ...patch } } });
    assert.equal((await ctx.run({ prepared: f.input })).ok, false);
    assert.equal(ctx.calls.length, 0); assert.equal(ctx.patches.length, 0);
  }
});
test('image Autofill in_progress job is polled on replay without a second POST and keeps upload receipt', async () => {
  const f = uploadOnlyFixture();
  const ctx = setup({ templateId: f.templateId, pending: true, row: { execution: f.execution } });
  assert.equal((await ctx.run({ prepared: f.input })).status, 'in_progress');
  assert.equal((await ctx.run({ prepared: f.input })).status, 'created');
  assert.equal(ctx.calls.filter(c => c.body).length, 1);
  assert.equal(ctx.calls.filter(c => c.path === '/autofills/JOB').length, 1);
  assert.deepEqual(ctx.row().execution.backgroundUpload, f.upload);
});
