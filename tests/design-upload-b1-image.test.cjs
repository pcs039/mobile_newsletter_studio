/* eslint-disable @typescript-eslint/no-require-imports -- Local image validation experiment, no application imports. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
// Already present as Next's optional, locked dependency. Production adoption must
// declare a direct dependency and verify deployment binaries separately.
const sharp = require('sharp');
const sha256 = b => createHash('sha256').update(b).digest('hex');
const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const options = { failOn: 'warning', limitInputPixels: 40000000, sequentialRead: true };
async function verify(bytes, declared, limit = 10 * 1024 * 1024) {
  if (!bytes.length || bytes.length > limit) throw Error('size');
  if (!Object.values(mime).includes(declared.mime)) throw Error('mime');
  if (declared.hash !== sha256(bytes)) throw Error('hash');
  // Reject SVG before handing it to a renderer; no XML sanitization experiment.
  const signature = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpeg'
    : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'webp' : null;
  if (!signature || mime[signature] !== declared.mime) throw Error('signature');
  const meta = await sharp(bytes, options).metadata();
  if (meta.format !== signature || !meta.width || !meta.height || meta.width > 25000 || meta.height > 25000 || (meta.pages || 1) > 1) throw Error('dimensions/animation');
  await sharp(bytes, options).stats(); // Full decode, unlike metadata().
  return { hash: sha256(bytes), size: bytes.length, width: meta.width, height: meta.height };
}
for (const format of Object.keys(mime)) {
  test(`local ${format} bytes: full decode and claimed MIME/hash checks`, async () => {
    const bytes = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#abc' } }).toFormat(format).toBuffer();
    const result = await verify(bytes,{mime:mime[format],hash:sha256(bytes)});
    assert.equal(result.width,32); assert.equal(result.height,24);
    await assert.rejects(verify(bytes,{mime:mime[format],hash:'0'.repeat(64)}),/hash/);
    await assert.rejects(verify(bytes,{mime:format === 'png' ? 'image/jpeg' : 'image/png',hash:sha256(bytes)}),/signature/);
    await assert.rejects(verify(bytes,{mime:mime[format],hash:sha256(bytes)},bytes.length-1),/size/);
  });
}
test('HTML/SVG disguised as PNG rejected before image processing', async () => {
  for (const text of ['<html>not an image</html>','<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>']) {
    const bytes = Buffer.from(text); await assert.rejects(verify(bytes,{mime:'image/png',hash:sha256(bytes)}),/signature/);
  }
});
test('header inspection alone does not prove full decoding', async () => {
  const good = await sharp({create:{width:8,height:8,channels:4,background:'#abc'}}).png().toBuffer();
  const broken = Buffer.from(good); const idat = broken.indexOf(Buffer.from('IDAT')); broken[idat+4] ^= 255;
  assert.equal((await sharp(broken,options).metadata()).width,8);
  await assert.rejects(verify(broken,{mime:'image/png',hash:sha256(broken)}));
});
test('pixel limit rejects a small compressed image with disallowed decoded dimensions', async () => {
  const bytes = await sharp({create:{width:32,height:32,channels:3,background:'#fff'}}).png().toBuffer();
  await assert.rejects(sharp(bytes,{...options,limitInputPixels:100}).stats(),/pixel limit/i);
});
test('re-encoding strips EXIF by default but produces different bytes; not an implicit preservation policy', async () => {
  const bytes = await sharp({create:{width:16,height:8,channels:3,background:'#fff'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  assert.ok((await sharp(bytes).metadata()).exif);
  const converted = await sharp(bytes,options).autoOrient().jpeg().toBuffer();
  const meta = await sharp(converted).metadata();
  assert.equal(meta.exif,undefined); assert.equal(meta.width,8); assert.notEqual(sha256(bytes),sha256(converted));
});
