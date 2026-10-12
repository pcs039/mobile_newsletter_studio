# Canva Content Fit Preflight v1

Scope: `event_festival_02` / `EAHXxCyfpSI` only. Pure opt-in layer in `canva-content-fit.ts`; no UI, execution adapter, existing builder, registry, renderer or persistence changes. No provider calls.

Call the existing builder, then `prepareCanvaContentFit(raw)`. Existing `isReady` means complete data; `visualReady` is an additional conservative presentation check. The wrapper clones an executable display payload only if both checks pass; otherwise its `payload` is null. Other templates have supported=false, visualReady=false, no payload and an explicit uncalibrated warning. The original builder payload remains unchanged; callers must use this wrapper's result. Connecting this gate to actual execution is a later change, not enforced by this PR.

Each result includes field, originalText (the raw Canva value, possibly already transformed by canvaDisplayTitle), fittedText, changed, fitStatus, strategy and source/block/link/transform provenance. The source article itself is never rewritten. Only CRLF/CR normalization is supported; no semantic shortening, word chopping, truncation, ellipsis, date/amount/place reformatting, AI calls or generated facts. Overflow copy is retained for operator review and not returned as an executable fitted payload. Title and summary are future semantic-shortening candidates only; factual fields and CTA are never summarized.

## Observed Canva calibration

Four test designs were created with the fixed Staging project connection and verified live dataset. Three shared short/medium/long variants test all five fields together; one additional boundary design was necessary because the original 24-character CTA actually fit. Only test display copy was sent. MAIN_IMAGE reused MAHXzEWrQNA. The article and existing execution were not written (only the existing connection lease was used).

| Field | safeChars | safeLines | borderlineChars | overflowObservedAt |
| --- | ---: | ---: | ---: | ---: |
| TITLE | 8 | 2 | 8 | 28 |
| EVENT_DATE | 11 | 2 | 11 | 25 |
| EVENT_PLACE | 9 | 2 | 9 | 25 |
| EVENT_SUMMARY | 21 | 1 | 39 | 96 |
| CTA | 24 | 1 | 24 | 49 |

Counts are Unicode code points including spaces/newlines. safeChars is the longest tested safe sample, not a discovered universal maximum; borderlineChars records the observed boundary sample, not an extrapolated cutoff. Title/date/place medium samples fit two lines; place approaches the lower divider. Summary 39 characters wraps to two lines and approaches the CTA, so it requires review and fails the conservative safe budget. CTA 24 characters stays inside one line; 49 wraps and clips outside the button. Long title/date/place/summary collide with later elements.

The old estimated-width budgets were removed. Enforcement now uses only observed tested-safe character counts and observed safe line counts (explicit newlines); values outside that tested-safe envelope are blocked for manual review. It does not claim to compute Canva automatic wrapping. Identical counts with different glyphs, words or template fonts may still render differently; final visual QA remains necessary. Future pixel/word-aware fitting needs separate calibration rather than invented character capacities.

Design evidence:

- Short: DAHX00M2njA
- Medium: DAHX03axgyk
- Long: DAHX0zR-Ynw
- Boundary: DAHX06jMcX0

Exact inputs and observations are in tests/fixtures/canva-content-fit-calibration.json. The original E2E title/date/summary remain overflow; its place and CTA pass. Short/medium observed fixtures pass; boundary/long fail. No copy is shortened or truncated, no template is edited, and no execution gate is connected in this stage. Existing builder/adapter remain unchanged.

Tests include observation-count consistency, source/raw-payload immutability and deterministic results. Production DB/Storage changes and migrations remain forbidden. Four calibration designs are retained as evidence; no design delete or PNG export/import was performed. The preflight itself performs no API or persistence operations.
