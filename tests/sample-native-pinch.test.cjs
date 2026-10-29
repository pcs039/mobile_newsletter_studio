/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser/portal contract tests, no network. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),loader=require('./canva-test-loader.cjs');
const {sampleNativeZoomed}=loader()('src/lib/hwaseong-sample-navigation.ts');
test('native viewport scale guard has a stable unzoomed fallback and permits normal browsing after pinch-in',()=>{
 for(const scale of [undefined,NaN,1,1.0001,0.9])assert.equal(sampleNativeZoomed(scale),false);
 for(const scale of [1.1,2,5])assert.equal(sampleNativeZoomed(scale),true);
});
function nodes(node,predicate){if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(n=>nodes(n,predicate))];}
test('sample lightbox opts into native pinch without changing shared reader defaults; closing restores original body scroll policy',()=>{
 const effects=[],events={};const oldDocument=global.document,oldWindow=global.window;let closed=0;
 global.document={body:{style:{overflow:'auto'}}};global.window={addEventListener:(name,fn)=>events[name]=fn,removeEventListener:(name)=>delete events[name]};
 const Component=loader({react:{...React,useEffect:f=>effects.push(f)},'react-dom':{createPortal:e=>e}})('src/components/public-article-image-lightbox.tsx').PublicArticleImageLightbox;
 try{
  const tree=Component({image:{src:'/same-original.webp',alt:'원본'},allowBrowserPinch:true,onClose:()=>closed++});
  assert.equal(tree.props.style.touchAction,'pan-x pan-y pinch-zoom');assert.equal(nodes(tree,n=>n.type==='img')[0].props.style.touchAction,'pan-x pan-y pinch-zoom');assert.equal(nodes(tree,n=>n.type==='img')[0].props.src,'/same-original.webp');
  const cleanup=effects[0]();assert.equal(document.body.style.overflow,'hidden');events.keydown({key:'Escape'});assert.equal(closed,1);cleanup();assert.equal(document.body.style.overflow,'auto');
  const ordinary=Component({image:{src:'/same-original.webp',alt:'원본'},onClose:()=>{}});assert.equal(ordinary.props.style.touchAction,undefined);assert.equal(nodes(ordinary,n=>n.type==='img')[0].props.style,undefined);
 }finally{global.document=oldDocument;global.window=oldWindow;}
});
