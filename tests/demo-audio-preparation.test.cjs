/* eslint-disable @typescript-eslint/no-require-imports -- Read-only media mocks; no generation or remote data writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),loader=require('./canva-test-loader.cjs');
const lib=loader()('src/lib/demo-audio-preparation.ts'),base='/api/demo-share/sample-audio?project=hwaseong-2026-10-samples&article=a&part=summary&segment=0';
test('only the first same-origin Demo segment can opt in; unsupported/low-data browsers stay none',()=>{
 assert.equal(lib.demoAudioPreparationHref(base),base+'&prepare=1');
 for(const href of ['https://other.invalid'+base,base+'#token',base+'&segment=0',base.replace('segment=0','segment=1'),base.replace('hwaseong-2026-10-samples','other'),'/private.mp3'])assert.equal(lib.demoAudioPreparationHref(href),null);
 assert(lib.canPrepareDemoAudio('Mozilla Android Chrome/131.0 SamsungBrowser/27.0'));
 for(const [ua,c]of [['Safari/1',{}],['iPhone Chrome/131',{}],['Chrome/131',{saveData:true}],['Chrome/131',{effectiveType:'slow-2g'}],['Chrome/131',{effectiveType:'2g'}]])assert(!lib.canPrepareDemoAudio(ua,c));
});
test('initial byte ranges are bounded to 64KiB; short probes, playback continuation and seeks retain their exact ranges',()=>{
 for(const [range,expected]of [[null,'bytes=0-65535'],['bytes=0-','bytes=0-65535'],['bytes=0-1000000','bytes=0-65535'],['bytes=0-1','bytes=0-1'],['bytes=100-','bytes=100-65535']]){
  const request=new Request('https://stage.invalid'+base,{headers:range?{Range:range}:{}}),p=lib.demoAudioPreparationRequest(request);assert(p.limited);assert.equal(p.request.headers.get('range'),expected);
 }
 for(const range of ['bytes=65536-','bytes=200000-220000','bytes=-128']){const request=new Request('https://stage.invalid'+base,{headers:{Range:range}}),p=lib.demoAudioPreparationRequest(request);assert(!p.limited);assert.equal(p.request,request);}
});
function route(deliver){return loader({'@/lib/hwaseong-demo-render':{deliverHwaseongDemoAudio:deliver},'@/lib/demo-share':{demoHeaders:{'Cache-Control':'private, no-store'}}})('src/app/api/demo-share/sample-audio/route.ts');}
test('preparation and continuation both call the existing authorization path; revoke/source change cannot reuse a positive result',async()=>{
 let calls=0,denied=false;const mod=route(async(_s,_a,_p,_i,request)=>{calls++;if(denied)throw Error('revoked/source changed');const range=request.headers.get('range');assert.equal(range,calls===1?'bytes=0-65535':'bytes=65536-');return new Response(Buffer.alloc(calls===1?65536:10),{status:206,headers:{'content-range':calls===1?'bytes 0-65535/100000':'bytes 65536-65545/100000','content-type':'audio/mpeg'}});});
 const url='https://stage.invalid'+base+'&prepare=1';
 const warm=await mod.GET(new Request(url,{headers:{Range:'bytes=0-'}}));assert.equal(warm.status,206);assert.equal((await warm.arrayBuffer()).byteLength,65536);assert.equal(warm.headers.get('cache-control'),'private, no-store');
 const next=await mod.GET(new Request(url,{headers:{Range:'bytes=65536-'}}));assert.equal(next.status,206);assert.equal((await next.arrayBuffer()).byteLength,10);
 denied=true;assert.equal((await mod.GET(new Request(url,{headers:{Range:'bytes=0-'}}))).status,410);assert.equal(calls,3);
 for(const bad of [base+'&prepare=0',base+'&prepare=1&prepare=1',base.replace('segment=0','segment=1')+'&prepare=1',base.replace('&segment=0','')+'&prepare=1'])assert.equal((await mod.GET(new Request('https://stage.invalid'+bad))).status,404);assert.equal(calls,3);
});
test('ignored ranges, invalid proofs or an oversized response cannot deliver an unbounded preparation',async()=>{
 for(const [status,cr]of [[200,null],[206,'bytes 0-99999/100000'],[206,'bytes 1-65535/100000']]){let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}}),mod=route(async()=>new Response(body,{status,headers:cr?{'content-range':cr}:{}}));assert.equal((await mod.GET(new Request('https://stage.invalid'+base+'&prepare=1'))).status,502);assert(cancelled);}
 const mod=route(async()=>new Response(Buffer.alloc(65537),{status:206,headers:{'content-range':'bytes 0-65535/100000'}}));const response=await mod.GET(new Request('https://stage.invalid'+base+'&prepare=1'));await assert.rejects(response.arrayBuffer());
});
function playerFixture({ua='Chrome/131.0',connection,blocked=false,active=true}={}){
 const oldNav=Object.getOwnPropertyDescriptor(global,'navigator'),oldDoc=global.document,effects=[],refs=[];let parent=blocked?{}:null,mutation,loads=0,plays=0;
 Object.defineProperty(global,'navigator',{configurable:true,value:{userAgent:ua,connection}});
 global.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 const audio={src:'/initial',paused:true,currentTime:0,duration:30,preload:'none',load(){loads++;},play(){plays++;return Promise.resolve();},pause(){},closest(){return parent;},removeAttribute(){}};
 const Player=loader({react:{...React,useRef:value=>{const ref={current:refs.length===0?audio:value};refs.push(ref);return ref;},useState:value=>[typeof value==='function'?value():value,()=>{}],useEffect:f=>effects.push(f),useCallback:f=>f},'react-dom':{createPortal(){}}})('src/components/public-article-audio-player.tsx').PublicArticleAudioPlayer;
 const oldMutation=global.MutationObserver;global.MutationObserver=class{constructor(f){mutation=f;}observe(){}disconnect(){}};
 const outer=Player({ariaLabel:'AI',isAiGenerated:true,manifestUrl:'/manifest',initialSegments:[{index:0,url:base}],prepareFirstSegment:active}),tree=outer.type(outer.props);
 return{audio,tree,effects,get loads(){return loads;},get plays(){return plays;},unblock(){parent=null;mutation();},close(){if(oldNav)Object.defineProperty(global,'navigator',oldNav);else delete global.navigator;global.document=oldDoc;global.MutationObserver=oldMutation;}};
}
test('only active Chromium audio prepares; it waits for cookie confirmation, stops at metadata and never auto plays',()=>{
 const h=playerFixture({blocked:true});try{const cleanup=h.effects[3]();assert.equal(h.loads,0);h.unblock();assert.equal(h.loads,1);assert.equal(h.audio.src,base+'&prepare=1');assert.equal(h.audio.preload,'metadata');assert.equal(h.plays,0);h.tree.props.children[0].props.onLoadedMetadata();assert.equal(h.audio.preload,'none');h.tree.props.children[0].props.onError();assert.equal(h.audio.src,base);assert.equal(h.audio.preload,'none');assert.equal(h.plays,0);cleanup();}finally{h.close();}
 for(const options of [{active:false},{ua:'Safari/1'},{connection:{saveData:true}},{connection:{effectiveType:'2g'}}]){const h=playerFixture(options);try{h.effects[3]();assert.equal(h.loads,0);assert.equal(h.plays,0);}finally{h.close();}}
});
test('summary/detail share exactly one selected preparation target; ordinary readers never opt in',()=>{
 const m=loader({'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null},'@/components/public-article-audio-player':{PublicArticleAudioPlayer:p=>React.createElement('audio',{'data-prepare':p.prepareFirstSegment?'yes':'no'})}})('src/components/hwaseong-sample-reading-tools.tsx');
 const sample={kind:'policy',article:{id:'a'}},generated={id:'s',voice:'marin',manifestHref:'/s',transcriptText:'원문',detail:{id:'d',voice:'marin',manifestHref:'/d',transcriptText:'상세'}};
 for(const preparePart of [undefined,'summary','detail']){const html=require('react-dom/server').renderToStaticMarkup(React.createElement(m.SampleReadingToolsScope,{preparePart},React.createElement(m.SampleReadingTools,{sample,generated}),React.createElement(m.SampleDetailReadingTools,{sample,generated})));assert.equal((html.match(/data-prepare="yes"/g)||[]).length,preparePart?1:0);}
});
