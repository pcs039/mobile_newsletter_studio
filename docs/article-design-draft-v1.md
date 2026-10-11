# Article design draft v1

## Scope and rollout

Base: `e104729a32a4b54a7512873160287c9443ca26a5`.

The existing production-pattern recommendation endpoint performs classification only. A deterministic planner prepares a presentation-only proposal; an explicit confirmation applies it atomically. No article, block, link, image, caption, asset metadata, or renderer implementation is changed by the operation. No preview-only renderer branch was added.

`schema_v1_35_article_design_draft_atomic.sql` adds one service-role-only function, without table, column, policy, or Storage changes. It has been applied **only** to Staging `mvrkpmffuhcqwisqvpqi`. Production migration and PR merge require separate approval.

Migration SHA-256: `f7f4a70ea2c0c51e0b737675edff40bcaf89deafa9039e22cd26667d38384eb0`.
Staging `md5(prosrc)` matches the local function body: `c24bfd8e008d3f4d36260b29b40e2686`.

## Rules

- Event/policy/interview set a built-in label, emphasize an existing visible info/quote block, and style existing nonempty image captions. No missing content is generated.
- Manual is a complete no-op, including `updated_at` and placements.
- Existing colors, subtitle, number badge, other settings, and occupied slots—including hidden placements—are preserved.
- Event may propose one background at opacity 0.12 and one transparent illustration; interview only an illustration; policy no decorative assets.
- Candidates must be same-project, approved, active, compatible web renditions, explicitly tagged for the pattern, and already used visibly in a ready Composition in the same slot. Assets have no independent ready/visible fields, so this conservative reuse rule avoids inventing an eligibility state. Newly uploaded assets remain available through the existing manual picker.
- Illustration transparency must be explicitly `yes`. Source/provider and reuse classification do not confer access or preference. Ambiguous candidates produce no placement.

## API and concurrency

`POST /api/project-content/design-draft` accepts `prepare` or `apply`, a saved article ID, project slug, and allowlisted pattern. Prepare is read-only. Apply sends only a confirmation fingerprint; arbitrary client settings/asset IDs are never accepted. The server rebuilds the proposal before calling the RPC.

The RPC locks the article, target Composition, existing placements, blocks/links and selected assets. It compares the complete locked snapshot before any write:

- Composition ID, settings, status, and updated_at;
- every existing placement ID, asset ID, slot, sort order, visibility, settings, and updated_at;
- article/block/link content version.

A mismatch aborts the entire operation with `PT409`. Do not use custom SQLSTATE `40001` for stale business conflicts: affected PostgREST versions retry it indefinitely. See [Supabase troubleshooting](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

Settings update and all inserts occur in one database transaction. Existing placements are never replaced. The RPC rechecks eligibility after locking selected assets. SECURITY DEFINER uses `public, pg_temp`; PUBLIC/anon/authenticated cannot execute, service_role can. The API reuses project access checks and checks Origin against trusted server configuration, never forwarded host headers. Public/review clients receive no new draft metadata or credentials.

## Staging validation (2026-10-11)

A local branch server connected exclusively to Staging; no Production fixture writes occurred.

- Actual AI returned event/policy/interview/manual for four representative saved fixtures.
- Prepare left the DB snapshot unchanged. Manual apply also left the complete snapshot unchanged.
- Expected application: event 2 placements, policy 0, interview 1, manual 0.
- Failure after settings update and the first insert rolled back both changes.
- Two concurrent identical requests produced one 200 and one PT409/409.
- Changed placement ID, settings, sort order, visibility, and a Composition updated_at change with unchanged settings all rejected stale snapshots, without partial writes.
- Unapproved, inactive, cross-project, incompatible slot, hidden reference and non-ready reference assets were rejected.
- Existing placement IDs/core values were preserved on reapplication.
- SHA-256 of complete article/block/link/image rows remained unchanged.
- Anonymous and cross-project API requests were blocked; review-cookie-only requests were blocked.
- Administrator explicit proposal/apply flow, immediate preview, actual iframe, review session and public rendering were checked. Text/image/mixed fixtures, hidden public title, info, quote and existing captions retained their behavior.
- Image and fluid-frame modes were checked at 390/768/1024/1280/1440 and normal/large/xlarge. Public/review and immediate preview had no horizontal overflow; the illustration remained above text and below protected content. Checked design/reader surfaces had no console errors.
- Follow-up resolved the administrator 390px iframe-shell limitation without changing any renderer. Below 768px the selected phone viewport stays fixed and its shell scales uniformly to available width; modal/panel padding is reduced. At 390/430/768/1024, all small/normal/large presets had matching iframe scrollWidth/clientWidth and no modal horizontal overflow. At 768px+ existing unscaled dimensions remain unchanged. Normal iframe width is 386px (371px content after scrollbar) at every administrator width; it no longer collapses to 245px. Console errors: 0. Existing Staging article was read only; no new fixtures, DB or Storage writes were needed for this follow-up.
- Fixture-owned rows in projects/articles/compositions/placements/design assets/blocks/links/images/reviews all returned 0 after cleanup. Three uploaded fixture Storage objects returned 0. Existing user fixtures were not removed.

## Local checks

- `node --test tests/*.test.cjs`: 25 passed (8 new draft tests plus 17 existing tests).
- `npm run lint`: no errors; three pre-existing warnings in publish/page, project-publish-completion-panel, and supabase-health-check-button.
- TypeScript and webpack production build passed.
- `git diff --check` passed.
