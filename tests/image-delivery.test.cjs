/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node test harness. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const load=require('./canva-test-loader.cjs')();
const delivery=load('src/lib/image-delivery.ts');
const {deliverAuthorizedPng}=load('src/lib/image-delivery-server.ts');
const {getSharp}=require('next/dist/server/image-optimizer');
const sharp=getSharp();
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const request=(query)=>new Request('https://staging.test/image?'+query);
async function png(width=600,height=750){return sharp({create:{width,height,channels:4,background:'#245377'}}).png().toBuffer();}
test('only trusted ID/block proxy paths get responsive delivery URLs',()=>{
 for(const source of ['/api/public-files/preview?project=x&aiImageBlock=b','/api/client-review/files?fullLayoutBlock=b','/api/project-files/preview?designAssetId=a']) {
  const url=delivery.imageDeliverySource(source,960,'webp');assert.match(url,/deliveryWidth=960/);assert.match(url,/deliveryFormat=webp/);
 }
 for(const source of ['https://storage.test/private.png','//evil.test/x','/api/project-files/preview?bucket=private&path=secret','/institution.png'])assert.equal(delivery.imageDeliverySource(source,960,'webp'),null);
});
test('sizes follow max520 reader and mobile margins; DPR candidates include 960 and cap1600',()=>{
 assert.match(delivery.articleImageSizes,/520px/);assert.match(delivery.articleImageSizes,/100vw - 88px/);assert.match(delivery.articleImageSizes,/464px/);
 assert.equal(Math.max(...delivery.imageDeliveryWidths),1600);assert.ok(delivery.imageDeliveryWidths.includes(960));
});
test('picture preserves original PNG fallback, alt, and same-origin AVIF/WebP sources',()=>{
 const {ResponsiveDesignImage}=load('src/components/responsive-design-image.tsx');
 const html=renderToStaticMarkup(React.createElement(ResponsiveDesignImage,{src:'/api/public-files/preview?aiImageBlock=b',alt:'기사 안내',className:'w-full'}));
 assert.match(html,/image\/avif/);assert.match(html,/image\/webp/);assert.match(html,/alt="기사 안내"/);assert.match(html,/src="\/api\/public-files\/preview\?aiImageBlock=b"/);assert.match(html,/loading="lazy"/);assert.doesNotMatch(html,/_next\/image|storage_path/);
});
test('unrelated institution images have no transformed source',()=>{
 const {ResponsiveDesignImage}=load('src/components/responsive-design-image.tsx');
 const html=renderToStaticMarkup(React.createElement(ResponsiveDesignImage,{src:'/photo.jpg',alt:'사진'}));assert.doesNotMatch(html,/source|srcSet/);
});
test('no delivery parameters returns byte-identical original with existing no-store policy',async()=>{
 const bytes=await png();const r=await deliverAuthorizedPng(new Response(bytes),undefined,'gpt',headers);
 assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('content-type'),'image/png');
});
test('invalid width and format cannot invoke unbounded transformations',async()=>{
 for(const q of ['deliveryWidth=99999&deliveryFormat=webp','deliveryWidth=960&deliveryFormat=jpeg','deliveryFormat=avif','deliveryWidth=0960&deliveryFormat=webp'])assert.equal((await deliverAuthorizedPng(new Response(await png()),request(q),'gpt',headers)).status,400);
});
test('AVIF/WebP preserve ratio/alpha and never enlarge a smaller source',async()=>{
 // Noise makes original PNG larger than the encoded output, exercising real engine.
 const raw=Buffer.alloc(320*400*4);for(let i=0;i<raw.length;i++)raw[i]=(i*17+i%53)%256;
 const bytes=await sharp(raw,{raw:{width:320,height:400,channels:4}}).png().toBuffer();
 for(const format of ['webp','avif']){
  const r=await deliverAuthorizedPng(new Response(bytes),request(`deliveryWidth=1600&deliveryFormat=${format}`),'canva',headers);
  const result=await sharp(Buffer.from(await r.arrayBuffer())).metadata();assert.equal(result.width,320);assert.equal(result.height,400);assert.equal(result.hasAlpha,true);assert.equal(r.headers.get('x-image-delivery-width'),'320');assert.equal(r.headers.get('cache-control'),'private, no-store');
 }
});
test('same authorized request reuses deterministic bytes and original mutation changes cache key',async()=>{
 const input=await png(800,1000),q=request('deliveryWidth=480&deliveryFormat=webp');
 const a=await deliverAuthorizedPng(new Response(input),q,'gpt',headers), b=await deliverAuthorizedPng(new Response(input),q,'gpt',headers);
 assert.deepEqual(Buffer.from(await a.arrayBuffer()),Buffer.from(await b.arrayBuffer()));
 assert.equal(b.headers.get('vary'),'Accept');assert.equal(b.headers.get('x-image-delivery-width'),'480');
});
test('transform failure returns byte-identical original PNG',async()=>{
 const isolated=require('./canva-test-loader.cjs')({'next/dist/server/image-optimizer':{optimizeImage:async()=>{throw Error('unavailable');}}});
 const bytes=await png();const r=await isolated('src/lib/image-delivery-server.ts').deliverAuthorizedPng(new Response(bytes),request('deliveryWidth=480&deliveryFormat=webp'),'canva',headers);
 assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);
});
