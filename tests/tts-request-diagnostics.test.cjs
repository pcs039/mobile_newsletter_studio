/* eslint-disable @typescript-eslint/no-require-imports -- Local mock fetch/streams only; never reads live credentials. */
const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./canva-test-loader.cjs');
const load = loader();
const { createTtsDiagnostics, SpeechRequestError, traceTtsStep } = load('src/lib/tts-request-diagnostics.ts');
const { requestOpenAiSpeech } = load('src/lib/article-tts-audio.ts');
const secret = 'scoped-fixture-key';
const script = '비공개 원문을 절대 로그에 기록하지 않습니다.';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function trace() {
  const events = [];
  let time = 0;
  const diagnostics = createTtsDiagnostics(e => events.push(e), () => (time += 5));
  return { events, diagnostics };
}
async function mocked(fetch, run) {
  const previous = global.fetch;
  global.fetch = fetch;
  try { return await run(); } finally { global.fetch = previous; }
}
function options(diagnostics, extra = {}) {
  return { apiKey: secret, captureReceipt: true, maxBytes: 2000, diagnostics, ...extra };
}
function interrupted(error) {
  let pulls = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (pulls++ === 0) controller.enqueue(new Uint8Array([1, 2, 3]));
    else controller.error(error);
  } }), { headers: { 'x-request-id': 'req_body_received' } });
}
function noSecrets(events) {
  const encoded = JSON.stringify(events);
  for (const excluded of [secret, script, 'Authorization', 'Bearer', 'Cookie', 'private-byte-payload']) {
    assert(!encoded.includes(excluded));
  }
  const allowed = ['version','clientRequestId','phase','state','elapsedMs','durationMs','httpStatus','providerRequestId','failure','inputCharacters','receivedBytes','receivedChunks','lastByteElapsedMs'];
  for (const e of events) {
    assert(Object.keys(e).every(key => allowed.includes(key)));
    assert(uuid.test(e.clientRequestId));
    assert(e.durationMs >= 0 && e.elapsedMs >= 0);
  }
}

test('unique client request IDs are sent once and match sanitized correlated events', async () => {
  const ids = [];
  await mocked(async (_url, init) => {
    ids.push(init.headers['X-Client-Request-Id']);
    return new Response(new Uint8Array([1,2,3]), { headers: { 'x-request-id': 'req_success' } });
  }, async () => {
    for (let i=0;i<2;i++) {
      const t = trace();
      const result = await requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(t.diagnostics));
      assert.equal(result.ok,true);
      assert.equal(result.providerRequestId,'req_success');
      assert.equal(ids[i],t.diagnostics.clientRequestId);
      assert.deepEqual(t.events.map(e=>`${e.phase}:${e.state}`),[
        'request:started','headers:started','headers:completed','body:started','body:completed','request:completed',
      ]);
      assert(t.events.find(e=>e.phase==='body'&&e.state==='completed').durationMs>0);
      assert.equal(t.events.at(-1).httpStatus,200);
      noSecrets(t.events);
    }
  });
  assert.notEqual(ids[0],ids[1]);
});

test('legacy calls receive unique tracing headers without opt-in logging or changing result shape', async () => {
  const ids=[];
  await mocked(async(_url,init)=>{
    ids.push(init.headers['X-Client-Request-Id']);
    return new Response(new Uint8Array([1]));
  }, async()=>{
    for(let i=0;i<2;i++) {
      const r=await requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',{apiKey:secret});
      assert.deepEqual(Object.keys(r).sort(),['data','ok']);
    }
  });
  assert(ids.every(id=>uuid.test(id))); assert.notEqual(ids[0],ids[1]);
});

for (const [name,error,failure] of [
  ['timeout',new DOMException(secret,'TimeoutError'),'timeout'],
  ['network',new TypeError(secret),'network'],
  ['abort',new DOMException(secret,'AbortError'),'aborted'],
]) test(`${name} before headers is classified without raw error content or a retry`,async()=>{
  const t=trace();let calls=0;
  await mocked(async()=>{calls++;throw error;},async()=>{
    await assert.rejects(requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(t.diagnostics)),e=>{
      assert(e instanceof SpeechRequestError);assert.equal(e.failure,failure);assert.equal(e.phase,'headers');
      assert.equal(e.httpStatus,null);assert.equal(e.providerRequestId,null);assert(!e.message.includes(secret));return true;
    });
  });
  assert.equal(calls,1);assert.equal(t.events.at(-1).failure,failure);noSecrets(t.events);
});

for (const [name,error,failure] of [
  ['body interruption',new TypeError(`${secret} private-byte-payload`),'body_read'],
  ['body timeout',new DOMException(secret,'TimeoutError'),'timeout'],
]) test(`${name} retains HTTP 200 and received request ID`,async()=>{
  const t=trace();let calls=0;
  await mocked(async()=>{calls++;return interrupted(error);},async()=>{
    await assert.rejects(requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(t.diagnostics)),e=>{
      assert.equal(e.failure,failure);assert.equal(e.phase,'body');assert.equal(e.httpStatus,200);
      assert.equal(e.providerRequestId,'req_body_received');assert.equal(e.clientRequestId,t.diagnostics.clientRequestId);return true;
    });
  });
  assert.equal(calls,1);
  assert(!t.events.some(e=>e.phase==='body'&&e.state==='completed'));
  assert.equal(t.events.at(-1).providerRequestId,'req_body_received');noSecrets(t.events);
});

test('actual abort signal reason distinguishes timeout from a generic fetch error',async()=>{
  const t=trace(),controller=new AbortController();
  await mocked(async(_url,init)=>{
    assert.equal(init.signal,controller.signal);
    controller.abort(new DOMException(secret,'TimeoutError'));throw new TypeError(secret);
  },async()=>{
    await assert.rejects(requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(t.diagnostics,{signal:controller.signal})),e=>e.failure==='timeout');
  });noSecrets(t.events);
});

test('body limit and missing body are distinct safe failures with retained headers',async()=>{
  for(const [response,failure,extra] of [
    [new Response(new Uint8Array(100),{headers:{'x-request-id':'req_large'}}),'size_limit',{maxBytes:10}],
    [new Response(null,{headers:{'x-request-id':'req_empty'}}),'invalid_response',{}],
  ]) {
    const t=trace();
    await mocked(async()=>response,async()=>{
      await assert.rejects(requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(t.diagnostics,extra)),e=>e.failure===failure&&e.httpStatus===200);
    });noSecrets(t.events);
  }
});

test('HTTP rejection preserves receipt but never logs provider error text or secret echoes',async()=>{
  const t=trace();let calls=0;
  await mocked(async()=>{calls++;return new Response(`${secret} ${script}`,{status:401,headers:{'x-request-id':'req_rejected'}});},async()=>{
    const r=await requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(t.diagnostics));
    assert.equal(r.ok,false);assert.equal(r.httpStatus,401);assert.equal(r.providerRequestId,'req_rejected');assert.equal(r.detail,undefined);
  });assert.equal(calls,1);assert.equal(t.events.at(-1).failure,'provider_http');noSecrets(t.events);
});

test('key echo in request-ID header is removed from both error and events',async()=>{
  const t=trace(),apiKey='req_secret_key';
  await mocked(async()=>new Response(new ReadableStream({start(c){c.error(Error(apiKey));}}),{headers:{'x-request-id':apiKey}}),async()=>{
    await assert.rejects(requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(t.diagnostics,{apiKey})),e=>e.providerRequestId===null&&!JSON.stringify(e).includes(apiKey));
  });assert(!JSON.stringify(t.events).includes(apiKey));
});

test('diagnostic sink failure cannot cancel a successful request or cause another call',async()=>{
  let calls=0;const diagnostics=createTtsDiagnostics(()=>{throw Error(secret);});
  await mocked(async()=>{calls++;return new Response(new Uint8Array([1]));},async()=>{
    assert.equal((await requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',options(diagnostics))).ok,true);
  });assert.equal(calls,1);
});

test('legacy transport failure preserves the original thrown error',async()=>{
  const original=new TypeError('legacy transport fixture');
  await mocked(async()=>{throw original;},async()=>{
    await assert.rejects(requestOpenAiSpeech(script,'marin','gpt-4o-mini-tts',{apiKey:secret}),e=>e===original);
  });
});

test('tracked DB/Storage failures record stage and duration without serializing exception',async()=>{
  const t=trace();
  await assert.rejects(traceTtsStep(t.diagnostics,'db_complete','database',()=>{throw Error(secret); }));
  assert.equal(t.events.at(-1).phase,'db_complete');assert.equal(t.events.at(-1).failure,'database');
  assert(t.events.at(-1).durationMs>0);noSecrets(t.events);
});

test('body inactivity stops once, retaining byte counts and the last receive time without partial audio', async()=>{
  const t=trace();let calls=0,cancelled=false;
  await mocked(async()=>{calls++;return new Response(new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array([1,2,3]));},
    cancel(){cancelled=true;},
  }),{headers:{'x-request-id':'req_idle'}});},async()=>{
    await assert.rejects(requestOpenAiSpeech(script,'coral','gpt-4o-mini-tts',options(t.diagnostics,{bodyIdleTimeoutMs:10})),e=>e.failure==='timeout'&&e.phase==='body'&&e.httpStatus===200);
  });
  assert.equal(calls,1);assert(cancelled);
  const event=t.events.at(-1);
  assert.equal(event.inputCharacters,script.length);assert.equal(event.receivedBytes,3);
  assert.equal(event.receivedChunks,1);assert(event.lastByteElapsedMs>0);noSecrets(t.events);
});
