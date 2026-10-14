# AI image article apply UX v1

## Existing contracts and migration exception

`newsletter_articles.representative_asset_id` and `newsletter_content_blocks.asset_id`
reference `newsletter_assets`, not project Design Assets. GPT results remain in
`newsletter_project_design_assets`; neither FK is populated with their IDs.
Composition `hero_background` is a background layer, not an article representative
image. The general article save RPC deletes/recreates blocks and links, and the
design-draft RPC deliberately prohibits replacing existing placements.

The approved exception is a function-only migration:
`supabase/schema_v1_37_ai_image_article_atomic.sql`. No tables, columns, indexes,
policies, buckets or dependencies are added. Staging application requires separate
approval. Production application is forbidden in this task.

## Atomic connection model

`apply_newsletter_ai_image_article_atomic(project, article, action, role, asset,
expected, generation_key, variant_index)` supports snapshot/apply/revoke and
hero/body. `newsletter_ai_image_article_fingerprint(article)` digests the article,
all blocks and all links. Only service_role may execute either function.

The mutating RPC locks the article, its blocks and links, compares the displayed
snapshot and locks the selected asset for share. It verifies same project/article,
approved/active, PNG/private bucket and OpenAI generation provenance. Canva
full-layout and explicit image-only presentation block application. There is no
read-then-delete/insert replacement or compensating rollback in JavaScript.

Managed image blocks have `asset_id=null` and metadata:

```json
{
  "managed_by": "ai_image_article_v1",
  "source": "openai",
  "source_asset_id": "<design asset UUID>",
  "generated_for_article_id": "<article UUID>",
  "visual_strategy": "ai_generated_image",
  "generation_key": "<original generation digest>",
  "variant_index": 1,
  "applied_role": "hero"
}
```

Hero is rendered above the HTML title, outside the background layer. It does not
replace HTML copy or change `contentPresentation`, `showPublicTitle` or the legacy
representative FK. A current managed hero is replaced by updating its single row;
its previous Design Asset remains. This is a representative image in the article
reader, not a new thumbnail generation or image optimization pipeline.

Body inserts after the first paragraph. If the next integer position is occupied,
later positions shift inside the same transaction; original row IDs, relative
ordering, text and links remain. Revocation removes only the selected managed
block; harmless gaps in ordering remain. It does not restore an old article
snapshot or overwrite edits. An intervening edit invalidates the displayed
snapshot; the operator must refresh state before any further mutation. Repeating
an apply with current state reuses its existing block. Repeating a revoke with
current state returns notFound; a stale request conflicts.

## Approval, provenance and stale results

Creation, asset approval and article application remain separate actions. Only
approved active assets apply. The UI links to existing asset management for
approval; neither this API nor the RPC approves or publishes anything.

Candidates are limited to this project's same-article OpenAI results. The server
recomputes existing generation keys for variants 1–3, using the saved article and
project palette. Unknown/old generation keys are not assigned invented generation
metadata; their style/ratio/index require confirmation. Changed source or generation
conditions produce a warning and require explicit reconfirmation. Managed apply
blocks are excluded from generation input so applying a result alone does not
invalidate its duplicate key. No generation prompt/quality rules change.

Generated assets are not removed when source changes. Inactive/deleted asset
connections can still be explicitly revoked. The file mapper independently checks
current ownership, provenance and approval on every file request.

## File access and UI

Reuse public/admin-preview/client-review file routes, adding `articleId` plus
`aiImageBlock`. Existing project visibility/admin/pending-review policies remain.
Only validated approved PNG references are mapped; private paths and signed URLs
are never stored in block body or sent to the reader. Body and hero reuse the
existing image rendering/lightbox; original title/body/CTA stay HTML.

The compact AI image card lists existing variants with one selected candidate,
approval/stale/application states and explicit apply/replace/remove controls.
Replacement requires confirmation. Applied candidates expose an explicit
application-check action that reuses the idempotent RPC result without a new block.
Busy locking prevents double clicks. No
generation, approval, apply or publish occurs merely by visiting the UI.

## Rollout / verification boundary

Local isolated PostgreSQL tests exercise the real function SQL without touching
Staging or Production. Local browser fixtures mock the apply endpoint and never
call a provider. After separate Staging migration approval, use exactly one
existing Staging article/asset for apply → duplicate → revoke, optionally one body
insert, and preserve the original asset/file/job. Keep the PR open; do not merge.

Local verification: all 311 tests passed, including both isolated PostgreSQL RPC
suites; TypeScript, lint, Webpack production build and diff check passed. Lint has
the existing three warnings and no new warnings. Browser mock E2E at 1440/768
confirmed explicit apply/remove, draft blocking, stale reconfirmation and Canva
conflict guidance, with zero horizontal overflow or console errors. Actual Staging
RPC application and asset apply E2E are pending separate migration approval.
