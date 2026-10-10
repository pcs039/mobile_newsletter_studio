# Canva Integration v2-B1

## Rollout gate

Apply `supabase/schema_v1_34_canva_connections.sql` to Staging first. Do not merge or apply to Production until separately approved. Existing registry requires v1.33. No storage changes or public renderer contract changes.

## Server configuration

Set server-only `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI`. Register the exact callback in Canva Developer Portal. Callback path is `/api/canva/callback`; HTTPS is required except localhost/127.0.0.1 for local development. Use a stable Staging domain, not a changing Preview domain or Production redirect. No `NEXT_PUBLIC_` Canva settings.

Scopes: `design:content:read`, `design:content:write`, `design:meta:read`, `brandtemplate:content:read`. No asset permissions. Canva plan/app access must permit Autofill.

On Vercel, connection, CSRF and callback checks share a canonical external origin. Proxy headers are used only when `VERCEL=1`, the environment is preview/production, and `VERCEL_URL` is a valid deployment host. Accepted hosts are exactly the configured callback host and Vercel's deployment/branch system hosts. Host and forwarded-host must agree; forwarded protocol must be HTTPS. Other servers retain direct request URL checks, including local development. Visiting a Preview alias does not authorize connection to a different callback origin.

## Security and execution

Connection is scoped to `(project_id, administrator user_id)`. Tokens/verifier live only in a dedicated service-role table with RLS and no public/anon/authenticated grant; credentials are not application-encrypted in this minimum version. Database/service-role administrators can access them. Never add this row to project/article/public/review DTOs. PKCE/state expires in 10 minutes; state is bound to the authenticated administrator, project, and HttpOnly same-site cookie and consumed once before code exchange. Callback origin is fixed by server configuration. Mutation routes require same Origin plus existing administrator/project authorization.

Database compare-and-set lease serializes refresh, authorization updates, disconnection, dataset checks and create calls across processes. Refresh credentials are consumed before exchange; uncertain rotation requires reconnection rather than old-refresh reuse. Lease expires after 90 seconds so crashed handlers do not block forever; updates also require their lease ID.

Prepare reads saved article data and validates every registered mapping against current Canva dataset. Execution re-reads and revalidates it. A signed five-minute confirmation binds exact payload, project, administrator, article and template. Missing text is blocked; never sent as an empty success value. Images are never uploaded/sent. Because dataset does not expose a required-field contract, any image dataset is blocked with a text-only-template instruction.

Only `create_from_brand_template` / `create_from_design` are supported. Never `update_design`. No POST retries: the documented endpoint has no idempotency contract. One last-execution record (no history/content) retains request key/job and prevents duplicate or ambiguous sends. A failed/network-interrupted creation is marked unknown unless Canva clearly rejected it. Unknown/sending blocks fresh sends; verify in Canva before explicitly disconnecting/reconnecting. Known jobs can be checked after navigation using “진행 작업 확인”. Polling stops after 30 checks or two minutes, plus a bounded in-flight request. Results expose only status/design ID and allowlisted HTTPS Canva links, not tokens/request hashes.

Disconnect asks for confirmation, attempts token revocation then removes local credentials even if revocation fails; in that case it instructs the user to revoke the app in Canva account settings.

## Validation

`node --test tests/canva-connect.test.cjs` tests pure contracts, state/PKCE, scopes, payload gates, result URL validation, signed confirmation and token rotation/error redaction. Staging HTTP tests use a temporary external-fetch mock outside source code; no runtime mock switch ships. Test fixtures must be removed including connection/registry rows and Storage files.

Real E2E remains required when credentials are available: one text-only Canva template with `EVENT_TITLE`, `EVENT_DATE`, `EVENT_PLACE`; register only in Staging, connect, review values, explicitly confirm one creation, verify returned design ID/link. Do not perform Production Canva calls for this PR.
