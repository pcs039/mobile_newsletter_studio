# Full-layout Canva article apply v1

Migration `supabase/schema_v1_36_canva_full_layout_atomic.sql` defines functions only. **Not applied to Staging or Production. Do not merge or run real apply E2E before rollout approval.**

## RPC and snapshots

`apply_newsletter_canva_full_layout_atomic(p_project_id, p_article_id, p_action, p_design_asset_id, p_template_id, p_expected)` accepts snapshot/apply/revoke. Returns snapshot, applied, blockId, and duplicate for repeated apply. Only service_role can execute; the server additionally requires an authenticated project administrator, same origin and fixed Staging gate.

`newsletter_full_layout_fingerprint(article_id)` hashes the complete article, blocks and links as ordered JSONB using MD5. This is a concurrency fingerprint, not an authentication secret. Block IDs, design references, all source text, link targets, visibility and presentation metadata are included. source_snapshot/applied_snapshot are excluded. Only the managed marker's updated_at is excluded because storing applied_snapshot can trigger a timestamp update; original row timestamps remain included.

Apply locks the article and existing blocks/links and checks expected source snapshot. It share-locks and validates the approved, active Canva card_frame PNG, private bucket, same-project ownership and article/template provenance. It inserts one image block with asset_id=NULL. Original rows are never overwritten. Its metadata overrides contentPresentation and showPublicTitle in the read DTO. The applied fingerprint includes the new marker and its display override. Existing valid identical application returns the existing block.

Revoke validates current fingerprint against applied_snapshot, deletes only its managed block and verifies the restored fingerprint equals source_snapshot before committing. Any external title/body/link/presentation change yields conflict. Original presentation metadata remained untouched, so removal restores it; previous_presentation/previous_show_public_title are additionally retained for inspection. Assets/import records are never deleted. Repeated revoke returns not_found.

## Metadata and files

Marker metadata: managed_by=canva_full_layout_v1, presentation_mode=full_layout, design_source=canva, design_asset_id, canonical template_id, source_snapshot, applied_snapshot, previous_presentation, previous_show_public_title, show_public_title=false. Snapshots contain digests only, never source copies.

The mapper uses articleId + fullLayoutBlock in existing public/preview/review file APIs. Every read checks block ownership, valid metadata, current applied fingerprint, approved/active asset, same project and Canva article/template provenance. Private Storage paths and signed download URLs are absent from reader payloads. Existing published/admin/pending-review access checks still run first. Invalid/stale/unavailable markers fall back to preserved HTML.

## Rendering and UI

Only server-mapped full-layout Canva blocks activate the shared renderer. PNG keeps its natural aspect ratio, with a screen-reader heading, concise alt and actual HTML CTA links below. Original title/summary/publicInfo/paragraph text is available under collapsed “텍스트로 읽기” with existing text scale controls. Ordinary image articles keep their existing renderer.

Imported asset UI explicitly invokes snapshot then apply/revoke. Flight guard prevents duplicate clicks. Conflict never triggers automatic recovery. Local applied state survives rerenders; after a full reload an explicit repeated apply safely reuses the connection. Asset approval is mandatory. No automatic placement, export, publish or source edits.

## Local validation

Run Node tests normally; actual SQL test requires a disposable PGlite runtime outside the repository:

```
npm install --prefix /private/tmp/mns-full-layout-sql --no-save --package-lock=false @electric-sql/pglite
CANVA_SQL_TEST_RUNTIME=/private/tmp/mns-full-layout-sql/node_modules/@electric-sql/pglite node --test tests/canva*test.cjs tests/article*test.cjs
```

This executes the real migration in a disposable PostgreSQL database with fixture schemas, never Supabase. Without that optional runtime the SQL test is explicitly skipped. Tests cover transactional rollback, idempotency, self-generated snapshots, stale revoke, original row preservation, approved ownership, file access and shared renderer. Actual Staging migration/application E2E remains pending.

Local browser SSR fixture with compiled production CSS: 1440/768px, collapsed/expanded companion, natural 4:5 image ratio, no horizontal overflow and console errors 0. This checks layout only; real Staging application E2E remains pending.
