import type { ArticleDesignConcept } from "@/lib/article-design-concept";
import { buildPatternRecommendationInput } from "@/lib/article-pattern-recommendation";
import { getArticlePublicInfoEntries } from "@/lib/article-public-info-fields";
import type { ProjectContentArticle } from "@/lib/newsletter-repository";
import { canvaTemplateFamilies, canvaTemplateRegistry, type CanvaTemplateFamily, type CanvaTemplateVariant } from "@/lib/canva-template-registry";

export type TemplateRecommendationArticle = Pick<ProjectContentArticle, "title" | "summary" | "body" | "blocks" | "articleType" | "publicInfo">;
export type ArticleDesignTemplateRecommendation = {
  templateId: string; canvaBrandTemplateId: string; family: CanvaTemplateFamily;
  variant: CanvaTemplateVariant; displayName: string; rank: number; score: number; reason: string;
};

// Independent evidence groups, not keyword frequency. No provider or DB calls.
const signalRules = {
  policy: [/정책|지원사업|복지|보조금|지원금|지원금액/, "정책·지원"],
  benefit: [/혜택|지원내용|지원 내용|지원금액|보조금|지원금|장려금/, "금액·혜택"],
  eligibility: [/지원대상|지원 대상|신청자격|신청 자격|자격|대상/, "대상·자격"],
  apply: [/신청|접수/, "신청·접수"],
  recruit: [/모집|채용|참여기업|참여 기업/, "모집"],
  contest: [/공모|공모전|아이디어/, "공모·아이디어"],
  deadline: [/마감|기한|접수기간|접수 기간|신청기간|신청 기간/, "기간·마감"],
  steps: [/단계|절차|순서|단계별|\bSTEP\b/i, "단계·절차"],
  event: [/행사|축제|공연|전시|박람회|엑스포/, "행사 주제"],
  participation: [/참여|개최|관람|입장|방문/, "참여·개최"],
  schedule: [/일시|일정|장소|개막|공연장|전시장/, "일시·장소"],
  performance: [/공연|콘서트|연주|뮤지컬/, "공연"],
  exhibition: [/전시|미술관|박물관|문화시설/, "전시·문화시설"],
  expo: [/박람회|엑스포/, "박람회·엑스포"],
  interview: [/인터뷰|대담|주민 이야기/, "인터뷰·대담"],
  person: [/인물|기관장|주민|작가|시장|대표|프로필/, "인물·직함"],
  voice: [/발언|말했다|밝혔다|화자|인용|Q\s*[:.]|A\s*[:.]|질문|답변/i, "발언·문답"],
  profile: [/프로필|약력|경력|이력/, "프로필"],
  tourism: [/관광|명소|여행|관광지/, "관광·명소"],
  culture: [/문화|명소|관광|체험|박물관|미술관/, "문화·관광 주제"],
  experience: [/체험|프로그램|탐방/, "체험·프로그램"],
  story: [/이야기|풍경|감성|추억/, "감성 이야기"],
  statistics: [/통계|성과|수치|지표|KPI|증감|비교|추이/i, "통계·성과"],
  numbers: [/\d+(?:[.,]\d+)?\s*(?:%|명|건|원|억원|만원|배|회)/, "수치·단위"],
  compare: [/비교|대비|증감|두 값|전년|증가|감소/, "비교·증감"],
  trend: [/추이|시계열|연도별|월별|분기별|추세/, "시계열·추이"],
  multiKpi: [/복수.*(?:KPI|지표)|종합.*(?:성과|지표)|KPI\s*[1-4]|지표\s*[1-4]/i, "복수 지표"],
  summary: [/요약|핵심|한눈|카드뉴스/, "핵심 요약"],
  qa: [/Q\s*&\s*A|문답|자주 묻는|질문과 답변/i, "Q&A"],
  question: [/질문|Q\s*[:.]|\?/i, "질문"],
  answer: [/답변|A\s*[:.]|정답/i, "답변"],
  checklist: [/체크리스트|점검표|확인 목록/, "체크리스트"],
  check: [/점검|확인|준비물|항목/, "점검 항목"],
  comic: [/만평|만화|웹툰|컷/, "만화·만평"],
  character: [/캐릭터|등장인물/, "캐릭터"],
  dialogue: [/대화|대사|말풍선/, "대화·대사"],
  panels: [/[23]\s*컷|상황 흐름|장면/, "여러 장면"],
  explanation: [/설명|안내|해설/, "설명·안내"],
} as const;
type Signal = keyof typeof signalRules;
type Signals = Record<Signal, boolean>;
type FamilyEvidence = { family: CanvaTemplateFamily; score: number; labels: string[] };
const familyRules: Record<CanvaTemplateFamily, readonly (readonly [Signal, number])[]> = {
  policy_support: [["policy", 12], ["benefit", 9], ["eligibility", 6], ["apply", 3], ["steps", 4]],
  event_festival: [["event", 12], ["participation", 6], ["schedule", 6]],
  recruitment_contest: [["recruit", 12], ["contest", 12], ["apply", 4], ["deadline", 6], ["eligibility", 3]],
  interview_person: [["interview", 12], ["person", 6], ["voice", 7], ["profile", 5]],
  culture_tourism: [["culture", 10], ["tourism", 10], ["experience", 6], ["exhibition", 6], ["story", 5]],
  statistics_performance: [["statistics", 12], ["numbers", 6], ["compare", 6], ["trend", 8], ["multiKpi", 8]],
  cardnews: [["summary", 5], ["steps", 8], ["qa", 12], ["question", 5], ["answer", 5], ["checklist", 12], ["check", 6]],
  cartoon: [["comic", 12], ["character", 9], ["dialogue", 9], ["panels", 6]],
};
const coreSignals: Record<CanvaTemplateFamily, readonly Signal[]> = {
  policy_support: ["policy"], event_festival: ["event"], recruitment_contest: ["recruit", "contest"],
  interview_person: ["interview", "profile"], culture_tourism: ["culture", "tourism"],
  statistics_performance: ["statistics"], cardnews: ["summary", "steps", "qa", "checklist"], cartoon: ["comic", "character"],
};

function analyze(article: TemplateRecommendationArticle) {
  // Reuse saved visible paragraph selection and existing bounded text contract.
  const entries = getArticlePublicInfoEntries(article.publicInfo, article.articleType).filter(e => e.value.trim());
  const savedText = buildPatternRecommendationInput(article).replace(/^\[(제목|요약|본문|인용|정보|문단)\]\n/gm, "");
  const text = `${savedText}\n${entries.map(e => e.value.slice(0, 800)).join("\n")}`;
  const matchedTerms = Object.fromEntries(Object.entries(signalRules).map(([key, [rule]]) => [key, [...text.matchAll(new RegExp(rule.source, `${rule.flags}g`))].map(match => match[0].toLowerCase())])) as Record<Signal, string[]>;
  const signals = Object.fromEntries(Object.entries(signalRules).map(([key, [rule]]) => [key, rule.test(text)])) as Signals;
  const structuredSignals = new Set<Signal>();
  if (entries.some(e => ["dateTime", "place"].includes(e.key))) structuredSignals.add("schedule");
  if (entries.some(e => e.key === "target")) structuredSignals.add("eligibility");
  if (entries.some(e => e.key === "period")) structuredSignals.add("deadline");
  for (const signal of structuredSignals) signals[signal] = true;
  return { signals, matchedTerms, structuredSignals, infoCount: entries.length, textLength: article.summary.trim().length + article.body.trim().length };
}

function familyFitness(data: ReturnType<typeof analyze>, concept?: Pick<ArticleDesignConcept, "pattern" | "layoutDirection">): FamilyEvidence[] {
  const { signals, matchedTerms } = data;
  return (Object.keys(familyRules) as CanvaTemplateFamily[]).map(family => {
    const evidence = familyRules[family].filter(([signal]) => signals[signal]);
    // A lone keyword, date, article type or concept cannot classify an article.
    const distinctTerms = new Set(evidence.flatMap(([signal]) => matchedTerms[signal]));
    const supported = evidence.length >= 2 && (distinctTerms.size >= 2 || evidence.some(([signal]) => data.structuredSignals.has(signal))) && coreSignals[family].some(signal => signals[signal]);
    let score = supported ? evidence.reduce((total, [, weight]) => total + weight, 0) : 0;
    const patternFamily = { policy: "policy_support", event: "event_festival", interview: "interview_person", manual: "" } as const;
    if (score && concept && patternFamily[concept.pattern] === family) score += 2;
    return { family, score, labels: supported ? evidence.map(([signal]) => signalRules[signal][1]) : [] };
  });
}

// Explicit variant rules requested for v1. These do not change field mappings.
function variantFitness(family: CanvaTemplateFamily, variant: CanvaTemplateVariant, data: ReturnType<typeof analyze>) {
  const s = data.signals;
  const choose = (condition: boolean, label: string, points = 20): [number, string] => [condition ? points : 0, condition ? label : "기본 구성"];
  const rules: Record<CanvaTemplateFamily, Record<CanvaTemplateVariant, [number, string]>> = {
    policy_support: { "01": choose(data.infoCount >= 4, "여러 정보 항목을 균형 있게 표시", 12), "02": choose(s.benefit, "지원금액·혜택 강조"), "03": choose(s.steps && s.apply, "신청 단계 강조", 30), "04": choose(data.textLength <= 240, "짧은 요약 중심", 8) },
    event_festival: { "01": [4, "행사 기본 안내"], "02": choose(s.performance, "공연 중심"), "03": choose(s.exhibition, "전시 중심"), "04": choose(s.expo, "박람회·엑스포 중심") },
    recruitment_contest: { "01": [4, "모집 기본 안내"], "02": choose(data.textLength > 600, "설명이 많은 모집"), "03": choose(s.summary, "카드형 요약"), "04": choose(s.contest, "아이디어·공모전 강조", 30) },
    interview_person: { "01": [4, "인터뷰 기본 구성"], "02": choose(s.person && !s.profile, "인물 중심 메인", 12), "03": choose(s.explanation, "설명형 인터뷰"), "04": choose(s.profile, "프로필 강조", 30) },
    culture_tourism: { "01": choose(s.story, "문화 감성 스토리"), "02": choose(s.tourism, "관광명소 강조"), "03": choose(s.exhibition, "전시·문화시설 강조"), "04": choose(s.experience, "체험 프로그램 강조") },
    statistics_performance: { "01": [4, "핵심 숫자 강조"], "02": choose(s.compare, "두 값 비교"), "03": choose(s.trend, "시계열·추이 강조", 25), "04": choose(s.multiKpi, "복수 KPI 종합", 30) },
    cardnews: { "01": [4, "핵심 요약"], "02": choose(s.steps, "단계·절차 안내"), "03": choose(s.qa || (s.question && s.answer), "질문·답변 구성", 25), "04": choose(s.checklist, "체크리스트 구성", 30) },
    cartoon: { "01": [4, "1컷 메시지"], "02": choose(s.panels, "2~3컷 상황 흐름", 20), "03": choose(s.character && s.dialogue, "캐릭터 대화", 30), "04": choose(s.comic && s.policy && s.explanation, "정책 설명 만화", 35) },
  };
  return rules[family][variant];
}

export function recommendArticleDesignTemplates(article: TemplateRecommendationArticle,
  concept?: Pick<ArticleDesignConcept, "pattern" | "layoutDirection">): ArticleDesignTemplateRecommendation[] {
  const data = analyze(article);
  const families = familyFitness(data, concept);
  const hasEvidence = families.some(f => f.score > 0);
  const candidates = canvaTemplateRegistry.filter(t => t.datasetStatus === "verified" && (hasEvidence || t.family === "cardnews"));
  return candidates.map(template => {
    const evidence = families.find(f => f.family === template.family)!;
    const [variantScore, variantReason] = variantFitness(template.family, template.variant, data);
    // Family dominates variant. Scores are heuristic points, not probability.
    const score = hasEvidence ? evidence.score * 100 + (evidence.score ? variantScore : 0) : 0;
    return { priority: template.priority, recommendation: { templateId: template.id, canvaBrandTemplateId: template.canvaBrandTemplateId,
      family: template.family, variant: template.variant, displayName: template.displayName, rank: 0, score,
      reason: hasEvidence && evidence.score ? `${canvaTemplateFamilies[template.family]}: ${evidence.labels.slice(0, 3).join("·")} 신호. ${variantReason}.` : "분류 근거가 부족하여 검증된 카드뉴스 기본 후보를 제안합니다. 직접 확인해 주세요." } };
  }).sort((a, b) => b.recommendation.score - a.recommendation.score || a.priority - b.priority || (a.recommendation.templateId < b.recommendation.templateId ? -1 : a.recommendation.templateId > b.recommendation.templateId ? 1 : 0))
    .slice(0, 3).map(({ recommendation }, index) => ({ ...recommendation, rank: index + 1 }));
}
