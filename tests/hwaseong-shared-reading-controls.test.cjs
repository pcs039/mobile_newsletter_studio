/* eslint-disable @typescript-eslint/no-require-imports -- React hook fixture and fake audio only, no provider or storage calls. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),loader=require('./canva-test-loader.cjs');
function children(node){return React.Children.toArray(node?.props?.children);}
function find(node,predicate){if(node&&predicate(node))return node;for(const c of children(node)){const found=find(c,predicate);if(found)return found;}}
test('summary/detail controls share one audio element, play/pause, seek and playback speed',async()=>{
 const audio={paused:true,currentTime:12,duration:60,playbackRate:1,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
 const values=[1,[{index:0,url:'/existing.mp3'}],0,false,12,60,'ready'];let cursor=0,refs=0,portal;
 const hooks={...React,useState:init=>{const i=cursor++;if(!(i in values))values[i]=typeof init==='function'?init():init;return[values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},useRef:value=>({current:refs++===0?audio:value}),useEffect:()=>{},useCallback:fn=>fn};
 const Player=loader({react:hooks,'react-dom':{createPortal:(node,target)=>{portal={node,target};return React.createElement('div',{'data-portal':true},node);}}})('src/components/public-article-audio-player.tsx').PublicArticleAudioPlayer,target={};
 const render=()=>{cursor=0;refs=0;return Player({ariaLabel:'shared',src:'/existing.mp3',controlsPortalTarget:target});};
 let tree=render();assert.equal(portal.target,target);
 assert.equal(find(portal.node,n=>n.type==='audio'),undefined);assert(find(tree,n=>n.type==='audio'));
 const summary=tree.props.children[1],mirror=portal.node.props.children;assert.equal(summary,mirror);
 find(mirror,n=>n.props?.['aria-label']==='기사 음성 재생').props.onClick();await Promise.resolve();await Promise.resolve();assert.equal(audio.paused,false);
 tree=render();assert(find(children(tree)[1],n=>n.props?.['aria-label']==='기사 음성 일시정지'));assert(find(portal.node,n=>n.props?.['aria-label']==='기사 음성 일시정지'));
 find(portal.node,n=>n.props?.['aria-label']==='기사 음성 재생 위치').props.onChange({currentTarget:{value:'27'}});assert.equal(audio.currentTime,27);
 const speed=find(portal.node,n=>typeof n.type==='function'&&n.props?.setPlaybackRate);speed.props.setPlaybackRate(1.5);tree=render();assert.equal(find(children(tree)[1],n=>typeof n.type==='function'&&n.props?.setPlaybackRate).props.playbackRate,1.5);
 find(portal.node,n=>n.props?.['aria-label']==='기사 음성 일시정지').props.onClick();assert.equal(audio.paused,true);assert.equal(values[3],false);
});
test('shared disclosure icons point down to expand and up to collapse at the same size',()=>{
 const {renderToStaticMarkup}=require('react-dom/server'),{SampleDisclosureIcon}=loader()('src/components/hwaseong-sample-navigation.tsx');
 const down=renderToStaticMarkup(React.createElement(SampleDisclosureIcon)),up=renderToStaticMarkup(React.createElement(SampleDisclosureIcon,{expanded:true}));assert.match(down,/>↓</);assert.match(up,/>↑</);assert.equal(down.replace('↓','↑'),up);
});
