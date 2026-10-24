/* eslint-disable @typescript-eslint/no-require-imports -- Isolated contract model, never imported by the application. */
const { createHash, randomUUID } = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const maxBytes = 10 * 1024 * 1024;
const fail = code => { throw new Error(code); };

// In-memory specification only. This is NOT a durable ledger, Supabase adapter,
// authentication implementation, image decoder or PostgreSQL concurrency test.
function fixture({ validatePng, decode, clock = () => 0, db } = {}) {
  db ||= { sessions: new Map(), requests: new Map(), assets: new Map() };
  const objects = new Map();
  const authorize = (actor, project) => {
    if (!actor?.authenticated) fail('unauthenticated');
    if (actor.origin !== 'https://qa.invalid') fail('origin');
    if (!actor.projects.includes(project)) fail('project_forbidden');
  };
  const owned = (actor, id) => {
    const session = db.sessions.get(id);
    if (!session) fail('not_found');
    authorize(actor, session.project);
    if (session.user !== actor.id) fail('owner');
    return session;
  };
  function prepare(actor, project, requestKey, input) {
    authorize(actor, project);
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(requestKey)) fail('request_key');
    if (!Number.isInteger(input.size) || input.size <= 0 || input.size > maxBytes) fail('size');
    if (!/^[a-f0-9]{64}$/.test(input.sha256) || input.mime !== 'image/png' ||
        !/\.png$/i.test(input.name) || !['background', 'illustration'].includes(input.type)) fail('input');
    // Allowlist ignores client bucket/path/approval/active fields entirely.
    const payload = { name: input.name.normalize('NFC'), size: input.size, sha256: input.sha256,
      mime: input.mime, type: input.type };
    const digest = hash(JSON.stringify(payload));
    const key = JSON.stringify([project, actor.id, requestKey]);
    const prior = db.requests.get(key);
    if (prior) {
      const session = db.sessions.get(prior);
      if (session.digest !== digest) fail('key_conflict');
      return session;
    }
    const id = randomUUID();
    const session = { id, project, user: actor.id, payload, digest, state: 'prepared',
      path: `projects/${project}/design-upload-v1/${id}/input.png`,
      target: `projects/${project}/production/${input.type}/${id}.png`,
      intentExpires: clock() + 30 * 60, capabilityExpires: clock() + 2 * 60 * 60,
      busy: false, receipt: null };
    db.requests.set(key, id); db.sessions.set(id, session);
    return session;
  }
  function upload(session, path, bytes, mime = 'image/png') {
    if (path !== session.path) fail('path');
    if (clock() >= session.capabilityExpires) fail('capability_expired');
    if (objects.has(path)) fail('overwrite');
    objects.set(path, { bytes: Buffer.from(bytes), mime });
  }
  async function finalize(actor, id, fault) {
    const s = owned(actor, id);
    if (s.receipt) return { ...s.receipt, exists: db.assets.has(s.id) };
    if (s.busy) fail('in_progress');
    if (clock() >= s.intentExpires || s.state === 'expired') fail('expired');
    s.busy = true;
    try {
      const object = objects.get(s.path);
      if (!object) fail('not_uploaded');
      if (object.bytes.length !== s.payload.size || object.bytes.length > maxBytes) fail('size');
      if (object.mime !== s.payload.mime) fail('mime');
      if (hash(object.bytes) !== s.payload.sha256) fail('hash');
      if (!validatePng || !decode) fail('validator_unavailable');
      const dimensions = validatePng(object.bytes, object.mime);
      await decode(object.bytes, dimensions); // Injected test probe, NOT real decoding.
      const prior = objects.get(s.target);
      if (prior && hash(prior.bytes) !== s.payload.sha256) fail('target_conflict');
      if (!prior) objects.set(s.target, { ...object, bytes: Buffer.from(object.bytes) });
      s.state = 'storage_ready';
      if (fault === 'before_commit') fail('db_unknown');
      // One synchronous mock commit represents required future DB transaction.
      const asset = { id: s.id, project: s.project, path: s.target, approval: 'draft', active: false };
      db.assets.set(s.id, asset);
      s.receipt = { assetId: s.id, state: 'registered' }; s.state = 'registered';
      if (fault === 'after_commit') fail('response_lost');
      return { ...s.receipt, exists: true };
    } finally { s.busy = false; }
  }
  function result(actor, id) {
    const s = owned(actor, id);
    return s.receipt ? { ...s.receipt, exists: db.assets.has(s.id) } : { state: s.state };
  }
  function collect(id) {
    const s = db.sessions.get(id);
    if (!s || s.busy || s.receipt || db.assets.has(id) || clock() < s.capabilityExpires + 300) return false;
    s.state = 'expired'; objects.delete(s.path); objects.delete(s.target); return true;
  }
  return { db, objects, prepare, upload, finalize, result, collect };
}
module.exports = { fixture, hash, maxBytes };
