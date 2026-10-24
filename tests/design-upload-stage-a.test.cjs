/* eslint-disable @typescript-eslint/no-require-imports -- Node isolated contract tests. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateSync } = require('node:zlib');
const { fixture, hash, maxBytes } = require('./fixtures/design-upload-stage-a.cjs');
const load = require('./canva-test-loader.cjs')({ '@/lib/staging-environment': { stagingEnvironmentConfigured: () => false } });
const { validateCanvaPng } = load('src/lib/canva-png-export.ts');
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, body, checksum]);
}
function png(width = 1, height = 1) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))), chunk('IEND', Buffer.alloc(0))]);
}
const actor = { authenticated: true, id: 'qa', origin: 'https://qa.invalid', projects: ['p1'] };
function setup(options = {}, bytes = png()) {
  const f = fixture({ validatePng: validateCanvaPng, decode: async () => {}, ...options });
  const input = { name: 'fixture.png', mime: 'image/png', type: 'background', size: bytes.length, sha256: hash(bytes) };
  const s = f.prepare(actor, 'p1', 'request-0001', input);
  const upload = () => f.upload(s, s.path, bytes);
  return { f, input, s, upload, bytes };
}
test('no anonymous, cross-origin, cross-project or other-owner session access', () => {
  const { f, input, s } = setup();
  for (const [changed, code] of [[{ authenticated: false }, 'unauthenticated'], [{ origin: 'https://evil.invalid' }, 'origin'], [{ projects: [] }, 'project_forbidden']]) {
    assert.throws(() => f.prepare({ ...actor, ...changed }, 'p1', 'request-0002', input), new RegExp(code));
    assert.throws(() => f.result({ ...actor, ...changed }, s.id), new RegExp(code));
  }
  assert.throws(() => f.result({ ...actor, id: 'other' }, s.id), /owner/);
});
test('same request returns same session; changed intent conflicts', () => {
  const { f, input, s } = setup();
  assert.equal(f.prepare(actor, 'p1', 'request-0001', input).id, s.id);
  assert.throws(() => f.prepare(actor, 'p1', 'request-0001', { ...input, type: 'illustration' }), /key_conflict/);
});
test('prepare rejects oversized, empty, unsupported and malformed inputs', () => {
  const { f, input } = setup();
  for (const patch of [{ size: 0 }, { size: maxBytes + 1 }, { name: 'file.svg' }, { mime: 'image/jpeg' }, { type: 'logo' }, { sha256: 'bad' }]) {
    assert.throws(() => f.prepare(actor, 'p1', 'request-0002', { ...input, ...patch }));
  }
});
test('server paths ignore supplied bucket/path and prohibit overwrite', () => {
  const { f, input, bytes } = setup();
  const s = f.prepare(actor, 'p1', 'request-0002', { ...input, path: '../existing', bucket: 'public', approval: 'approved' });
  assert.match(s.path, /^projects\/p1\/design-upload-v1\/[a-f0-9-]+\/input.png$/);
  assert.throws(() => f.upload(s, '../existing', bytes), /path/);
  f.upload(s, s.path, bytes); assert.throws(() => f.upload(s, s.path, bytes), /overwrite/);
});
test('missing/incomplete upload is retryable and never registers an asset', async () => {
  const { f, s, upload } = setup();
  await assert.rejects(f.finalize(actor, s.id), /not_uploaded/);
  assert.equal(f.db.assets.size, 0); upload(); await f.finalize(actor, s.id);
  assert.equal(f.db.assets.size, 1);
});
for (const mode of ['size', 'mime', 'hash', 'signature', 'resolution', 'decode']) {
  test(`actual ${mode} failure cannot register`, async () => {
    const bytes = mode === 'signature' ? Buffer.from('not a png') : mode === 'resolution' ? png(25001) : png();
    const { f, s, upload } = setup(mode === 'decode' ? { decode: async () => { throw new Error('decode'); } } : {}, bytes);
    upload(); const object = f.objects.get(s.path);
    if (mode === 'size') object.bytes = Buffer.concat([object.bytes, Buffer.from('x')]);
    if (mode === 'mime') object.mime = 'text/html';
    if (mode === 'hash') { object.bytes = Buffer.from(object.bytes); object.bytes[40] ^= 1; }
    await assert.rejects(f.finalize(actor, s.id)); assert.equal(f.db.assets.size, 0);
  });
}
test('no decoder configured fails closed', async () => {
  const { f, s, upload } = setup({ decode: undefined }); upload();
  await assert.rejects(f.finalize(actor, s.id), /validator_unavailable/);
});
test('storage success/DB failure resumes without overwriting or double registration', async () => {
  const { f, s, upload } = setup(); upload();
  await assert.rejects(f.finalize(actor, s.id, 'before_commit'), /db_unknown/);
  assert.equal(f.result(actor, s.id).state, 'storage_ready'); assert.equal(f.db.assets.size, 0);
  const stored = f.objects.get(s.target);
  const receipt = await f.finalize(actor, s.id);
  assert.equal(f.objects.get(s.target), stored); assert.equal(receipt.assetId, s.id);
  assert.equal(f.db.assets.size, 1);
});
test('commit response loss recovers receipt, preserves unrelated data and does not autoapprove', async () => {
  const { f, s, upload } = setup(); f.db.assets.set('existing', { unchanged: true }); upload();
  await assert.rejects(f.finalize(actor, s.id, 'after_commit'), /response_lost/);
  assert.deepEqual(f.result(actor, s.id), await f.finalize(actor, s.id));
  assert.deepEqual(f.db.assets.get('existing'), { unchanged: true });
  assert.equal(f.db.assets.get(s.id).approval, 'draft'); assert.equal(f.db.assets.get(s.id).active, false);
});
test('duplicate finalize is blocked while verification runs; GC cannot delete busy session', async () => {
  let release; let now = 0;
  const { f, s, upload } = setup({ clock: () => now, decode: () => new Promise(resolve => { release = resolve; }) }); upload();
  const pending = f.finalize(actor, s.id);
  await assert.rejects(f.finalize(actor, s.id), /in_progress/);
  now = 8000; assert.equal(f.collect(s.id), false); release(); await pending;
  assert.equal(f.collect(s.id), false);
});
test('expired intent does not revoke Storage capability; GC waits for capability plus grace', async () => {
  let now = 0; const { f, s, upload } = setup({ clock: () => now });
  now = 1801; upload(); await assert.rejects(f.finalize(actor, s.id), /expired/);
  assert.equal(f.collect(s.id), false); now = 7500; assert.equal(f.collect(s.id), true);
  assert.equal(f.objects.size, 0); assert.throws(upload, /capability_expired/);
});
test('retry after registered asset lifecycle change never recreates or reactivates it', async () => {
  const { f, s, upload } = setup(); upload(); await f.finalize(actor, s.id);
  f.db.assets.delete(s.id);
  assert.equal((await f.finalize(actor, s.id)).exists, false); assert.equal(f.db.assets.size, 0);
  assert.equal(f.collect(s.id), false); // Registered retention requires separate deletion workflow.
});
test('unexpected final object mismatch is quarantined instead of overwritten', async () => {
  const { f, s, upload } = setup(); upload(); f.objects.set(s.target, { bytes: Buffer.from('unrelated') });
  await assert.rejects(f.finalize(actor, s.id), /target_conflict/); assert.equal(f.db.assets.size, 0);
});
test('same bytes with different request keys are not silently merged across assets', () => {
  const { f, s, input } = setup(); const other = f.prepare(actor, 'p1', 'request-0002', input);
  assert.notEqual(s.id, other.id); assert.notEqual(s.path, other.path);
});
