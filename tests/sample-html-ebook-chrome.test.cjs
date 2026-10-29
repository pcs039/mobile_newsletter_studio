/* eslint-disable @typescript-eslint/no-require-imports -- Isolated HTML viewer contracts, no network or content writes. */
const test = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { SampleDisplayToolbar, SampleEbookThumbnails } = require('./canva-test-loader.cjs')()('src/components/sample-html-ebook-chrome.tsx');
const base = { mode:'ebook', onMode(){}, spread:true, onSpread(){}, zoom:100, onZoom(){}, fit:true, onFit(){}, article:true, contentsHref:'/contents', onNavigate(){} };
test('responsive fit is a distinct selected layout mode; manual magnification remains available',()=>{
 const fit=renderToStaticMarkup(React.createElement(SampleDisplayToolbar,base));
 assert.match(fit,/aria-label="e-book 확대율">자동 맞춤/);
 assert.match(fit,/aria-pressed="true">화면 맞춤/);
 const manual=renderToStaticMarkup(React.createElement(SampleDisplayToolbar,{...base,fit:false,zoom:150}));
 assert.match(manual,/aria-label="e-book 확대율">150%/);
 assert.match(manual,/aria-pressed="false">화면 맞춤/);
 assert.match(manual,/aria-label="e-book 축소"/); assert.match(manual,/aria-label="e-book 확대"/);
});
test('two-page control is selected for articles and unavailable on the cover or contents',()=>{
 assert.match(renderToStaticMarkup(React.createElement(SampleDisplayToolbar,base)),/aria-pressed="true">2쪽 · 요약\/상세/);
 assert.match(renderToStaticMarkup(React.createElement(SampleDisplayToolbar,{...base,article:false})),/disabled="">2쪽 · 요약\/상세/);
});
test('fullscreen keeps the same article thumbnails with current-page and authenticated same-reader links',()=>{
 const pages=[{id:'cover',title:'표지',href:'/projects/sample/samples?display=ebook'},{id:'article-02',title:'관광',href:'/projects/sample/samples?articleId=article-02&display=ebook'}];
 const html=renderToStaticMarkup(React.createElement(SampleEbookThumbnails,{pages,currentId:'article-02',visible:true,onNavigate(){}}));
 assert.match(html,/aria-label="e-book 썸네일 목차"/);
 assert.match(html,/articleId=article-02&amp;display=ebook" aria-current="page"/);
 assert.doesNotMatch(html,/hidden/);
});
