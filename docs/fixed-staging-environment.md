# Fixed Staging environment

Long-lived branch: `staging`. Work is reviewed on feature branches; the approved Staging candidate is fast-forwarded to `staging` without merging main.

Vercel Preview overrides must target only `staging`:

- NEXT_PUBLIC_SUPABASE_URL (Staging ref mvrkpmffuhcqwisqvpqi)
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- CANVA_CLIENT_ID
- CANVA_CLIENT_SECRET
- CANVA_REDIRECT_URI = https://canva-staging.datadiction.co.kr/api/canva/callback
- APP_ENV = staging
- NEXT_PUBLIC_SITE_URL = https://canva-staging.datadiction.co.kr
- SITE_URL = https://canva-staging.datadiction.co.kr

Keep Production and general Preview defaults unchanged. Existing OPENAI_API_KEY is inherited; a separate Staging key is follow-up work.

Before switching the custom domain, check the candidate deployment SHA and Ready status. An authenticated administrator can read `/api/staging-status` on the deployment URL: `configured`, `callbackOriginMatches`, `canvaConfigured`, `openaiConfigured` must be true; `supabaseRef` must match Staging. `enabled` must be false on that Preview URL.

Only then assign canva-staging.datadiction.co.kr to the staging branch. On that origin, `enabled` must be true. Verify the existing Canva E2E Test project, connection controls and image-generation controls without generating images, starting OAuth or deleting fixtures.

All OAuth, callback, Autofill polling/execution, PNG export/import and image generation/approval routes enforce APP_ENV, database ref, canonical site/callback settings and the canonical request origin. Existing auth, project access, CSRF, state and PKCE checks remain required. General Preview shows a fixed Staging link. The diagnostic endpoint exposes flags only and performs no database/provider writes.

A revert of the domain assignment restores the previous immutable deployment; environment edits affect only future deployments. Never print credential values or copy them into documentation.
