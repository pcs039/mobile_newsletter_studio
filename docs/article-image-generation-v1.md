# GPT Images visual asset generation v1

## Scope and contract

Staging ref mvrkpmffuhcqwisqvpqi only; VERCEL_ENV=production always rejects generation/approval.
No new migration/RPC/dependency. Reuse OPENAI_API_KEY (server only), existing private
 design-production-assets bucket, write transport, source=openai metadata and background/illustration types.
Only hero_background / hero_illustration may generate; decoration/pattern remain plans.
Production shows no generation action; the server independently enforces the Staging gate.

POST /api/project-content/visual-asset-generation: generate / approve. Requires same origin,
admin role, same project and a saved Supabase article. No public/review integration.
Server re-reads approved project brand and current article frame colors, validates concept and
recomputes specification. Never accept client prompt/palette/specification, image URL or asset ID.
The deterministic prompt includes every specification field. Concept name/description/rationale,
article source text, private metadata, paths and Canva data are not sent to the provider.

## Provider and style

Official documentation: https://developers.openai.com/api/reference/resources/images/methods/generate
Explicit gpt-image-2.5-flare, n=1, quality=medium, PNG. Existing gpt-image-2 accepted opaque output
but this account rejected background=transparent with invalid_value (400). No automatic model fallback.
Both roles use the same model and style family: approved palette, clean rounded edges,
flat matte 2D, minimal texture, no shadows. HTML owns text; forbid words/numbers/logos/watermarks.
No guarantee of pixel-identical output or automatic OCR/style assessment; human approval remains required.
Background safe area stays quiet; illustration is an independent transparent overlay.
API output uses 1152×1536 / 1152×768 to preserve 3:4 / 3:2 while meeting the API's divisible-by-16
resolution rule. Planned 1080×1440 / 1080×720 sizes remain design references, not distorted outputs.
PNG signature/chunks/CRC/size/resolution are checked; illustration additionally requires actual alpha
pixels. Result size ≤2.5 MB for Vercel request/response limits. Provider timeout 240s; no POST retries.

## Approval and recovery

Generation writes no application DB/Storage. Result bytes stay in browser memory (and bounded
short-lived per-instance duplicate-response cache); no disk, localStorage or permanent upload.
An HMAC proof binds result hash, server asset UUID, admin, project, article, role and 15-minute expiry.
Approval rechecks auth/scope/hash/PNG before any write. No proof or credential logging.
Only approval uploads to a deterministic private path and inserts the existing asset row with
approval_status=approved, source=openai, project reuse scope and role transparency. No Composition write.
Asset PK + non-overwrite path prevent duplicate approval registration across instances.
Ambiguous approval is recovered by repeating the same approval; never replace/cancel an approval
already attempted. Storage-upload/row-insert is the existing non-atomic transport: interrupted approval
may leave a file pending recovery. It does not claim cross-service atomicity; administrators must resolve
an interrupted/expired approval rather than regenerate blindly. No new bucket or policy.
UI says refresh to pick the asset; it is never placed automatically.

## Cost boundary

UI disables simultaneous actions and asks confirmation before replacing an existing preview.
Per-instance generation guard joins same requestKey, rejects changed keys while another generation
runs, caches failures without automatic retry, limits six requests per admin/project/hour and bounds memory.
This is not distributed quota or exactly-once billing across Vercel instances/cold starts. A later Production
rollout must separately resolve distributed coordination; this feature remains Staging-only.

## Validation

Actual Staging endpoint: both roles generated successfully with gpt-image-2.5-flare; PNGs visually
contained no letters/logos. Navy/pale-blue family reused; background central safe area empty;
illustration real alpha confirmed. Subjective exact texture/shadow identity is not an automated guarantee.
Before approval DB snapshots unchanged; same generation request returned identical bytes/proof.
Approved background: exactly one approved asset with source=openai; duplicate approval returned same ID.
Illustration cancelled with no registration. Anonymous request rejected; isolated tests check nonadmin,
cross-article/project binding, modified image/proof, unsupported role, Production gate and duplicate locks.
Browser selected concept displayed only eligible generation actions; decoration had no generation button.
Approved generated background appeared in the existing Composition picker as ChatGPT Images · 행사;
no placement was performed. Actual generation/approval was endpoint E2E, not a full UI-click E2E.
Owned Staging fixtures were removed: nine related table counts=0 and Storage objects=0.
40 tests pass; lint has zero errors and three pre-existing warnings, TypeScript/build/diff checks pass.
No Production writes.
