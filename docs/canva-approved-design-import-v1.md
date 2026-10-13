# Approved Canva design import v1

The existing review card exposes the existing PNG importer only after the operator chooses **이 디자인 사용**. **앱으로 가져오기** is a separate explicit action. Import creates a project design asset candidate with draft asset approval; it neither changes article/Composition nor publishes anything.

## Existing contracts reused

- `/api/canva/png-import`: admin, same-origin, fixed Staging gate, connection lease, single-page PNG formats, export creation/status polling.
- `canva-png-export.ts`: allowlisted download host, bounded bytes/MIME/PNG integrity checks, deterministic project/design asset UUID.
- `canva-png-asset-repository.ts` and `project-design-asset-write.ts`: existing private bucket and asset registration; URLs never persisted.
- Existing execution JSON and design asset metadata JSON: additive typed properties only, no DB migration.

## Approval and freshness

A read-only approval candidate is tied to the authenticated admin, project, saved article, canonical verified template, current successful execution key/hash/design ID and full article snapshot. It uses the existing five-minute HMAC confirmation. The explicit approve action records `execution.designReview`; client `approved` state alone never authorizes export. Fresh payload/image binding and the full article snapshot are rechecked under the existing connection lease before import.

New executions retain `articleSnapshotHash` from generation, so article edits invalidate review even if unmapped content changes. Legacy executions without that field can only be explicitly approved after fresh canonical payload hash verification; approval then binds the full current article snapshot. Noncanonical legacy result IDs are not accepted as canonical review/import candidates.

Opening an approved design for editing removes local approval and revokes its server acknowledgement; Canva editing completion itself is not detected. Failed revocation leaves the UI unapproved. Existing Production/ordinary Preview review remains local; export/import stays disabled there. No external E2E or Production writes are performed by this PR's validation.

## Import lifecycle

An explicit start can create at most one export. `in_progress` polls the persisted job. A completed export returns `ready`, then a status-only request downloads and registers its PNG. Status requests never create exports. Sending/unknown/failed outcomes block new exports. Download/insert interruptions with a known ready job may be recovered by explicit status observation; deterministic Storage path and asset PK prevent a second asset. A successful repeat returns the existing asset. Existing upload receipt and Autofill success job remain intact.

Metadata retains `source=canva`, `reuseScope=project`, plus `canvaExport.designId/format/articleId/templateId/importedAt`. Existing designId/format-only metadata stays valid; new optional provenance is allowlisted. No download URL, OAuth token or raw Storage path appears in response data. Existing already-imported legacy assets may have only their original minimal provenance; no backfill is performed.

## Validation

Mock/unit route and component tests cover approval/freshness, auth/project/environment boundaries, single explicit export, status-only polling, duplicate/uncertain protection, PNG/metadata validation and candidate-only success UX. No real Canva API, database or Storage E2E is run. Local production Webpack build is used because Turbopack internal port binding is restricted on this host.
