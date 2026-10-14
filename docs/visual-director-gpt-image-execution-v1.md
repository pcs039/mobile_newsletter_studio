# Visual Director GPT image execution v1

Saved article → deterministic director → conceptual image specification → explicit generation → draft design asset → separate approval/application.

## Contract and scope

`buildDirectorImageSpec` recomputes the director. Only `ai_generated_image`, `needsGeneratedImage=true`, no real-photo need and no human-input requirement pass. The API obtains the current saved article within the authenticated administrator's project. No client strategy, prompt, palette, asset ID or specification is accepted.

The specification contains bounded title (200), summary (500), article type and director reasons, public/mobile style, quiet central composition, prohibited text/logo/documentary imagery, `factualityMode=conceptual`, `textInImage=false`. Full body, hidden metadata, Storage paths and Canva credentials are never sent to the provider. Ratios derive from existing article types: default 4:5 (1024×1280), life_civil 1:1 (1024×1024), government_major 16:9 (1536×864). Exact PNG dimensions are checked; no resizing/stretching. The existing gpt-image-2.5-flare provider is used once, medium quality, n=1, opaque PNG. Native custom dimensions are documented in [OpenAI Images reference](https://developers.openai.com/api/reference/resources/images/methods/generate).

## API and durable state

Existing `/api/project-content/visual-asset-generation` gains `director_prepare`, `director_generate`, `director_status`. Prepare/status perform reads only. Generate requires the fresh server-computed generation key; mismatch is 409. All modes retain admin, same-origin and fixed Staging configuration/origin guards. Production and general Preview cannot generate/register.

SHA-256 covers project/article IDs, stable source snapshot digest, director result, specification/version and authoritative brand palette. Canonical JSON ordering is used. Source text itself is not persisted in job payloads. Job and asset UUIDs derive independently from the key.

Existing v1.24 `newsletter_design_processing_jobs` supports provider=ai, operation=ai_generate_asset, null input_asset_id. A unique-PK insert claim (ignore duplicate) is persisted before provider execution; only the successful inserter calls the provider. No schema/RPC changes. Request JSON contains article ID/key only; result JSON contains asset ID only. Existing per-instance concurrency/hourly cost guard is reused in addition to the durable per-key claim (the hourly counter remains per instance).

Success reuses the verified same-project asset/provenance. Processing polls stored state, never repeats generation. Processing older than six minutes is unknown. Failed/unknown are never regenerated for the same key. Provider response/timeout or registration ambiguity remains unknown rather than triggering another charge. No automatic retry; an ambiguous insert also prevents provider execution. Registration ambiguity may leave a private file or draft asset requiring operator inspection; automatic deletion/regeneration is deliberately avoided.

## Asset and UI

Shared private Storage upload and design asset registration are reused. Legacy preview/proof approval remains unchanged. Director generation saves active **draft** background assets with source=openai and project reuse scope. `metadata.imageGeneration` is strictly allowlisted: generatedForArticleId, visualStrategy, generationPurpose, promptVersion, generationKey, factualityMode, textInImage. Existing editor preserves that JSON on approval. The admin-only asset-ID thumbnail mapper reuses the existing private file proxy and never returns a raw path.

Execution controls sit inside the existing AI visual strategy card; hybrid remains advisory. Explicit click, UI ref lock, bounded status-only polling, terminal failed/unknown handling and source-keyed remount prevent stale results and double execution. Success shows registered candidate plus asset management link, never automatic approval/article placement. Actual absence of text and conceptual quality require human inspection; prompt rules alone do not certify image content.

## Rollout

No migration, external Canva/Adobe call, renderer change or Production data write. Unit/mock and responsive checks precede PR. Actual GPT image generation must be tested only on fixed Staging after PR creation; no merge before that E2E passes.
