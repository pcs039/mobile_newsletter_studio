# Article design concepts v1

Base: 9a53ca88f15d1912bfddff256c340cf5f15ad448.

## Flow and scope

Explicit analysis → three concepts → one selection → deterministic proposal → confirmed atomic apply.
No automatic analysis on save, no automatic apply. Concepts exist only in client state.
The existing pattern-recommendation endpoint accepts mode=concepts; existing callers retain their contract.
The existing design-draft prepare/apply endpoint accepts a strictly validated concept.

Each concept includes name, description, pattern, visual tone, layout direction, semantic color direction,
asset role, and rationale. Strings have limits; unknown keys/values, HEX directions, duplicate names/layouts,
invalid JSON, or fewer/more than three concepts are rejected.

## AI and fallback

The existing OpenAI Responses helper/provider is reused with store=false.
Only saved title/summary/body/visible text blocks (at most 6000 characters of text), article type/body length,
and image/date/place presence flags enter the input. Asset IDs, Storage paths, project/private metadata,
Canva tokens and review data are not supplied. Output uses a strict JSON schema.
API failure, timeout, malformed output, rate-limit protection, missing configuration or insufficient content
produce three deterministic alternatives. Permission/missing-article failures never become fallback success.
Fallback uses the actual article types: event_festival → event; welfare_health/government_major → policy;
other types → manual. It does not infer a nonexistent interview article type.

## Deterministic apply and limitations

### Style quality rules

HTML owns meaningful title/body/info/quote/caption text; raster assets provide separate background or
illustration roles. Concepts must not assume baked-in image text or replace HTML text with an image.
The prompt prioritizes the institution's existing brand tone, without inventing unavailable brand information,
and discourages excessive advertising or painterly presentation. Mobile readability and normal/maximum
text-scale stability take priority over decoration; fixed-height, overlapping or text-obscuring proposals are excluded.
Background and illustration remain separate semantic roles. Future decoration/pattern roles can be modeled
separately without changing article content; they are not accepted or automatically placed in this version.
These are recommendation constraints, not new image generation or renderer behavior.

The existing draft planner gates assets by same project, approved/active/web compatibility,
explicit pattern tags and existing visible use in a ready Composition. No source preference or arbitrary ID input.
Concept asset role narrows allowed candidates to none/background/illustration/both.
Occupied slots—including hidden placements—remain untouched. Only hero_background and hero_illustration can be proposed.
Information/friendly configurations emphasize existing info or quote; editorial does not newly enable body emphasis.
Only nonempty existing captions are styled. No content/labels/subtitles are AI-generated.
Manual remains a complete no-op, including versions and placements.

Visual tone, whitespace/image priority and color direction are guidance, not a new renderer or free layout system.
Existing article colors are preserved. A read-only deterministic palette reference uses valid current background
title/body/accent tokens first, then project brand/default colors; it never invents a HEX.
**The unchanged v1.35 atomic RPC does not permit writing placement color tokens. This PR therefore does not
automatically recolor existing articles.** This limit is explicit in the UI; existing manual color controls remain.
No second sequential save is used to bypass atomicity. No schema/RPC/renderer/dependency changes.

Prepare returns only safe proposal fields and its fingerprint. Apply recomputes current saved state and validates
the confirmation before using v1.35. Settings, placement row IDs/core values, updated_at and content-version
snapshot conflict checks are unchanged. Concepts are validated but never used as DB paths or asset authorization.

## Validation (Staging only, 2026-10-11)

Local branch server used only mvrkpmffuhcqwisqvpqi. Four fixture articles returned real AI three-concept results:
event/event/event, policy/policy/policy, interview/interview/interview, manual/manual/manual.
Analysis and prepare snapshots were unchanged. Apply changed only Composition settings/placements.
Original article/block/link/image hashes remained unchanged, including after explicit browser apply.
Old confirmations returned 409 for the three nonmanual fixtures; manual stayed unchanged on reapply.
Anonymous 401, cross-project 404, unapproved asset exclusion; unit tests also cover unsafe/cross-project candidates.
Browser: real selection → proposal → apply success; insufficient-content fallback showed three cards without AI.
Provider failure/429/malformed JSON fallback verified with isolated existing-provider mocks.
Admin actual iframe and public reader at 390/768 with normal/xlarge had matching scrollWidth/clientWidth.
Admin/public console errors: 0. The full desktop reader at 768 retains its existing presentation.
Concept cards use available panel width and explicit wrapping, avoiding the global button nowrap rule.
Cleanup: all nine owned fixture tables and three Storage objects returned zero; existing user fixtures untouched.

31 tests passed; lint has only the three existing warnings, no new warnings.
TypeScript, webpack production build and diff check passed.
PR stays OPEN; no merge, Production migration, DB or Storage writes.
