/* eslint-disable @typescript-eslint/no-require-imports -- Pure diagnostics and UI, no remote traffic. */
const test = require('node:test'), assert = require('node:assert/strict'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./canva-test-loader.cjs')();
const { prepareCanvaContentFit: fit, buildCanvaContentFitReview: review } = load('src/lib/canva-content-fit.ts');
const { CanvaContentFitReview: Panel } = load('src/components/design/canva-content-fit-review.tsx');
const { getCanonicalCanvaTemplate: template } = load('src/lib/canva-template-registry.ts');
const samples = require('./fixtures/canva-content-fit-calibration.json');
const raw = values => ({ templateId: samples.templateId, canvaBrandTemplateId: samples.canvaBrandTemplateId, datasetStatus: 'verified',
  isReady: true, missingFields: [], textFields: Object.fromEntries(Object.entries(values).map(([key,text]) => [key,{type:'text',status:'ready',text,source:'article.title'}])),
  payload: { brand_template_id: samples.canvaBrandTemplateId, data: Object.fromEntries(Object.entries(values).map(([key,text]) => [key,{type:'text',text}])) } });
const render = props => renderToStaticMarkup(React.createElement(Panel, props));

test('observed fixtures produce redacted per-field diagnostics, no source or payload changes', () => {
  for (const sample of Object.values(samples.samples)) {
    const input = raw(sample.values), before = JSON.stringify(input), result = fit(input), dto = review(result,{width:900,height:1200});
    assert.equal(JSON.stringify(input), before); assert.equal(result.visualReady,sample.visualReady);
    assert.equal(dto.fields.length,5); assert(!JSON.stringify(dto).includes(sample.values.TITLE));
    assert(!('payload' in dto)); assert(!('originalText' in dto.fields[0]));
    const html = render({templateId:input.templateId,review:dto});
    assert(html.includes('저장된 기사 입력 검토 결과')); assert(html.includes('900 × 1200px'));
    assert(html.includes('적합성 미확인')); assert(html.includes('최종 검토 필요') || html.includes('수정 후 재확인'));
  }
});

test('policy/interview fields are known but capacities never borrowed from event calibration', () => {
  for (const id of ['policy_support_01','interview_person_01','event_festival_01']) {
    const t = template(id), result = fit({...raw(samples.samples.long.values),templateId:id,canvaBrandTemplateId:t.canvaBrandTemplateId});
    assert(!result.supported); assert.equal(result.fields.length,0); assert.equal(result.payload,null);
    const html = render({templateId:id,review:review(result)});
    assert(html.includes('디자인 적합성 미검증')); assert(html.includes('등록 필드'));
    assert(!html.includes('8자')); assert(!html.includes('안전 범위 안'));
  }
});

test('landscape, portrait and low-resolution input never receive invented slot or resolution approval', () => {
  const result = fit(raw(samples.samples.short.values));
  for (const [width,height,accepted] of [[1600,900,false],[900,1600,false],[300,400,true],[30,40,true]]) {
    const dto = review(result,{width,height}); assert.equal(dto.image.sourceRatioAccepted,accepted);
    const html = render({templateId:result.templateId,review:dto});
    assert(html.includes(`${width} × ${height}px`)); assert(html.includes('최소 해상도가 미확인'));
    assert(!html.includes('이미지 적합성 통과'));
  }
  for (const image of [undefined,{width:0,height:400},{width:NaN,height:400},{width:1.5,height:2}]) {
    assert.deepEqual(review(result,image).image,{sourceWidth:null,sourceHeight:null,sourceRatioAccepted:null});
  }
});

test('unknown, mismatched and checking states never show old input as checked', () => {
  const dto = review(fit(raw(samples.samples.short.values)));
  for (const props of [{templateId:'event_festival_02',review:{...dto,templateId:'other'}},{templateId:'event_festival_02',review:dto,checking:true}]) {
    const html = render(props); assert(!html.includes('저장된 기사 입력 검토 결과')); assert(html.includes('현재 입력 미검사'));
  }
  assert(render({templateId:'unknown'}).includes('검증된 필드 목록 없음'));
});

test('special characters/newlines are counted without shortening or claiming actual automatic wrapping', () => {
  for (const text of ['문화축제','문화\n축제','문화\r\n축제','문화🎉&<','긴 제목입니다'.repeat(8)]) {
    const input = raw({...samples.samples.short.values,TITLE:text}), dto = review(fit(input));
    assert.equal(dto.fields[0].characterCount,Array.from(text.replace(/\r\n?/g,'\n')).length);
    assert.equal(input.textFields.TITLE.text,text);
    assert(render({templateId:input.templateId,review:dto}).includes('자동 줄바꿈이나 최종 결과를 보장'));
  }
});
