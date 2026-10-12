# Canonical Canva Autofill payload v1

`buildCanonicalCanvaAutofillPayload` is synchronous pure logic. It does not call Canva, upload, persist, generate copy, or modify article/Composition/UI.

## Input / registry

Accept a canonical templateId or canvaBrandTemplateId; conflicting/unknown IDs fail with 400. needs_republish fails with 409.
Only registry text fields and image fields are processed, in their recorded order. Arbitrary fields, mismatched types and duplicate bindings are rejected.

Reuse existing CanvaMapping/source allowlist, validateCanvaTemplate, buildCanvaPreview, canvaDisplayTitle and readCanvaUploadJob contracts.
Defaults connect TITLE/SUMMARY/BODY_TEXT and explicit publicInfo aliases (TARGET/PERIOD/METHOD/SUPPORT_CONTENT/EVENT_DATE/EVENT_PLACE etc.).
SUPPORT_CONTENT reuses support for welfare articles and benefit for application/recruitment articles.
TITLE_LINE_1/2/3 use only corresponding existing derived display-title lines; absent lines stay missing.
CTA uses the label of exactly one visible action. NOTICE uses exactly one visible enabled notice/warning info block. QUOTE uses exactly one visible enabled quote block.
Multiple blocks/actions are never implicitly first-picked. Explicit text fieldMappings may select existing allowlisted sources and block IDs.
Fields such as CATEGORY, PRIMARY_VALUE, numeric KPIs, names and steps are not inferred from prose or the template family. They remain missing unless explicitly mapped to an existing source.

## Images

An explicit image binding references the existing approved/active same-project PNG design asset (the existing upload flow supports PNG) and existing CanvaBackgroundUpload result.
The upload must be success with valid job/Canva asset IDs, matching sourceAssetId and current sourceHash. Pending/unuploaded assets block readiness.
No new upload flow, private file reads, Storage paths, download URLs or tokens are included. Output uses sourceAssetId and Canva asset_id only.
Caller must obtain authenticated project/article ownership and trusted current sourceHash/upload references; this pure function cannot prove remote asset existence or permissions.

## Output / readiness

Return templateId, canvaBrandTemplateId, datasetStatus, textFields, imageFields, missingFields, warnings, isReady, payload.
Each text value carries source/blockId/linkId/transform as applicable. Every field has explicit ready/missing/invalid status.
All fields are conservatively required because the dataset snapshot has no independent optional flag. Text must be nonempty, at most 10,000 characters, without unsafe control characters.
The registry's current `requiredFields` is actually the complete list of text Autofill fields verified in that Canva Brand Template, not a verified list of mandatory fields. Individual field requiredness is not distinguished yet.
Accordingly, v1 `isReady=true` means a fully populated state in which every known text/image field is ready. It does not mean Canva independently requires every one of those fields.
Registry v2 should consider separating `requiredFields` / `optionalFields`, or using `textFields` with explicit requiredness metadata. This is a future design consideration; v1 behavior is unchanged.
isReady is true only when every registry text/image field is ready; only then payload contains the existing create_from_brand_template + typed data API shape. Otherwise payload is null.
Image-less EAHXyJwJhts accepts imageFields {} with no image missing entries.
isReady means structurally complete against the verified snapshot, not authorization/provider health or a guarantee of successful execution. A future execution layer must recheck live dataset, auth, scopes and project access.
