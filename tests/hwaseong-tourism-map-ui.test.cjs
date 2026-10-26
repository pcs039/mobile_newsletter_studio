/* eslint-disable @typescript-eslint/no-require-imports -- Isolated UI and image mocks; no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),loader=require('./canva-test-loader.cjs');
const {tourismPlaces}=loader()('src/lib/hwaseong-proposal-sample.ts');
function walk(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=walk(child,predicate);if(found)return found;}return null;}
function harness(){let state=[],cursor=0;const load=loader({'react':{...React,useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=v];},useRef:()=>({current:null}),useLayoutEffect:()=>{}}});
 const {TourismMap,tourismPinPositions}=load('src/components/hwaseong-proposal-reader.tsx');
 const sample={article:{id:'map'},cover:'/retained.png'},source='data:image/webp;base64,fixture';
 return {positions:tourismPinPositions,source,render:()=>{cursor=0;return TourismMap({sample,detailHref:'/detail',mapImage:source});}};
}
test('map keeps a fixed frame, loads eagerly, and exposes no overlays before image success',()=>{
 const h=harness(),tree=h.render(),img=walk(tree,n=>n.type==='img'),frame=walk(tree,n=>'data-tourism-map-frame' in n.props);
 assert.equal(frame.props.style.aspectRatio,'1024 / 700');assert.equal(img.props.loading,'eager');assert.equal(img.props.fetchPriority,'high');assert.equal(img.props.draggable,false);
 assert.equal(walk(tree,n=>'data-map-overlays' in n.props).props.style.visibility,'hidden');img.props.onLoad();
 assert.equal(walk(h.render(),n=>'data-map-overlays' in n.props).props.style.visibility,'visible');img.props.onError();
 assert.equal(walk(h.render(),n=>'data-map-overlays' in n.props).props.style.visibility,'hidden');
});
test('six pin tips remain within original polygons; pins/polygons select the same unchanged place links at either zoom',()=>{
 const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>0;
 try{const h=harness();
  for(const [i,p] of tourismPlaces.entries()){
   const [x,y]=h.positions[i],points=p.points.split(' ').map(s=>s.split(',').map(Number));let inside=false;
   for(let a=0,b=points.length-1;a<points.length;b=a++){const [ax,ay]=points[a],[bx,by]=points[b];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}
   assert(inside,`pin ${i+1} inside its existing polygon`);
   for(const pin of [true,false]){const tree=h.render(),target=walk(tree,n=>pin?n.props['data-map-pin']===p.id:n.type==='polygon'&&n.props.points===p.points);
    target.props.onClick();const shown=h.render();assert.equal(walk(shown,n=>n.type==='h3').props.children,p.name);
    const mapLink=walk(shown,n=>n.type==='a'&&n.props.href?.startsWith('https://map.kakao.com/link/search/'));assert.equal(mapLink.props.href,'https://map.kakao.com/link/search/'+encodeURIComponent(p.address+' '+p.name));
    assert.equal(walk(shown,n=>n.props['data-map-pin']===p.id).props['aria-pressed'],true);
   }
  }
  let tree=h.render();walk(tree,n=>n.type==='button'&&n.props.children==='지도 크게 보기').props.onClick();tree=h.render();
  assert.equal(walk(tree,n=>'data-tourism-map-frame' in n.props).props.style.minWidth,680);
  for(const p of tourismPlaces)assert(walk(tree,n=>n.props['data-map-pin']===p.id));
  assert('data-swipe-navigation-ignore' in tree.props); // Map pan/pinch stays isolated; ordinary image navigation is unchanged.
 }finally{global.requestAnimationFrame=previous;}
});
