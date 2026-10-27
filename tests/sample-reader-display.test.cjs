/* eslint-disable @typescript-eslint/no-require-imports -- Pure display/history contracts, no network. */
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./canva-test-loader.cjs')();
const {sampleDisplay,withSampleDisplay,ebookKeyboardDirection}=load('src/lib/sample-reader-display.ts');
test('only one explicit, validated display choice overrides device suggestion',()=>{
 for(const value of ['mobile','ebook'])assert.equal(sampleDisplay(new URLSearchParams({display:value})),value);
 for(const q of ['', 'display=other','display=ebook&display=mobile','display=ebook&display=ebook'])assert.equal(sampleDisplay(new URLSearchParams(q)),undefined);
});
test('display switch preserves article, inline detail, interest and QA query without changing content identity',()=>{
 const original='/projects/hwaseong-2026-10-samples/samples?articleId=retained&view=detail&interest=pets&width=390&qa=1#place-01';
 const changed=new URL(withSampleDisplay(original,'ebook'),'https://fixture');
 for(const [k,v] of new URL(original,'https://fixture').searchParams)assert.equal(changed.searchParams.get(k),v);
 assert.equal(changed.searchParams.get('display'),'ebook');assert.equal(changed.hash,'#place-01');
 assert.equal(new URL(withSampleDisplay(changed.pathname+changed.search,'mobile'),'https://fixture').searchParams.get('display'),'mobile');
});
test('book keyboard ignores inputs, media, links, modified arrows and already handled events',()=>{
 const e={key:'ArrowRight',altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,defaultPrevented:false};
 assert.equal(ebookKeyboardDirection(e,false),'next');assert.equal(ebookKeyboardDirection({...e,key:'ArrowLeft'},false),'previous');
 assert.equal(ebookKeyboardDirection(e,true),null);for(const k of ['altKey','ctrlKey','metaKey','shiftKey','defaultPrevented'])assert.equal(ebookKeyboardDirection({...e,[k]:true},false),null);
 assert.equal(ebookKeyboardDirection({...e,key:'ArrowDown'},false),null);
});
