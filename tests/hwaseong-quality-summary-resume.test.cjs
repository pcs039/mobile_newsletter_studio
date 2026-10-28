/* eslint-disable @typescript-eslint/no-require-imports -- Isolated DB, Storage and provider fixtures. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),loader=require('./canva-test-loader.cjs');
const pure=loader(),n=pure('src/lib/hwaseong-sample-quality-narration.ts');
const ids=Object.keys(pure('src/lib/hwaseong-sample-interest.ts').sampleOrderRules);
const parent04='ecd92636-c585-5d7c-a7b2-0570eea67b96',parent06='7610ae2d-5229-5311-a4ea-b1262033a209';
const samples=ids.map((id,i)=>({kind:'policy',headline:'기사 '+i,summary:'요약 본문입니다.',article:{id,blocks:[{type:'paragraph',title:'본문',body:'공개 본문입니다.',isVisible:true,metadata:{}}]}}));
function fixture(){
  const previous=global.fetch,env={...process.env},rows=[],objects=new Map(),calls=[],writes=[];
  process.env.STAGING_OPENAI_API_KEY='scoped';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
  const mp3=fs.readFileSync(__dirname+'/fixtures/marin-recovery-tone.mp3');let fail=false;
  const effective=plan=>{
    const id=plan.job===ids[3]+':detail'?parent04:plan.job===ids[5]+':summary'?parent06:plan.id;
    const original={...plan,id,path:n.qualityPrefix+id+'/final.mp3',titlePath:n.qualityPrefix+id+'/title.mp3',bodyPaths:plan.chunks.map((_,i)=>n.qualityPrefix+id+'/body-'+i+'.mp3')};
    const p=n.scopedQualityPlan(original);
    if(p.resume)p.resume={...p.resume,reusedHash:crypto.createHash('sha256').update(mp3).digest('hex'),reusedSize:mp3.length};
    return p;
  };
  const api=loader({
    '@/lib/hwaseong-sample-quality-narration':{...n,scopedQualityPlan:effective},
    '@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true},
    '@/lib/hwaseong-proposal-sample':{...pure('src/lib/hwaseong-proposal-sample.ts'),proposalSample:a=>a},
    '@/lib/newsletter-repository':{getProjectContent:async()=>({source:'supabase',articles:samples})},
    '@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p,getSupabaseStorageEndpoint:p=>'https://storage.invalid'+p},
    '@/lib/article-tts-audio':{requestOpenAiSpeech:async(text,voice,_model,options)=>{
      assert.equal(voice,'coral');assert.equal(options.narration.speed,1);assert.equal(options.bodyIdleTimeoutMs,30000);
      calls.push(text);options.diagnostics.setReceipt(200,'req_fixture');
      if(fail)throw Error('interrupted');return {ok:true,data:mp3.buffer.slice(mp3.byteOffset,mp3.byteOffset+mp3.length)};
    }},
  })('src/lib/hwaseong-sample-quality-tts-server.ts');
  global.fetch=async(url,options={})=>{
    const u=new URL(url),method=options.method||'GET';
    if(u.hostname==='db.invalid'){
      if(method==='POST'){const row=JSON.parse(options.body);if(rows.some(x=>x.id===row.id))return new Response(null,{status:409});rows.push({...row,ai_tts_generated_at:null});writes.push(row.id);return new Response(null,{status:201});}
      if(method==='PATCH'){const row=rows.find(x=>x.id===u.searchParams.get('id').slice(3));Object.assign(row,JSON.parse(options.body));writes.push(row.id);return Response.json([row]);}
      return Response.json(rows);
    }
    if(method==='POST'){assert.equal(options.headers['x-upsert'],'false');assert(!objects.has(u.pathname));objects.set(u.pathname,Buffer.from(options.body));return new Response(null,{status:201});}
    return objects.has(u.pathname)?new Response(objects.get(u.pathname),{headers:{'Content-Type':'audio/mpeg'}}):Response.json({statusCode:'404'},{status:400});
  };
  const row=(p,id=p.id,path=p.path,complete=false)=>({id,project_id:n.qualityProjectId,article_id:null,title:n.qualityTitlePrefix+p.title,file_path:path,script_text:p.text,script_status:'pending',ai_tts_voice:p.voice,ai_tts_model:p.model,ai_tts_text_hash:p.hash,ai_tts_audio_paths:[path],ai_tts_generated_at:complete?'2026-01-01':null,created_at:'2020-01-01T00:00:00Z',...(id===p.id&&p.resume?{pronunciation_note:JSON.stringify(p.resume)}:{})});
  return {...api,rows,objects,calls,writes,mp3,setFail:()=>fail=true,async prepare(){
    const plans=await api.qualityPlans(),p=plans.find(p=>p.resume?.parentId===parent06),resolved=plans.find(p=>p.resume?.parentId===parent04);
    rows.push(row(resolved,parent04,resolved.resume.parentFinalPath),row(resolved,resolved.id,resolved.path,true),row(p,parent06,p.resume.parentFinalPath));
    objects.set('/object/audio-files/'+p.titlePath,mp3);
    return {p,plans,before:JSON.stringify(rows)};
  },restore(){global.fetch=previous;for(const k of ['STAGING_OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'])if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}};
}
test('06 summary reuses its exact title, preserves both unknown rows and reserves one missing-body attempt',async()=>{
  const f=fixture();try{const {p,plans,before}=await f.prepare();
    const result=await Promise.all([f.generateQualityTts(p.job,p.resume.requestKey),f.generateQualityTts(p.job,p.resume.requestKey)]);
    assert.equal(result.filter(r=>r.state==='editing').length,1);assert.deepEqual(f.calls,[p.chunks[0]]);
    assert.equal(JSON.stringify(f.rows.slice(0,3)),before);assert(!f.writes.includes(parent04)&&!f.writes.includes(parent06));
    assert.equal((await f.generateQualityTts(p.job,p.resume.requestKey)).calls,0);
    const detail=plans.find(x=>x.job===ids[5]+':detail');assert.equal((await f.generateQualityTts(detail.job)).state,'editing');
    assert.equal(f.calls.length,2);
  }finally{f.restore();}
});
for(const condition of ['wrong_key','unrelated_pending','corrupt_title','provider_failure'])test('06 '+condition+' stops without replaying completed audio',async()=>{
  const f=fixture();try{const {p,before}=await f.prepare();
    if(condition==='unrelated_pending')f.rows.push({id:'other',ai_tts_generated_at:null});
    if(condition==='corrupt_title')f.objects.set('/object/audio-files/'+p.titlePath,Buffer.from('bad'));
    if(condition==='provider_failure')f.setFail();
    const r=await f.generateQualityTts(p.job,condition==='wrong_key'?'wrong':p.resume.requestKey);
    assert.equal(r.calls,condition==='provider_failure'?1:0);assert.equal(JSON.stringify(f.rows.slice(0,3)),before);
    assert.equal((await f.generateQualityTts(p.job,condition==='wrong_key'?'wrong':p.resume.requestKey)).calls,0);
  }finally{f.restore();}
});
test('06 complete prior body is copied to the new path with zero paid requests',async()=>{
  const f=fixture();try{const {p,before}=await f.prepare();
    f.objects.set('/object/audio-files/'+p.resume.missingPath,f.mp3);
    const r=await f.generateQualityTts(p.job,p.resume.requestKey);
    assert.equal(r.state,'editing');assert.equal(r.calls,0);assert.equal(f.calls.length,0);
    assert.equal(JSON.stringify(f.rows.slice(0,3)),before);assert(f.objects.has('/object/audio-files/'+p.bodyPaths[0]));
  }finally{f.restore();}
});
test('06 existing final prevents reservation and paid generation',async()=>{
  const f=fixture();try{const {p,before}=await f.prepare();
    f.objects.set('/object/audio-files/'+p.resume.parentFinalPath,f.mp3);
    const r=await f.generateQualityTts(p.job,p.resume.requestKey);
    assert.equal(r.calls,0);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
    assert.equal(JSON.stringify(f.rows),before);
  }finally{f.restore();}
});
