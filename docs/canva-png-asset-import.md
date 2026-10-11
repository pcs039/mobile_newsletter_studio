# Canva PNG asset import — Staging first

This feature reuses the completed Autofill result in the project/admin connection's
`execution` JSON. No schema migration, provider, dependency or OAuth scope is added.
The endpoint is disabled unless the server uses Staging Supabase
`mvrkpmffuhcqwisqvpqi` and is not a Vercel Production deployment.

## Flow and limits

- Only a stored, successful Autofill result for the authenticated administrator's
  current project/article can be imported. Client-supplied design IDs alone are not authority.
- The administrator explicitly chooses an existing production asset type and presses
  **PNG로 디자인 자산 가져오기**. No export happens on page load or Autofill completion.
- Check PNG export support and the design page count. This first version accepts
  **one-page designs only**, preventing silent page loss or archive registration.
- Create one PNG export job. Poll at most 20 times, with a 90-second client deadline.
  A later status action resumes a known job rather than creating another export.
- Download only HTTPS `export-download.canva.com`, without credentials or redirects.
  Check MIME, PNG signature/chunk CRCs/dimensions and a 10 MB streamed size limit.
- The signed download URL exists only in request memory. It is never stored or returned.
- Reuse the existing private `design-production-assets` bucket and asset insert
  transport. Do not create buckets or change policies. New assets are active and
  **draft**, requiring the existing approval gate before external rendering.
- The selected asset type retains its existing semantics; import does not automatically
  select a type or place the asset in an article.

## Identity and failure handling

The project/design/PNG tuple determines a stable asset UUID and Storage object path.
The existing asset primary key and non-upsert upload prevent duplicate registration.
An existing matching asset is returned before any Canva API call. Metadata stores only
`source=canva`, project reuse classification and `canvaExport: {designId, format: "png"}`.
Classification edits retain provenance. Public/review renderer contracts are unchanged.

The existing connection lease, OAuth refresh/401 invalidation and same-origin check
are reused. Ambiguous export POST outcomes remain `unknown`; the server does not retry
creation automatically. Known export jobs can resume download/registration after a
timeout or interrupted insert, using the same object path. An incomplete upload is
retained for that recovery rather than deleting a potentially committed asset's file.
Starting another Autofill is blocked while its PNG import is unresolved.

## Validation

- `node --test tests/canva-png-import.test.cjs tests/canva-connect.test.cjs tests/canva-request-origin.test.cjs`
  passes 17 tests: URL/MIME/PNG integrity/size, format/page count, provenance validation,
  authenticated saved result gate, Production disablement, duplicates, timeout,
  unauthorized requests and existing OAuth/CSRF/refresh regressions.
- Actual Staging DB + local administrator UI: imported completed design `DAHXoN543vs`.
  Export job `8bbc7970-0126-4c56-8f19-f16de7e45a85` succeeded. PNG is 1080×1350,
  101,687 bytes, `image/png`. One draft banner asset was registered, source Canva.
- Repeated actual start/status requests returned the existing asset; row count stayed 1.
  Anonymous/review-only requests returned 401; wrong project/article/design returned 404.
- Asset management source filter and Composition picker API returned the asset.
  No Composition/placement was created or changed. Picker visual selection was not
  performed because the test article has no Composition and starting one would write it.
- No new Autofill design was generated. The earlier disposable design was temporarily
  restored from Canva Trash for export, then returned to Trash. Original Brand Template
  content was not changed.
- New imported asset, Storage object and temporary PNG execution state are cleaned up.
  Existing test project/article/template/OAuth connection and Autofill history remain.
- UI console errors: 0 in observed import/asset screens. lint retains 3 pre-existing
  warnings; TypeScript, webpack production build and diff check pass.

The new branch's Vercel Preview uses its configured environment. Import remains hidden
when Preview points at Production Supabase. The real export above used a local server
explicitly connected to Staging; it was not run on the Production app or Storage.
This PR is intentionally left open and unmerged.
