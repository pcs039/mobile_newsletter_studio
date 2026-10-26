# Adobe post-processing foundation v1

Adobe is a post-processing capability, never a new Visual Director primary strategy. This PR creates planning and execution contracts with **no live provider**. No external calls, fake success, jobs or assets are created by the installed adapter. It is not an operational Adobe integration.

## Existing main implementation

- `design-processing/types.ts` and `provider.ts`: descriptive Adobe Photoshop/Illustrator/Express provider and operation lists.
- `project-design-processing/route.ts`: validates a same-project `source_design` input and returns execution unavailable. It remains unchanged.
- `design-processing/repository.ts`: existing project-scoped job listing and AI-specific durable claims; no duplicate Adobe job table added.
- `project-design-asset-write.ts`: shared non-overwriting upload/asset registration transport, reserved for future real output.
- `parent_source_asset_id`: v1.23 FK/trigger permits same-project `source_design` only.
- `newsletter_design_processing_jobs`: v1.24 input trigger also requires `source_design`. Existing enum supports Photoshop background removal, but does not cover the new upscale/extend operations. These restrictions remain unchanged.
- Existing `source=adobe`, private file previews and design asset management are reused. No active secure Adobe relay or REST client was found. The WIP Adobe stash was not inspected or applied.

## Contracts

`adobe-post-processing.ts` provides `remove_background`, `upscale`, `extend_canvas` models; deterministic plan, safe source snapshot, SHA-256 key, capability registry, receipt policy and result-registration descriptor.

- Input: same-project UUID, active PNG/JPEG/WebP, draft or approved (never archived), verified private object. SVG/PSD/AI/PDF are excluded from these raster operations.
- Background removal: existing institution asset classifier prefers person/character, or explicitly described objects/products. Scene/landscape/facility/poster and already transparent images are excluded from recommendations.
- Upscale requires measured source dimensions and explicit target dimensions. No recommendation when dimensions are unknown or already sufficient.
- Extend requires measured ratio mismatch and explicit crop risk. Unknown dimensions/risk do not trigger a recommendation. Existing DTO lacks pixel dimensions, so the initial UI asks for confirmation instead of inventing them.
- Validated operation parameters only; positive integer sizes bounded to 8192. No free prompt, endpoint, credential or URL parameter.
- Key includes project/source ID, safe source state/classification metadata, operation/parameters, adapter version. It excludes raw names/notes, signed URLs, private paths and credentials. Source state changes invalidate the key.

`design-processing/adobe-source.ts` is an internal read-only preparation helper using existing `getProjectDesignAssets`, configured Supabase endpoint builders and service-role headers. It verifies project ownership, permitted private bucket, project-prefixed path, bucket `public=false`, object HEAD success and matching raster MIME. It returns a sanitized source without paths/URLs/credentials. An eventual public entry point must require admin/project access and load this fresh server source; it must never accept a client attestation. No public execution API is added in this PR.

`design-processing/adobe-post-processing-provider.ts` extends the existing provider boundary with an installed unavailable adapter. Availability requires both verified entitlement and a ready adapter. Credentials alone or the existing operation list are not evidence of entitlement. No environment flag can activate this unavailable implementation.

`executeAdobePostProcessing` is a server-only contract consuming trusted fresh source/receipt data. It rejects invalid/stale source and receipt ownership/key mismatch. Same-key success receipt reuses the result; in-progress permits status checks only; failed/unknown never automatically retry. New work returns unavailable before provider/job/storage writes. There is no polling transport or durable Adobe claim implemented because execution is not enabled. A future adapter must resolve the existing input/operation restrictions, establish private relay, claim durably before provider POST, validate actual output and reuse the shared registration transport. Do not repurpose AI jobs or reinterpret operation enums to bypass those restrictions.

## Provenance and lineage

Strict JSON metadata extension (no migration):

```json
{"source":"adobe","adobeProcessing":{"sourceAssetId":"UUID","operation":"remove_background","operationVersion":"v1","processingKey":"SHA256"}}
```

Unknown keys/values, invalid IDs/version/hash and a non-Adobe source are rejected. Existing metadata and NULL remain valid.

`buildAdobeResultRegistration` creates only a descriptor: new ID, draft, active, provenance. It checks current key and rejects the source ID as result ID. It does **not** store files or rows. `parent_source_asset_id` is preserved for source_design inputs; raster reference/production lineage uses `adobeProcessing.sourceAssetId`, with FK null, respecting the existing trigger. No type coercion or source overwrite. Future write-path provenance immutability and output revalidation remain part of live adapter work.

## UI and entitlement

Compact, initially closed Adobe details in existing intake/reference and production asset cards. Raster assets only. All buttons disabled with “현재 Adobe 자동 처리 연결을 확인 중입니다.” Operator approval/application remains separate. No synthetic processing/completed UI state is shown. Actual result lineage is displayed only from an existing Adobe metadata record.

Local `.env.local` and `.env.staging.local` contain no Adobe variable names; `.env.example` has placeholder variable names only. Only variable names were reported; no secret values were printed or documented. Remote entitlement/credentials have not been verified. A connected desktop Adobe app/plugin is not evidence of server REST API entitlement. **Actual Adobe calls: 0.** No private source is sent to Adobe.

## Validation

- New contract/UI/source-reader tests 18/18.
- Full serial Node suite: 291 tests, 290 passed, 1 skipped (actual PostgreSQL integration requires an unset dedicated DB). Existing GPT/Canva/information graphic/institution asset regression tests passed.
- TypeScript, lint, Webpack production build, diff check passed. Existing lint warnings 3, new warnings 0.
- Actual component markup in local fixtures at 1440/768: details, recommendations, disabled buttons and original/result relationship confirmed; horizontal overflow and console errors 0.
- No real Adobe/GPT/Canva call, DB/Storage write, migration or dependency change. Production and original two stashes preserved. PR remains OPEN pending review of entitlement/limitations.
