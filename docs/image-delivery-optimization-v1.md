# Responsive design image delivery v1

## Decision

The existing GPT article and Canva full-layout proxies validate access and then stream the original private PNG. Public, admin preview, and client review all currently use `private, no-store`. That policy remains unchanged.

The default `/_next/image` optimizer is unsuitable here: our installed Next 16.3.4 Image documentation explicitly states that the source fetch does not forward authentication headers. Its shared optimized-image cache also cannot replace the existing per-request review/session/visibility checks. Setting private routes to public or making an authorization token part of an image URL is not an acceptable workaround.

Stored derivatives would require Storage writes, lifecycle management and extra provenance. Instead we reuse the image engine already shipped with the pinned Next version **inside the authorized proxy**, with no optimizer HTTP subrequest and no new dependency. The internal Next import is isolated in `image-delivery-server.ts`; framework upgrades must run its real AVIF/WebP tests and a deployed runtime check.

## Delivery and cache contract

- Only GPT managed article images and Canva managed full-layout images are changed in the reader. The admin Design Asset ID mapper also supports their PNG previews, including draft assets already accessible to admins. Institution photos, raw bucket/path URLs and unrelated images retain their previous delivery.
- Native `<picture>` selects AVIF, then WebP; `<img src>` retains the original PNG proxy URL. A transform failure, saturation, or an output larger than the original falls back to the original PNG.
- Original bytes, DB rows, Storage paths, provenance and source hashes are never modified. There are no derivative Storage files.
- Each request still passes project/article/block/provenance/active/approval/publication or admin/review authorization **before** it can access a transformed result. There is no new public optimization endpoint, signed URL, or private path in the responsive source URLs.
- Keep `private, no-store`, `nosniff` and `no-referrer`; no shared CDN caching is introduced. `Vary: Accept` is also emitted. Session revocation and asset approval/visibility changes cannot be bypassed by an optimizer cache hit.
- A process-local derivative cache is keyed by the original SHA-256 + clamped width + format + quality. It contains at most 24 entries / 24 MiB, is consulted only after access checks and a current source read, and coalesces concurrent identical transforms. At most four transforms run concurrently. No persistence or cross-process cache is promised.
- Transform requests accept only 240/480/768/960/1200/1600 maximum widths and AVIF/WebP. They clamp to the PNG's intrinsic width, preserve aspect ratio and alpha, and never upscale. Input is bounded to 10 MiB / 40 megapixels with a seven-second encoder timeout.
- GPT quality: 85; Canva: 90 to preserve text/lines. Next's existing AVIF quality equivalence conversion is reused. No JPEG conversion.
- Enlarging/lightbox deliberately requests the original authenticated proxy URL, with no delivery parameters. Initial reader images use responsive delivery; original transfer happens only when the user explicitly enlarges.

## Reader sizes

The public reader shell is max 520px, not a full desktop/e-book canvas. Mobile ArticleCard margins consume 40px; padding consumes 48–56px, plus borders. Typical image content width is 422–462px, including admin preview differences.

`sizes="(max-width: 520px) calc(100vw - 88px), 464px"` is a conservative slot bound. A 2x screen at the maximum reader width can select 960px; higher DPR can select 1200/1600px, capped server-side to the source width. Desktop viewport width alone does not justify sending a 1600px image into this narrow reader. E-book page images remain outside this change.

Do not use `sizes="auto"` without intrinsic width/height: native lazy-image size containment can give an unknown image the browser's 300×150 fallback ratio. Explicit media sizes preserve the original aspect ratio here.

## Read-only validation

Existing fixed Staging assets:

| Asset | Original | Original dimensions | 480 AVIF | 960 AVIF | WebP at 960 |
| --- | ---: | --- | ---: | ---: | ---: |
| GPT `cd2849ee-108c-5e41-8f0b-548ba8f769aa` | 3,384,518 B | 1536×1920 | 11,862 B | 32,942 B | 70,448 B |
| Canva `d3401167-8d8a-5466-a78e-d791ef427859` | 155,945 B | 397×559 | 6,767 B | 6,767 B (397px cap) | 15,358 B (397px cap) |

These initial byte measurements use the actual Staging originals and the real bundled encoder locally. Separate deployed measurements are recorded below.

The existing GPT asset is draft and neither representative asset is currently applied to an article. Read-only QA must not approve/apply/publish them to manufacture a test scenario. Use the existing authenticated admin asset mapper for deployed format/byte checks and local render fixtures using those same originals for 1440/768px layout checks. Invalid/inactive/unapproved article assets, public visibility and expired/revoked review sessions are additionally covered by proxy tests. There is no active client-review session for a live image E2E; do not weaken review access to create one.

The available Canva evidence is already a 397px-wide PNG. Delivery cannot recover missing retina detail or fix its existing template/content-fit issues. Compare encoding fidelity at the original resolution; do not upscale it or claim it is a new high-resolution export.

### Fixed Staging deployed verification

- Vercel staging deployment `3ZRf2t4YEmP83MMfQKL68DDrf9Vg` served `a1fad84242908142e045de815d50f4a450e47673` on the fixed domain; the flex-wrapper correction was then deployed as `1c05857ee859f2da8120ff1820447a66458cc417`.
- Authenticated browser GET, existing asset ID mapper, `deliveryWidth=960&deliveryFormat=avif`: GPT **33,021 B / 960×1200**; Canva **6,708 B / 397×559**. Actual browser downloads were checked by file byte size and decoded metadata. These are response body bytes, not HTTP/TLS header overhead. The platform encoder output differs slightly from local binaries; do not substitute local estimates for deployed measurements.
- Thus the measured 960px delivery reduces GPT transfer by 99.0% and Canva by 95.7%, without changing the originals. Native local reader-sized fixtures at 1440/768px and DPR1 selected the 480px AVIF candidate (local 11,862 B GPT / 6,767 B Canva). The real admin thumbnails select240px; both load successfully at 1440/768px. No horizontal overflow or console errors at those requested widths.
- At source resolution Canva title/date/place/summary/CTA remain readable, but existing content-fit/layout issues are not corrected here. No claim of high-resolution/2x Canva visual QA is made for this low-resolution evidence file.
- Anonymous network requests encounter Vercel's existing SSO protection (302 to Vercel SSO), not image bytes. Unit/route tests separately exercise application-level public visibility, admin authorization and pending/expired/revoked review policies with delivery parameters, and deny foreign/inactive/unapproved/provenance-invalid references before Storage.
- The admin thumbnail wrapper needed `display:contents` to preserve the previous flex item's width; this is covered by the picture contract test and verified on the deployed admin screen.
- Existing article/block/link/Design Asset/job row counts and complete-row digests, plus both original PNG SHA-256 values, match before/after. No approval, apply, publish, migration, DB/Storage write, GPT or Canva generation call was used.
- Full suite322/322 (no skips), TypeScript, lint, Webpack build and diff check pass; only the three pre-existing lint warnings remain.

### Remaining live QA / merge decision

Keep the PR open until the actual reader/client-review and high-resolution Canva checks can be completed without violating the no-write constraint. The representative GPT asset is draft; neither representative image has an applied reader block, and no active review session exists. Consequently the deployed checks above establish authorized proxy/encoder operation and admin rendering, while shared renderer tests/local fixtures cover markup, aspect ratio and HTML preservation. They are **not** a live public or client-review image E2E. The 2x delivery candidate is available and tested, but the existing 397px Canva source cannot establish 2x text fidelity. No auth bypass or temporary publication is introduced to work around these missing fixtures.
