import { hybridStrategyAllowed } from "@/lib/hybrid-visual-plan";
import { analyzeArticleVisualNeeds, buildVisualDirectorResult, type VisualDirectorArticle } from "@/lib/article-visual-director";
import { getArticlePublicInfoEntries } from "@/lib/article-public-info-fields";
export const graphicTypeLabels={steps:"신청 절차형",key_numbers:"핵심 숫자형",comparison:"비교형",checklist:"확인 목록형",schedule:"일정형"} as const;
export type InformationGraphicType=keyof typeof graphicTypeLabels;
export type InformationGraphicItem={label:string;description:string;source:{path:string;blockId?:string;originalText:string}};
export type InformationGraphicSpec={version:"v1";purpose:"article_information_graphic";graphicType:InformationGraphicType;title:string;subtitle?:string;items:InformationGraphicItem[];
  aspectRatio:"4:5"|"1:1";layoutVariant:"public_cards_v1";sourceArticleId:string;needsHumanReview:boolean;issues:string[]};
export type GraphicPlan={status:"ready"|"needs_review"|"not_supported";specification:InformationGraphicSpec|null;issues:string[]};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const number=/\d[\d,.]*\s*(?:%|명|건|원|만원|억원|일|시간|개|배)/;
const date=/\d{1,4}\s*(?:년|월|일)|\d{1,2}:\d{2}|\d{4}[./-]\d{1,2}[./-]\d{1,2}/;
function item(text:string,path:string,blockId?:string):InformationGraphicItem {
  const normalized=text.trim().replace(/^\s*(?:\d+[.)]|[-•✓✔])\s*/,"");
  const colon=normalized.indexOf(": ");
  return {label:colon>=0?normalized.slice(0,colon):normalized,description:colon>=0?normalized.slice(colon+2):"",source:{path,blockId,originalText:text.trim()}};
}
// Extract explicit lists/structured fields only. Never infer a quantity, date or
// missing step; never summarize or ellipsize an oversized source.
export function buildInformationGraphicSpec(article:VisualDirectorArticle,articleId:string,context?:"hybrid"):GraphicPlan {
  const director=buildVisualDirectorResult(article);
  if(!uuid.test(articleId)||!(director.primaryStrategy==="information_graphic"||(context==="hybrid"&&hybridStrategyAllowed(article,"information_graphic")))||!director.needsInformationGraphic)return{status:"not_supported",specification:null,issues:["저장된 정보 시각화 기사에서만 생성할 수 있습니다."]};
  const paragraphs=article.blocks.filter(b=>b.type==="paragraph");
  const raw:Array<{text:string;path:string;blockId?:string}>=paragraphs.length?paragraphs.filter(b=>b.isVisible).map(b=>({text:b.body,path:"block.body",blockId:b.id})):[{text:article.body,path:"article.body"}];
  if(raw.some(r=>r.text.length>6000))return{status:"not_supported",specification:null,issues:["원자료가 길어 핵심 목록 확인이 필요합니다."]};
  const seen=new Set<string>();const lines=raw.flatMap(r=>r.text.split(/\r?\n/).flatMap(t=>{const s=t.trim();if(!s||seen.has(s))return[];seen.add(s);return[{text:s,path:r.path,blockId:"blockId" in r?r.blockId:undefined}];}));
  const entries=getArticlePublicInfoEntries(article.publicInfo,article.articleType);
  const structured=entries.map(e=>({label:e.label,description:e.value,source:{path:`publicInfo.${e.key}`,originalText:e.value}}));
  const evidence=[article.title,article.summary,...lines.map(l=>l.text)].join("\n");
  const numbered=lines.filter(l=>/^\d+[.)]\s*\S/.test(l.text));
  const arrow=entries.find(e=>e.key==="method"&&/→|->/.test(e.value));
  const listed=lines.filter(l=>/^(?:\d+[.)]|[-•✓✔])\s*\S/.test(l.text));
  const colon=lines.filter(l=>/^[^:]{1,30}:\s+\S/.test(l.text));
  let graphicType:InformationGraphicType|undefined,items:InformationGraphicItem[]=[];
  if(/절차|단계|순서|신청|이용/.test(evidence)&&(numbered.length>=2||arrow)){
    graphicType="steps";items=arrow?arrow.value.split(/→|->/).map(v=>item(v,"publicInfo.method")):numbered.map(l=>item(l.text,l.path,l.blockId));
  }else if(/일정|시간표|기간/.test(evidence)&&([...colon,...listed].filter(l=>date.test(l.text)).length>=2||structured.filter(e=>date.test(e.description)).length>=2)){
    graphicType="schedule";items=structured.filter(e=>date.test(e.description));if(items.length<2)items=[...colon,...listed].filter(l=>date.test(l.text)).map(l=>item(l.text,l.path,l.blockId));
  }else if(/비교|대비|전후|전년|올해|작년/.test(evidence)&&colon.filter(l=>number.test(l.text)).length>=2){
    graphicType="comparison";items=colon.filter(l=>number.test(l.text)).map(l=>item(l.text,l.path,l.blockId));
  }else if([...structured.filter(e=>number.test(e.description)),...colon.filter(l=>number.test(l.text))].length>=2){
    graphicType="key_numbers";items=structured.filter(e=>number.test(e.description));if(items.length<2)items=colon.filter(l=>number.test(l.text)).map(l=>item(l.text,l.path,l.blockId));
  }else if(/조건|준비|체크리스트|확인사항|점검/.test(evidence)&&listed.length>=2){
    graphicType="checklist";items=listed.map(l=>item(l.text,l.path,l.blockId));
  }
  if(!graphicType)return{status:"not_supported",specification:null,issues:["명시적인 단계·일정·수치·비교·목록을 확인해 주세요. 지도나 긴 설명을 임의로 그래픽화하지 않습니다."]};
  if(graphicType!=="steps"&&graphicType!=="checklist")items=items.filter((v,i,all)=>all.findIndex(x=>x.label===v.label&&x.description===v.description)===i);
  const issues:string[]=[];
  if(graphicType==="steps"&&!arrow&&numbered.some((l,i)=>Number(l.text.match(/^\d+/)?.[0])!==i+1))issues.push("단계 번호와 순서를 확인해 주세요.");
  if(article.title.trim().length>40||!article.title.trim()||/[\u0000-\u001f\u007f]/.test(article.title))issues.push("제목은 1~40자로 확인해 주세요.");
  if(items.length<2||items.length>6)issues.push("핵심 항목은 2~6개로 확인해 주세요.");
  if(items.some(i=>!i.label||i.label.length>20||i.description.length>60))issues.push("항목 이름 20자·설명 60자 이내로 확인해 주세요.");
  if(raw.some(r=>r.text.length>6000)||items.some(i=>/[\u0000-\u001f\u007f]/.test(i.label+i.description)))issues.push("긴 원자료나 제어 문자가 있어 확인이 필요합니다.");
  if(context==="hybrid" ? analyzeArticleVisualNeeds(article).map || analyzeArticleVisualNeeds(article).insufficient : director.humanInputRequired)issues.push(director.humanInputReason||"원본 자료 확인이 필요합니다.");
  const aspectRatio=graphicType==="key_numbers"&&items.length<=3?"1:1":"4:5";
  const rowHeight=Math.floor(((aspectRatio==="1:1"?1000:1250)-70-282-12*(items.length-1))/Math.max(items.length,1));
  if(items.some(i=>78+Math.max(0,wrap(i.description,48).length-1)*40+10>rowHeight))issues.push("항목 설명의 전체 배치 길이를 확인해 주세요.");
  const specification:InformationGraphicSpec={version:"v1",purpose:"article_information_graphic",graphicType,title:article.title.trim(),items,
    aspectRatio,layoutVariant:"public_cards_v1",sourceArticleId:articleId,needsHumanReview:issues.length>0,issues};
  return{status:issues.length?"needs_review":"ready",specification,issues};
}
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
function wrap(text:string,units:number){const out:string[]=[];let line="",used=0;for(const char of text){const width=2;if(used+width>units){out.push(line);line="";used=0;}line+=char;used+=width;}if(line)out.push(line);return out;}
export function renderInformationGraphicSvg(spec:InformationGraphicSpec,primaryColor:string){
  if((spec.aspectRatio==="1:1"&&spec.items.length>3)||spec.needsHumanReview||spec.items.length<2||spec.items.length>6||spec.title.length>40||spec.items.some(i=>i.label.length>20||i.description.length>60))throw new Error("Graphic requires review");
  const brand=/^#[a-f0-9]{6}$/i.test(primaryColor)?primaryColor:"#092046",height=spec.aspectRatio==="1:1"?1000:1250;
  const text=(value:string,x:number,y:number,size:number,units:number,bold=false)=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${bold?700:400}" fill="#0f172a">${wrap(value,units).map((s,i)=>`<tspan x="${x}" dy="${i?size+8:0}">${escape(s)}</tspan>`).join("")}</text>`;
  const rowHeight=Math.floor((height-70-282-12*(spec.items.length-1))/spec.items.length);
  if(spec.items.some(i=>78+Math.max(0,wrap(i.description,48).length-1)*40+10>rowHeight))throw new Error("Graphic layout requires review");
  const cards=spec.items.map((i,n)=>{const y=282+n*(rowHeight+12);return`<rect x="64" y="${y}" width="872" height="${rowHeight}" rx="16" fill="#f1f5f9"/><rect x="64" y="${y+16}" width="6" height="${rowHeight-32}" fill="${brand}"/>${text(spec.graphicType==="steps"?String(n+1):spec.graphicType==="checklist"?"✓":"•",92,y+39,30,4,true)}${text(i.label,152,y+40,38,40,true)}${text(i.description,152,y+78,32,48,spec.graphicType==="key_numbers"||spec.graphicType==="comparison")}`;}).join("");
  return`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img"><title>${escape(spec.title)}</title><desc>${escape(graphicTypeLabels[spec.graphicType])}</desc><rect width="1000" height="${height}" fill="#fff"/><rect width="1000" height="12" fill="${brand}"/><g font-family="sans-serif">${text(spec.title,64,74,50,34,true)}${text(graphicTypeLabels[spec.graphicType],64,248,26,50)}${cards}${text("기사에 저장된 핵심 정보 · 상세 내용은 원문 확인",64,height-28,22,76)}</g></svg>`;
}
