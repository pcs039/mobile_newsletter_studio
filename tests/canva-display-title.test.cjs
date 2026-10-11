/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=require('./canva-test-loader.cjs')();
const {canvaDisplayTitle:display}=load('src/lib/canva-display-title.ts');
const {textAutofill}=load('src/lib/canva-connect-contract.ts');
const {validateCanvaTitleOverride}=load('src/lib/canva-display-title.ts');
const {backgroundAutofill}=load('src/lib/canva-background-autofill.ts');

test('display title prefers punctuation and keeps the year/event phrase together',()=>{
 const title='가을빛으로 물드는 도심, 2026 시민문화축제 개최';
 assert.equal(display(title),'가을빛으로 물드는 도심,\n2026 시민문화축제 개최');
 for(const punctuation of [':','·','–','—'])assert.equal(display(title.replace(',',punctuation)),`가을빛으로 물드는 도심${punctuation}\n2026 시민문화축제 개최`);
 assert.equal(display('가을빛으로 물드는 도심, 2026 시민문화축제 개최, 가족 참여 프로그램 안내'),'가을빛으로 물드는 도심,\n2026 시민문화축제 개최,\n가족 참여 프로그램 안내');
});
test('manual display title overrides only title fields; null restores automatic and invalid overrides fail closed',()=>{
 const title='가을빛으로 물드는 도심, 2026 시민문화축제 개최';
 const template={templateType:'brand_template',externalId:'EA_TEST',fieldMappings:['EVENT_TITLE','EVENT_DATE','EVENT_PLACE'].map((field,index)=>({field,type:'text',source:index?'publicInfo.date':'article.title'}))};
 const fields=template.fieldMappings.map(mapping=>({field:mapping.field,type:'text',status:'ready',text:mapping.field==='EVENT_TITLE'?title:'원문 값'}));
 const dataset={dataset:{EVENT_TITLE:{type:'text'},EVENT_DATE:{type:'text'},EVENT_PLACE:{type:'text'}}};
 const before=JSON.stringify({template,fields});
 for(const override of ['짧은 제목','가을빛으로 물드는 도심,\n2026 시민문화축제 개최','가을빛으로 물드는 도심,\n2026 시민문화축제 개최,\n가족 참여 프로그램 안내','<script>alert(1)</script>']){
  const payload=textAutofill(template,fields,dataset,title,override);assert.equal(payload.data.EVENT_TITLE.text,override);assert.equal(payload.data.EVENT_DATE.text,'원문 값');assert.equal(payload.title,title);
  assert.equal(backgroundAutofill(template,fields,{dataset:{...dataset.dataset,BACKGROUND_IMAGE:{type:'image'}}},title,'M_IMAGE',override).data.EVENT_TITLE.text,override);
 }
 assert.equal(textAutofill(template,fields,dataset,title,null).data.EVENT_TITLE.text,display(title));assert.equal(JSON.stringify({template,fields}),before);
 assert.equal(validateCanvaTitleOverride('첫째\r\n둘째'),'첫째\n둘째');
 for(const value of ['', ' ', '줄\n\n줄', '1\n2\n3\n4', 'x'.repeat(501), {}, 1, 'title\u0000'])assert.throws(()=>textAutofill(template,fields,dataset,title,value),error=>error.status===400);
});
test('no punctuation uses balanced whole words; short, unbroken and deliberate multiline titles stay intact',()=>{
 for(const title of ['인천시 청년 창업지원사업 참여기업 모집','시민과 함께 만드는 지역 대표 문화행사 안내']){
  const result=display(title);assert.equal(result.split('\n').length,2);assert.equal(result.replaceAll('\n',' '),title);
  assert(result.split('\n').every(line=>line.split(' ').length>=2));
 }
 for(const title of ['시민문화축제 개최','짧은 제목','가'.repeat(40),'명시한 제목\n두 번째 줄'])assert.equal(display(title),title);
 const long='시민과 함께 만드는 지역 대표 문화행사 안내와 가족 참여 프로그램 및 지역 예술인 공연 일정 안내';
 const lines=display(long).split('\n');assert.equal(lines.length,3);assert(lines.every(line=>line.split(' ').length>=3));assert.equal(lines.join(' '),long);
});
test('Autofill derives article.title only; saved source hash, design name, other fields and caller objects remain unchanged',()=>{
 const title='가을빛으로 물드는 도심, 2026 시민문화축제 개최';
 const template={templateType:'brand_template',externalId:'EA_TEST',fieldMappings:[{field:'EVENT_TITLE',type:'text',source:'article.title'},{field:'NOTE',type:'text',source:'article.summary'}]};
 const fields=[{field:'EVENT_TITLE',type:'text',status:'ready',text:title},{field:'NOTE',type:'text',status:'ready',text:title}];
 const hash=()=>crypto.createHash('sha256').update(JSON.stringify({template,fields,title})).digest('hex');const before=hash();
 const payload=textAutofill(template,fields,{dataset:{EVENT_TITLE:{type:'text'},NOTE:{type:'text'}}},title);
 assert.equal(payload.data.EVENT_TITLE.text,display(title));assert.equal(payload.data.NOTE.text,title);assert.equal(payload.title,title);assert.equal(hash(),before);
 assert.deepEqual(textAutofill(template,fields,{dataset:{EVENT_TITLE:{type:'text'},NOTE:{type:'text'}}},title),payload);
});
