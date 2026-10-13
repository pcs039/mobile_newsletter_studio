# Canva result review v1

The existing recommendation execution result now exposes operator review directly below Top 3. Creation never implies approval. `created`, `reviewing`, `approved`, and `needs_revision` describe a local acknowledgement only; absent active results represent `not_created`.

- Confirm/open: open the validated existing Canva edit URL; no creation or sync.
- Use this design: explicitly acknowledge the active result.
- Revise: open that same URL and request a fresh operator review on return. The app does not detect Canva editing completion.
- Cancel selection: remove approval, retaining the generated result for review.
- Choose another: clear the active result and recommendation selection, without deleting the Canva design or server execution history.

Session persistence stores only the design ID, validated Canva edit URL, completion timestamp, review state, and a SHA-256 digest of project/article/template input context. No article copy, tokens, payload, DB schema, server review record, export, asset write, or publication is involved. This browser tab's session survives navigation/reload; closing it ends persistence. Restricted storage falls back to mounted component state. Selecting a different template or changing the saved article context invalidates the cached result. A new design ID starts at created; duplicate same-ID results retain the operator decision. Existing hidden workspace tabs preserve state on tab movement.

Validation: isolated execution/UI tests mock existing preparation/execution responses; no real Canva API calls. Actual component SSR markup and production CSS verified locally at 1440 and 768px. Review actions introduce no server requests. Production build uses Webpack because this host denies Turbopack's internal port binding. Existing lint warnings are unchanged.
