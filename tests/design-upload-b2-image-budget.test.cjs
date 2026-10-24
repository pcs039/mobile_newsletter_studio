/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic local image budget probe, no external files or services. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const sharp=require('sharp');
test('B2 local full-decode budget probe, rejected pixel count and hard child deadline',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'upload-b2-images-'));
  const probe=`const fs=require('node:fs'),sharp=require(process.argv[1]);
    (async()=>{const bytes=fs.readFileSync(process.argv[2]);if(bytes.length>10485760)throw Error('size');
    const before=process.cpuUsage(),start=performance.now();
    const opts={limitInputPixels:16000000,failOn:'warning',sequentialRead:true};
    const meta=await sharp(bytes,opts).metadata();if(!['png','jpeg','webp'].includes(meta.format)||(meta.pages||1)>1)throw Error('format');
    await sharp(bytes,opts).stats();const cpu=process.cpuUsage(before);
    console.log(JSON.stringify({format:meta.format,pixels:meta.width*meta.height,inputBytes:bytes.length,elapsedMs:Math.round(performance.now()-start),cpuMs:Math.round((cpu.user+cpu.system)/1000),maxRssKiB:process.resourceUsage().maxRSS}));
    })().catch(()=>process.exit(2));`;
  try{
    for(const format of ['png','jpeg','webp']){
      const bytes=await sharp({create:{width:4000,height:4000,channels:3,background:'#9ac'}}).toFormat(format).toBuffer();
      const file=path.join(dir,`synthetic.${format}`);fs.writeFileSync(file,bytes);
      const raw=execFileSync(process.execPath,['-e',probe,require.resolve('sharp'),file],{encoding:'utf8',timeout:15000,killSignal:'SIGKILL'});
      const result=JSON.parse(raw);assert.equal(result.pixels,16000000);assert.ok(result.inputBytes<=10485760);
      console.log('LOCAL_BUDGET_ONLY',JSON.stringify(result));
    }
    const bytes=await sharp({create:{width:4096,height:4096,channels:3,background:'#fff'}}).png().toBuffer();
    assert.ok(bytes.length<10485760);
    await assert.rejects(sharp(bytes,{limitInputPixels:16000000,failOn:'warning'}).stats(),/pixel limit/i);
    assert.throws(()=>execFileSync(process.execPath,['-e','while(true){}'],{timeout:100,killSignal:'SIGKILL',stdio:'pipe'}),e=>e.signal==='SIGKILL');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
