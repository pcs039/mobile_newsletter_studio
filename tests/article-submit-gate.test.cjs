/* eslint-disable @typescript-eslint/no-require-imports -- Isolated request ownership regressions. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createArticleSubmitGate}=require('./canva-test-loader.cjs')()('src/lib/article-submit-gate.ts');
test('same-tick double submit obtains one ticket; failure releases it for explicit retry',()=>{
 const gate=createArticleSubmitGate(),first=gate.begin();assert(first);assert.equal(gate.begin(),null);assert(first.isCurrent());first.finish();const retry=gate.begin();assert(retry);assert.equal(gate.begin(),null);
});
test('article switch invalidates pending success before navigation/acknowledgement',()=>{
 const old=createArticleSubmitGate(),ticket=old.begin(),next=createArticleSubmitGate();old.invalidate();assert.equal(ticket.isCurrent(),false);assert.equal(old.begin(),null);assert(next.begin());ticket.finish();assert.equal(next.begin(),null);
});
test('effect setup/cleanup/setup permits new request without accepting old response or unlock',()=>{
 const gate=createArticleSubmitGate();gate.activate();const old=gate.begin();gate.invalidate();gate.activate();const current=gate.begin();assert(current.isCurrent());assert.equal(old.isCurrent(),false);old.finish();assert.equal(gate.begin(),null);current.finish();assert(gate.begin());
});
test('editor snapshots only accepted submit, gates late navigation, and workspace locks content/design during save',()=>{
 const editor=fs.readFileSync('src/components/project-article-editor-form.tsx','utf8'),handler=editor.slice(editor.indexOf('async function handleSubmit'),editor.indexOf('async function deleteArticle'));
 assert(handler.indexOf('submitGate.current.begin()')<handler.indexOf('new FormData(event.currentTarget)'));
 assert(handler.indexOf('!submission.isCurrent() || !savedArticle')<handler.indexOf('router.push'));
 assert(editor.includes('return () => gate.invalidate()'));
 const workspace=fs.readFileSync('src/components/article-workspace-tabs.tsx','utf8');assert(workspace.includes('<fieldset disabled={articleSaving}'));assert(workspace.includes('disabled={isDisabled || articleSaving}'));
});
