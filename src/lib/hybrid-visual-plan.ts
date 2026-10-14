import { analyzeArticleVisualNeeds, buildVisualDirectorResult, type VisualDirectorArticle, type VisualStrategy } from "@/lib/article-visual-director";
import { recommendArticleDesignTemplates } from "@/lib/article-design-template-recommendation";
import { visualArticleSnapshot } from "@/lib/article-visual-source-snapshot";
export type HybridStrategy=Exclude<VisualStrategy,"hybrid">;
export type HybridStep={strategy:HybridStrategy;purpose:"hero"|"supporting";required:boolean;assetRequired:boolean;recommendationOnly?:boolean};
export type HybridVisualPlan={version:"v1";primary:HybridStep;secondary?:HybridStep;reasons:string[];humanReviewRequired:true;executionOrder:HybridStrategy[]};
export type HybridStage={status:"not_started"|"ready"|"in_progress"|"completed"|"needs_input"|"failed";assetId?:string;recommendationKey?:string};
export function determineHybridPrimary(article:VisualDirectorArticle):HybridStrategy {
  const e=analyzeArticleVisualNeeds(article);
  if(e.needsRealPhoto)return "institution_asset";
  if(e.conceptual&&e.information)return "ai_generated_image";
  return "information_graphic";
}
export function determineHybridSecondary(article:VisualDirectorArticle,primary:HybridStrategy):HybridStrategy {
  const e=analyzeArticleVisualNeeds(article);
  if(primary==="institution_asset")return e.information?"information_graphic":e.canvaCompanion?"canva_full_layout":"html_first";
  return primary==="ai_generated_image"?"information_graphic":"html_first";
}
export function buildHybridVisualPlan(article:VisualDirectorArticle):HybridVisualPlan|null {
  const director=buildVisualDirectorResult(article);
  if(director.primaryStrategy!=="hybrid")return null;
  const primary=determineHybridPrimary(article),secondary=determineHybridSecondary(article,primary);
  const step=(strategy:HybridStrategy,purpose:"hero"|"supporting"):HybridStep=>({strategy,purpose,required:purpose==="hero",assetRequired:!["html_first","canva_full_layout"].includes(strategy),...(strategy==="canva_full_layout"?{recommendationOnly:true}:{})});
  return {version:"v1",primary:step(primary,"hero"),secondary:step(secondary,"supporting"),
    reasons:primary==="institution_asset"?["실제 대상의 사실성을 유지하기 위해 기관 사진을 먼저 확인합니다.",secondary==="information_graphic"?"절차·수치는 별도의 정보그래픽으로 전달합니다.":secondary==="canva_full_layout"?"안내용 Canva 템플릿은 추천 후보로만 확인합니다.":"인터뷰·상세 설명은 읽을 수 있는 HTML로 유지합니다."]:[primary==="ai_generated_image"?"실제 기록사진이 필요하지 않은 개념 이미지를 먼저 준비합니다.":"저장된 핵심 수치·절차를 먼저 시각화합니다.",secondary==="information_graphic"?"정확한 수치·절차는 정보그래픽으로 분리합니다.":"긴 설명은 HTML로 유지합니다."],
    humanReviewRequired:true,executionOrder:[primary,secondary]};
}
export function hybridStrategyAllowed(article:VisualDirectorArticle,strategy:HybridStrategy) {
  const plan=buildHybridVisualPlan(article);
  return !!plan&&(plan.primary.strategy===strategy||plan.secondary?.strategy===strategy);
}
export function buildHybridExecutionState(plan:HybridVisualPlan,primary:HybridStage,secondary:HybridStage,stale=false) {
  const readyForReview=!stale&&primary.status==="completed"&&(!plan.secondary||secondary.status==="completed");
  return {primaryStatus:primary.status,secondaryStatus:secondary.status,status:stale?"stale":primary.status==="needs_input"?"blocked":readyForReview?"ready_for_review":primary.status==="failed"?"failed":secondary.status==="failed"?"partial":"preparing",
    primaryAssetId:primary.assetId,secondaryAssetId:secondary.assetId,primaryStrategy:plan.primary.strategy,secondaryStrategy:plan.secondary?.strategy,readyForReview,humanReviewRequired:true as const};
}
export function stageFromExecution(status:string,assetId?:string,recommendationKey?:string):HybridStage {
  return {status:status==="success"?"completed":status==="ready"?"ready":status==="in_progress"?"in_progress":status==="failed"?"failed":"needs_input",...(assetId?{assetId}:{}),...(recommendationKey?{recommendationKey}:{})};
}
export function hybridCanvaRecommendations(article:VisualDirectorArticle) {
  return buildHybridVisualPlan(article)?.secondary?.strategy==="canva_full_layout"?recommendArticleDesignTemplates(article).filter(r=>r.score>0):[];
}
export async function buildHybridRecommendation(article:VisualDirectorArticle,articleId:string,primary:HybridStage,secondary:HybridStage) {
  const plan=buildHybridVisualPlan(article);if(!plan)return null;
  // Recommendation keys already digest their safe source/asset/spec inputs. Never hash preview URLs, paths or tokens.
  const recommendation=(s:HybridStage)=>/^[a-f0-9]{64}$/.test(s.recommendationKey??"")?s.recommendationKey:null;
  const data={articleId,articleSnapshot:visualArticleSnapshot(article),director:buildVisualDirectorResult(article),plan,
    primaryRecommendationSnapshot:recommendation(primary),secondaryRecommendationSnapshot:recommendation(secondary),canvaCandidates:hybridCanvaRecommendations(article).map(t=>t.templateId),orchestratorVersion:"v1"};
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(data)));
  return {plan,hybridKey:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")};
}
