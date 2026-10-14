# GPT image quality rules v1

Existing Visual Director → GPT Image 2.5 Flare → draft Design Asset path is reused. No provider/Storage/schema/migration/dependency/approval/application changes.

## Deterministic style and composition

`director-image-quality.ts` scores independent title/summary topic groups plus actual article type, with Director reasons/publication/urgency only auxiliary. A solitary keyword does not select a specialized preset. Fixed tie ordering keeps repeated input stable. No new LLM calls.

- public_editorial: administrative/civic service; calm, trustworthy intuitive scene.
- public_illustration: digital learning/service explanations; flat, simple mobile-scale illustration.
- civic_lifestyle: welfare/health/age/community; generalized people, natural age diversity, no real-person likeness or skin retouching.
- culture_visual: culture/tourism/season/experience; attractive atmosphere, restrained public tone.
- conceptual_policy: AI/data/urban/policy concepts; abstract relationships, never a documentary reconstruction.

The unchanged Director factual-photo and urgent gates run first. Institution/HTML-only articles never gain generation eligibility from these styles. The existing explicit hybrid context still requires its approved conceptual role.

Default ratio is 4:5 (1536×1920). Existing life_civil/card-summary signals use 1:1 (1536×1536). Existing government_major or explicit PC/horizontal-banner/e-book signals use 16:9 (1536×864). Headline safe area is top, or center for square. No arbitrary client size/preset/prompt is accepted.

These sizes follow the current [official image prompting constraints](https://developers.openai.com/api/docs/guides/image-prompting): 16-pixel edges, allowed aspect/pixel range; each chosen size stays below the experimental resolution threshold. Provider/model/medium quality remain unchanged. Account-specific actual acceptance must be checked in fixed Staging.

## Prompt and variants

Pure base/style/composition/safety builders separate bounded article context from instructions. No source body or private URLs are sent. Institution color is a validated accent. Shared rules forbid letters/sentences/numbers/dates/contact/URL/CTA/logos/watermarks, documentary fakery, advertising/neon/gloss/cinematic excess, malformed anatomy and excess decoration. Safe area reserves separate HTML text. These are generation instructions, not automated visual-QA guarantees.

`qualityVersion=quality-v1` and `variantIndex=1..3` enter the existing spec/hash. Existing provenance JSON remains valid and unchanged; generationKey tracks the quality specification. Old assets/jobs are preserved. Changed quality specs intentionally do not reuse old prompt results. Every request still produces one image.

Only successful results show “다른 시안 생성”. The next index requires the previous same-article/spec variant's successful durable job and matching live asset. Failed/unknown cannot be skipped; no automatic retry. Each index has independent deterministic job/asset IDs; repeated same-index calls reuse existing success. Existing per-project cost/claim/unknown protections remain. Article/project/source changes remount UI state; old async results cannot appear in a new session.

## Validation and rollout

Local tests cover all five presets, real/urgent exclusions, ratios/safe areas/brand/safety, deterministic keys, variant predecessor checks, durable duplicate reuse, explicit double-click protection, stale UI session and existing draft/provenance path.

Five actual React fixture screens checked at 1440/768: compact labels, no raw prompt display, overflow 0, console errors 0. Local fixtures do not generate images.

Fixed Staging actual E2E is pending at initial PR creation. Maximum two provider generations permitted; Production generation/write forbidden. PR remains OPEN and must not merge as part of this task.

## PNG validation budget

The first fixed Staging attempt on edd772c ended in terminal failed before asset registration. The previous UI returned a generic failure, so that observation alone does not prove its exact cause. Investigation found the shared 2.5MB generation validator can reject larger 1536px PNGs. Director specs now explicitly carry a 10MB maxOutputBytes budget, bounded by the existing Design Asset PNG limit; legacy generation/approval keeps its 2.5MB default. MIME/PNG integrity/exact dimensions and no-overwrite registration remain unchanged. Validation policy enters the hash, so it is a new plan, not a retry of the old failed job. Safe known validation errors are surfaced without provider bodies/credentials. Actual provider attempts remain capped at two for this task.
