/* eslint-disable @typescript-eslint/no-require-imports -- Private fixture rendering, no services. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),loader=require('./canva-test-loader.cjs');
const mocks={'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>React.createElement('div',{'data-size':true})},'@/components/public-article-audio-player':{PublicArticleAudioPlayer:p=>React.createElement('audio',{src:p.src})}};
const Tools=loader(mocks)('src/components/hwaseong-sample-reading-tools.tsx').SampleReadingTools;
test('one reading control, only a real compatible recording; mismatched tourism/comic stay hidden',()=>{
 for(const kind of ['policy','event','accessible','tourism','cartoon','interview','video'])for(const present of [true,false]){
 const sample={kind,article:{id:'a',audioFile:present?{previewHref:'/retained.mp3'}:null}};const before=JSON.stringify(sample);const h=renderToStaticMarkup(React.createElement(Tools,{sample}));assert.equal((h.match(/data-size/g)||[]).length,1);assert.equal(h.includes('<audio'),present&&!['tourism','cartoon'].includes(kind));assert(!h.includes('autoplay'));assert.equal(JSON.stringify(sample),before);
 }
});
test('shared cover control is opt-in, below its HTML heading in information and overlay modes',()=>{
 const Cover=loader(mocks)('src/components/public-mobile-article-reader.tsx').PublicNewsletterCoverView;
 const props={coverImageSrc:'/cover.webp',coverTitle:'표지 제목',coverSubtitle:'부제',coverIssueText:'시안',coverFit:'cover',hasArticles:true,slug:'private',onOpenToc(){},onStartReading(){}};
 for(const coverLayout of ['image_info','image_overlay']){const normal=renderToStaticMarkup(React.createElement(Cover,{...props,coverLayout}));assert(!normal.includes('data-size'));const h=renderToStaticMarkup(React.createElement(Cover,{...props,coverLayout,showTextSizeControl:true}));assert.equal((h.match(/data-size/g)||[]).length,1);assert(h.indexOf('</h2>')<h.indexOf('data-size'));assert(h.indexOf('data-size')<h.indexOf('부제'));}
});
