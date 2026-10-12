# Canva Autofill Execution Adapter v1

`executeCanonicalCanvaAutofill(request, input)` is a server-only function. It is not connected to UI and adds no public API or new OAuth/client.
An invocation is an explicit execution request with a UUID requestKey and a builder result; there is no automatic execution.

Reuses canvaAdmin/sameOrigin, requireStagingE2E, getProjectContent, getConnection/withConnectionLock, accessToken/connectedCanvaRequest, readCanvaJob and existing execution JSON.
Only the fixed Staging origin + Staging DB/config combination passes. Production and ordinary Preview calls are blocked.

## Validation

Require isReady=true, payload present, zero missing fields, verified canonical template and exact selected/prepared/payload Brand Template IDs.
Check complete registry text/image fields, types and provenance values. Load the current project-owned saved article under admin access.
Rebuild text sources with the existing builder and compare the resulting payload hash to the prepared one. Stale values do not execute.
Immediately before a new creation, GET `/brand-templates/{id}/dataset` with the existing connection credentials. Its whole field-name/type set must exactly match the registry snapshot; additions/removals/type changes block POST.
Execution is still conservative complete-fill readiness, not a claim that Canva requires all fields.

## Images / v1 scope

No image upload is added. Reuse the current connection's single successful approved GPT-background upload receipt and `readCanvaBackground` to recheck same-project approval/active/source/private PNG bytes/current hash.
Image fields must point to that exact existing receipt. Other uploaded assets or distinct multi-image receipts are not supported by this adapter v1 and return not_ready. A future extension must add trusted receipt resolution, not accept arbitrary client asset IDs.

## Creation / idempotency

Use the existing 90-second project/admin connection lease. Save status=sending before one POST `/autofills`.
Same input hash/article/template success returns its saved design even with another requestKey. Reusing the same key for changed input is blocked.
An uncertain response persists unknown (or leaves sending if persistence fails), blocking blind retry, including with a new key. In-flight legacy requests and PNG imports are respected.
No automatic POST retry. Async results return in_progress with jobId. A later explicit invocation performs at most one GET of the saved job and never recreates it.
created is returned only from a validated success response; identifiers/URLs come from readCanvaJob. Provider exceptions are redacted.

## Real E2E

Mock provider tests only at this implementation stage. No push/deployment is performed, and no new adapter is running on fixed Staging yet. Actual Staging creation requires an explicitly prepared fully populated canonical template plus a deployed adapter. No Production design/DB/Storage writes occur.
