/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server module contract tests. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const loader=require('./canva-test-loader.cjs');
const load=loader(),png=load('src/lib/canva-png-export.ts');
test('feature gate cannot write against Production or an unrelated Preview database',()=>{
 const names=['APP_ENV','NEXT_PUBLIC_SITE_URL','SITE_URL','CANVA_REDIRECT_URI'];const old=names.map(k=>process.env[k]);Object.assign(process.env,{APP_ENV:'staging',NEXT_PUBLIC_SITE_URL:'https://canva-staging.datadiction.co.kr',SITE_URL:'https://canva-staging.datadiction.co.kr',CANVA_REDIRECT_URI:'https://canva-staging.datadiction.co.kr/api/canva/callback'});
 const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldEnv=process.env.VERCEL_ENV;
 try {
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://mvrkpmffuhcqwisqvpqi.supabase.co';process.env.VERCEL_ENV='preview';assert(png.canvaPngImportEnabled());
  process.env.VERCEL_ENV='production';assert(!png.canvaPngImportEnabled());
  process.env.VERCEL_ENV='preview';process.env.NEXT_PUBLIC_SUPABASE_URL='https://production.supabase.co';assert(!png.canvaPngImportEnabled());
 } finally {names.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldEnv;}
});
test('PNG format and one-page gate; download host cannot be supplied arbitrarily',()=>{
 png.requireSinglePagePng({formats:{png:{page_numbers:[1]}}},{design:{page_count:1}});
 for(const [f,d] of [[{formats:{}},{design:{page_count:1}}],[{formats:{png:{}}},{design:{page_count:2}}],[{formats:{png:{page_numbers:[2]}}},{design:{page_count:1}}]])assert.throws(()=>png.requireSinglePagePng(f,d));
 for(const u of ['http://export-download.canva.com/x','https://export-download.canva.com.evil.test/x','https://127.0.0.1/x','https://u:p@export-download.canva.com/x','https://export-download.canva.com:8443/x'])assert.throws(()=>png.safeCanvaDownloadUrl(u));
 assert.throws(()=>png.readCanvaExportJob({job:{id:'job',status:'success',urls:['https://export-download.canva.com/a','https://export-download.canva.com/b']}}));
});
test('PNG integrity, MIME, truncation, CRC, size; deterministic project-scoped ID',()=>{
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
 assert.equal(png.validateCanvaPng(bytes,'image/png').width,1);
 assert.throws(()=>png.validateCanvaPng(bytes,'text/html'));
 assert.throws(()=>png.validateCanvaPng(bytes.subarray(0,50),'image/png'));
 const bad=Buffer.from(bytes);bad[40]^=1;assert.throws(()=>png.validateCanvaPng(bad,'image/png'));
 assert.throws(()=>png.validateCanvaPng(Buffer.alloc(png.canvaPngMaxBytes+1),'image/png'));
 assert.equal(png.canvaImportAssetId('p','D1'),png.canvaImportAssetId('p','D1'));
 assert.notEqual(png.canvaImportAssetId('p','D1'),png.canvaImportAssetId('q','D1'));
});
test('metadata provenance is minimal and validated; legacy NULL remains valid',()=>{
 const m=load('src/lib/design-asset-metadata.ts');
 assert(m.validateDesignAssetMetadata(null).ok);
 assert(m.validateDesignAssetMetadata({source:'canva',canvaExport:{designId:'D123',format:'png'}}).ok);
 for(const x of [{designId:'D123',format:'jpg'},{designId:'D123',format:'png',url:'secret'},{designId:'../x',format:'png'}])assert(!m.validateDesignAssetMetadata({canvaExport:x}).ok);
});
test('download rejects redirect/failure, MIME and size without leaking signed URL',async()=>{
 const original=global.fetch;
 try {
  global.fetch=async(_url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);throw Error('secret signed URL');};
  await assert.rejects(png.downloadCanvaPng('https://export-download.canva.com/x?signature=secret'),e=>e.status===504&&!e.message.includes('secret'));
  global.fetch=async()=>new Response('html',{headers:{'content-type':'text/html'}});
  await assert.rejects(png.downloadCanvaPng('https://export-download.canva.com/x'));
  global.fetch=async()=>new Response('png',{headers:{'content-type':'image/png','content-length':String(png.canvaPngMaxBytes+1)}});
  await assert.rejects(png.downloadCanvaPng('https://export-download.canva.com/x'),e=>e.status===413);
 } finally {global.fetch=original;}
});
test('import route requires completed same-project result; dedup skips Canva; URL never persisted',async()=>{
 const articleId='11111111-1111-4111-8111-111111111111';let calls=[],saved=[],asset=null,allowed=true,enabled=true;
 let row={execution:{articleId,templateId:'event_festival_02',hash:'hash',status:'success',job:{status:'success',designId:'D123'},designReview:{status:'approved',designId:'D123',articleId,templateId:'event_festival_02',snapshotHash:'snapshot',executionHash:'hash'}}};let failure=null;
 const route=loader({
  '@/lib/staging-environment':{requireStagingE2E:()=>{},stagingRequestAllowed:()=>true},
  '@/lib/canva-connect-contract':load('src/lib/canva-connect-contract.ts'),
  '@/lib/canva-api-access':{sameOrigin:r=>{if(r.headers.get('origin')!=='https://staging.example')throw Error('origin');},canvaAdmin:async()=>allowed?{ok:true,project:{id:'p',slug:'p'},user:{id:'admin'}}:{ok:false,response:Response.json({}, {status:401})},canvaJson:Response.json,canvaFailure:e=>Response.json({message:e.message},{status:e.status||400})},
  '@/lib/canva-design-approval':{prepareDesignApproval:async()=>({snapshot:'snapshot',binding:'binding'}),requireDesignApproval:load('src/lib/canva-design-approval.ts').requireDesignApproval},
  '@/lib/canva-connection-repository':{getConnection:async()=>row,withConnectionLock:async(_p,_u,f)=>f(row,async p=>{saved.push(p);Object.assign(row,p);return row;})},
  '@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:[{id:articleId,title:'기사'}]})},
  '@/lib/canva-connect-server':{accessToken:async()=> 'test-only',connectedCanvaRequest:async path=>{calls.push(path);if(path.endsWith('export-formats'))return {formats:{png:{}}};if(path.startsWith('/designs/'))return {design:{id:'D123',page_count:1}};if(failure)throw failure;return {job:{id:'export1',status:'success',urls:['https://export-download.canva.com/x']}};}},
  '@/lib/canva-png-export':{...png,canvaPngImportEnabled:()=>enabled,downloadCanvaPng:async()=>({file:new File(['png'],'a.png',{type:'image/png'})})},
  '@/lib/canva-png-asset-repository':{findCanvaPngAsset:async()=>asset,registerCanvaPngAsset:async()=>{asset={id:'asset',name:'기사 PNG'};return asset;}},
 })('src/app/api/canva/png-import/route.ts');
 const request=(extra={})=>new Request('https://staging.example/api/canva/png-import',{method:'POST',headers:{origin:'https://staging.example','Content-Type':'application/json'},body:JSON.stringify({projectSlug:'p',articleId,designId:'D123',templateId:'event_festival_02',action:'start',assetType:'illustration',...extra})});
 assert.equal((await route.POST(request({designId:'D_other'}))).status,404);assert.equal(calls.length,0);
 allowed=false;assert.equal((await route.POST(request())).status,401);allowed=true;
 enabled=false;assert.equal((await route.POST(request())).status,403);enabled=true;
 const first=await route.POST(request());assert.equal(first.status,200);assert.equal((await first.json()).import.status,'ready');
 const imported=await route.POST(request({action:'status'}));assert.equal((await imported.json()).import.status,'success');
 assert.equal(calls.filter(x=>x==='/exports').length,1);
 const before=calls.length;const again=await route.POST(request());assert.equal((await again.json()).duplicate,true);assert.equal(calls.length,before);
 assert(!JSON.stringify(saved).includes('export-download'));assert(!JSON.stringify(saved).includes('test-only'));
 asset=null;row.execution.pngImport=undefined;
 const {CanvaConnectError}=load('src/lib/canva-connect-contract.ts');
 failure=new CanvaConnectError(504,'timeout');assert.equal((await route.POST(request())).status,504);assert.equal(row.execution.pngImport.status,'unknown');
 const afterTimeout=calls.length;assert.equal((await route.POST(request())).status,409);assert.equal(calls.length,afterTimeout);
 row.execution.pngImport=undefined;failure=new CanvaConnectError(401,'reconnect');assert.equal((await route.POST(request())).status,401);assert.equal(row.execution.pngImport.status,'failed');
});
