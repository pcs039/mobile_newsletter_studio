/* eslint-disable @typescript-eslint/no-require-imports -- Isolated TS modules and synthetic font fixtures. */
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const loader = require('./canva-test-loader.cjs');
const model = loader()('src/lib/font-batch.ts');

// Minimal SFNT metadata fixture, not a redistributed third-party font.
function fixture({ family = 'NanumGothic', subfamily = 'Regular', weight = 400, variable = false, italic = false, format = 'ttf' } = {}) {
  const values = [[1, family], [2, subfamily], [4, family + ' ' + subfamily], [5, 'Version 1.000'], [6, family + '-' + subfamily]];
  const encoded = values.map(([, value]) => { const b = Buffer.from(value, 'utf16le'); return b.swap16(); });
  const names = Buffer.alloc(6 + values.length * 12 + encoded.reduce((sum, b) => sum + b.length, 0));
  names.writeUInt16BE(values.length, 2); names.writeUInt16BE(6 + values.length * 12, 4);
  let offset = 0;
  values.forEach(([id], index) => {
    const pos = 6 + index * 12;
    [3, 1, 0x409, id, encoded[index].length, offset].forEach((n, j) => names.writeUInt16BE(n, pos + j * 2));
    encoded[index].copy(names, 6 + values.length * 12 + offset); offset += encoded[index].length;
  });
  const os2 = Buffer.alloc(96); os2.writeUInt16BE(weight, 4); if (italic) os2.writeUInt16BE(1, 62);
  const maxp = Buffer.alloc(32); maxp.writeUInt32BE(0x10000); maxp.writeUInt16BE(1, 4);
  const tables = { name: names, 'OS/2': os2, maxp };
  if (variable) { const fvar = Buffer.alloc(36); fvar.writeUInt32BE(0x10000); fvar.writeUInt16BE(16, 4); fvar.writeUInt16BE(2, 6); fvar.writeUInt16BE(1, 8); fvar.writeUInt16BE(20, 10); fvar.write('wght', 16); fvar.writeInt32BE(100 * 65536, 20); fvar.writeInt32BE(400 * 65536, 24); fvar.writeInt32BE(900 * 65536, 28); tables.fvar = fvar; }
  const data = Buffer.alloc(12 + Object.keys(tables).length * 16 + Object.values(tables).reduce((sum, b) => sum + Math.ceil(b.length / 4) * 4, 0));
  if (format === 'otf') data.write('OTTO'); else data.writeUInt32BE(0x10000);
  data.writeUInt16BE(Object.keys(tables).length, 4); let start = 12 + Object.keys(tables).length * 16;
  Object.entries(tables).forEach(([name, bytes], index) => { const pos = 12 + index * 16; data.write(name, pos); data.writeUInt32BE(start, pos + 8); data.writeUInt32BE(bytes.length, pos + 12); bytes.copy(data, start); start += Math.ceil(bytes.length / 4) * 4; });
  return data;
}
test('Naver family and weight use filename verified by metadata', () => {
  assert.equal(model.classifyFont(fixture(), 'NanumGothic.ttf').needsConfirmation, false);
  const bold = model.classifyFont(fixture({ subfamily:'Bold', weight:700 }), 'NanumGothicBold.ttf');
  assert.equal(bold.family, 'NanumGothic'); assert.equal(bold.weight,'700'); assert.equal(bold.needsConfirmation,false);
});
test('multiple families remain independent', () => {
  assert.notEqual(model.classifyFont(fixture(), 'NanumGothic.ttf').family, model.classifyFont(fixture({family:'NanumMyeongjo'}), 'NanumMyeongjo.ttf').family);
});
test('Mac decomposed Unicode and Windows directories normalize', () => {
  assert.equal(model.normalizeFontPath('가'.normalize('NFD') + '\\TTF\\font.ttf'), '가/TTF/font.ttf');
});
test('only supported font files; ZIP TTC documents and OS metadata excluded', () => {
  for(const name of ['a.zip','a.ttc','LICENSE.txt','__MACOSX/a.ttf','.DS_Store','._a.ttf']) assert.equal(model.fontFormat(name),null);
  for(const ext of ['ttf','otf','woff','woff2']) assert.equal(model.fontFormat(`folder/FONT.${ext.toUpperCase()}`), ext);
});
test('uncertain or conflicting weight requires explicit confirmation', () => {
  const font = model.classifyFont(fixture({weight:600}), 'NanumGothicBold.ttf');
  assert.equal(font.needsConfirmation,true); assert.equal(font.weight,'700');
});
test('Naver Bd/Lt abbreviations remain scoped', () => {
  assert.equal(model.classifyFont(fixture({family:'NanumSquare Neo',weight:700}), 'NanumSquareNeo-cBd.ttf').weight,'700');
  assert.equal(model.classifyFont(fixture({family:'NanumSquare Neo',weight:350}), 'NanumSquareNeo-aLt.ttf').needsConfirmation,true);
});
test('TTF/OTF same release are alternatives; TTF selected; version change independent', () => {
  const ttf=model.classifyFont(fixture(), 'NanumGothic.ttf'), otf=model.classifyFont(fixture({family:'NanumGothicOTF',format:'otf'}),'NanumGothic.otf');
  assert.equal(model.faceKey(ttf),model.faceKey(otf));
  assert.deepEqual([...model.defaultFontSelection([otf,ttf])],[1]);
  assert.equal(model.defaultFontSelection([ttf,{...otf,version:'2'}]).size,2);
});
test('variable font excluded instead of registering a static 400', () => assert.throws(() => model.classifyFont(fixture({variable:true}), 'Variable.ttf'), /가변/));
test('file extension/content mismatch and malformed bytes blocked', () => {
  assert.throws(()=>model.classifyFont(fixture(),'a.otf'), /일치/);
  assert.throws(()=>model.classifyFont(Buffer.from('notfont'),'a.ttf'));
  const woff=Buffer.alloc(48);woff.write('wOFF');woff.writeUInt32BE(48,8);woff.writeUInt32BE(90*1024*1024,16);
  assert.throws(()=>model.classifyFont(woff,'a.woff'),/컨테이너/);
});

function server() {
  const blobs=new Map(), families=new Map(), assets=new Map(), calls=[]; let failInsert=false;
  const originalFetch=global.fetch; process.env.SUPABASE_SERVICE_ROLE_KEY='test-secret';
  const base='https://staging.example/storage/v1';
  const lib=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://staging.example'+p,getSupabaseStorageEndpoint:p=>base+p}})('src/lib/font-batch-server.ts');
  global.fetch=async(url,options={})=>{
    const u=new URL(url), path=u.pathname; calls.push([path,options.method||'GET']);
    if(path.includes('/bucket/'))return Response.json({public:path.endsWith('/fonts'),file_size_limit:80*1024*1024,allowed_mime_types:path.endsWith('/fonts')?Object.values(model.FONT_MIMES):['application/octet-stream']});
    if(path.includes('/object/upload/sign/'))return Response.json({url:'/object/upload/sign/'+path.split('/object/upload/sign/')[1]+'?token=private'});
    if(path.includes('/object/authenticated/')){const b=blobs.get(path.split('/object/authenticated/')[1]);return b?new Response(b):new Response('',{status:404});}
    if(path.endsWith('/object/design-intake-assets')&&options.method==='DELETE'){for(const p of JSON.parse(options.body).prefixes)blobs.delete('design-intake-assets/'+p);return Response.json({ok:true});}
    if(path.includes('/object/fonts/')){const key='fonts/'+path.split('/object/fonts/')[1];if(blobs.has(key))return new Response('',{status:409});blobs.set(key,Buffer.from(options.body));return Response.json({ok:true});}
    if(path.endsWith('/font_assets')&&!options.method)return Response.json([...assets.values()].filter(a=>a.id===u.searchParams.get('id')?.slice(3)));
    if(path.endsWith('/font_families')){const family=JSON.parse(options.body);if(!families.has(family.id))families.set(family.id,family);return new Response(null,{status:201});}
    if(path.endsWith('/font_assets')){if(failInsert){failInsert=false;return new Response('',{status:503});}const a=JSON.parse(options.body);if(!assets.has(a.id))assets.set(a.id,a);return new Response(null,{status:201});}
    throw new Error('Unexpected request '+path);
  };
  const bytes=fixture(), hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const input={name:'NanumGothic.ttf',hash,size:bytes.length,family:'NanumGothic',weight:'400',style:'normal',confirmed:true,webfontAllowed:true,active:true};
  const upload=token=>{const i=lib.readFontIntent(token,'admin');blobs.set('design-intake-assets/'+i.path,bytes);};
  return {lib,input,upload,blobs,families,assets,calls,failNext(){failInsert=true;},close(){global.fetch=originalFetch;}};
}
test('private upload → server hash/metadata check → family/asset registration → same file reused',async()=>{
  const s=server();try{
    const p=await s.lib.prepareFontUpload(s.input,'admin');s.upload(p.token);
    assert.match(p.uploadUrl,/design-intake-assets/);assert(!p.token.includes('test-secret'));
    const result=await s.lib.completeFontUpload(p.token,'admin');assert(result.assetId);
    assert.equal(s.assets.size,1);assert.equal(s.families.size,1);
    assert.equal([...s.assets.values()][0].package_source,'multi_file');
    const again=await s.lib.completeFontUpload(p.token,'admin');assert.equal(again.duplicate,true);assert.equal(again.assetId,result.assetId);
    const prepared=await s.lib.prepareFontUpload(s.input,'admin');assert.equal(prepared.duplicate,true);
    assert.equal(s.calls.filter(([p,m])=>p.includes('/object/fonts/')&&m==='POST').length,1);
  }finally{s.close();}
});
test('tampered / wrong-user / expired upload intent blocked',async()=>{
  const s=server();try{
    const p=await s.lib.prepareFontUpload(s.input,'admin');
    assert.throws(()=>s.lib.readFontIntent(p.token,'other'),e=>e.status===403);
    assert.throws(()=>s.lib.readFontIntent(p.token+'tampered','admin'),e=>e.status===403);
    const now=Date.now;Date.now=()=>now()+31*60*1000;try{assert.throws(()=>s.lib.readFontIntent(p.token,'admin'),e=>e.status===403);}finally{Date.now=now;}
  }finally{s.close();}
});
test('wrong bytes are never exposed publicly',async()=>{
  const s=server();try{
    const p=await s.lib.prepareFontUpload(s.input,'admin'),i=s.lib.readFontIntent(p.token,'admin');s.blobs.set('design-intake-assets/'+i.path,Buffer.alloc(s.input.size));
    await assert.rejects(s.lib.completeFontUpload(p.token,'admin'),e=>e.status===400);assert.equal(s.assets.size,0);assert(!s.calls.some(([p])=>p.includes('/object/fonts/')));
  }finally{s.close();}
});
test('lost DB response / partial failure can retry without duplicate public object or row',async()=>{
  const s=server();try{
    const p=await s.lib.prepareFontUpload(s.input,'admin');s.upload(p.token);s.failNext();
    await assert.rejects(s.lib.completeFontUpload(p.token,'admin'),e=>e.status===502);
    await s.lib.completeFontUpload(p.token,'admin');assert.equal(s.assets.size,1);assert.equal(s.families.size,1);assert.equal([...s.blobs.keys()].filter(p=>p.startsWith('fonts/')).length,1);
  }finally{s.close();}
});
test('concurrent finalization creates one asset/family/object',async()=>{
  const s=server();try{const p=await s.lib.prepareFontUpload(s.input,'admin');s.upload(p.token);await Promise.all([s.lib.completeFontUpload(p.token,'admin'),s.lib.completeFontUpload(p.token,'admin')]);assert.equal(s.assets.size,1);assert.equal(s.families.size,1);}finally{s.close();}
});
test('unconfirmed classification edits blocked before public copy',async()=>{
  const s=server();try{const p=await s.lib.prepareFontUpload({...s.input,family:'Other',confirmed:false},'admin');s.upload(p.token);await assert.rejects(s.lib.completeFontUpload(p.token,'admin'),e=>e.status===409);assert.equal(s.assets.size,0);}finally{s.close();}
});
test('upload bounds and traversal blocked',async()=>{
  const s=server();try{for(const patch of [{name:'../a.ttf'},{name:'a.zip'},{hash:'invalid'},{size:model.MAX_BATCH_FONT_BYTES+1}])await assert.rejects(s.lib.prepareFontUpload({...s.input,...patch},'admin'),e=>e.status===400);}finally{s.close();}
});
test('public intake bucket configuration blocks capability issuance before any upload',async()=>{
  const s=server(),configuredFetch=global.fetch;
  try{
    global.fetch=async(url,options)=>String(url).endsWith('/bucket/design-intake-assets')?Response.json({public:true,file_size_limit:50*1024*1024,allowed_mime_types:['application/octet-stream']}):configuredFetch(url,options);
    await assert.rejects(s.lib.prepareFontUpload(s.input,'admin'),e=>e.status===503);
    assert(!s.calls.some(([path])=>path.includes('/object/')));assert.equal(s.assets.size,0);
  }finally{s.close();}
});
test('API requires admin and same-origin before issuing any capability',async()=>{
  let user=null,blocked=false,calls=0;
  const route=loader({'@/lib/app-auth':{requireApiUser:async()=>user},'@/lib/article-image-api-origin':{requireImageSameOrigin(){if(blocked)throw {status:403};}},'@/lib/font-batch-server':{FontBatchError:class extends Error{},prepareFontUpload:async()=>{calls++;return{ok:true};}}})('src/app/api/font-batch/route.ts');
  const req=()=>new Request('https://app.example/api/font-batch',{method:'POST',body:JSON.stringify({action:'prepare'})});
  assert.equal((await route.POST(req())).status,401);user={id:'user',role:'user'};assert.equal((await route.POST(req())).status,403);
  user={id:'admin',role:'admin'};blocked=true;assert.equal((await route.POST(req())).status,403);assert.equal(calls,0);
  blocked=false;assert.equal((await route.POST(req())).status,200);assert.equal(calls,1);
});
module.exports={fixture};
