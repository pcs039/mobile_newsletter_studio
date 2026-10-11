# Visual asset specification v1

Pure local conversion of a validated, selected design concept. No API call, DB write, generation,
Storage upload or placement change occurs when the plan is displayed. Existing concept analysis
and explicit draft-apply actions keep their existing behavior; this plan adds no request.

The typed specification includes assetRole, purpose, visualStyle, semantic colorDirection,
compositionDirection, aspectRatio, targetSize (px), transparentBackground, safeArea (percent),
textInImage (always false), brandConstraints and canvaUsage.

- Background: 1080×1440 (3:4), opaque; central 84% width / 65% height left for HTML.
- Illustration: 1080×720 (3:2), transparent PNG; independent top overlay with edge padding.
- Decoration: 512×512, transparent PNG; optional reusable edge ornament.
- Pattern: 1024×1024, opaque seamless low-density repeat tile; no focal content or text.

Background concepts include a separately optional pattern plan; illustration concepts include a
separately optional decoration plan. Both produces four independent plans. None/manual produces
no new asset plan. These plans do not expand the two automatic placement slots or assert an asset
already exists. Future canvaUsage supports standalone; current roles use background/overlay.

Existing visible article frame colors are validated references only, limited to three HEX values.
The existing project/institution approved palette and brand tone must be resolved first by any
future generator. Missing palette information remains unspecified, never invented. Semantic color
direction does not override brand colors. No title/body/private metadata/token/path enters the spec.

HTML owns text, numbers and meaningful information. Images contain no generated words, logos or
watermarks. Avoid excessive advertisement/painterly styling. Mobile 390px normal/maximum text
readability takes priority. Backgrounds, illustrations, ornaments and repeat patterns are separate
Canva-reusable assets; no whole-page text image is planned.

UI shows purpose/style/size/Canva usage below the selected concept; no raw JSON editor or new action.
Tests use event/policy/interview plus existing deterministic fallback fixtures entirely in memory.
No Staging/Production DB or Storage fixture is needed for this pure, read-only conversion.

Validation: 35 tests passed (four new event/policy/interview/fallback checks), lint error 0
(existing warnings 3, new warnings 0), TypeScript, webpack production build and diff check passed.
No live image provider call or DB/Storage fixture was used. PR remains unmerged.
