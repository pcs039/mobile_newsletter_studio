# AI Visual Director v1

Pure recommendation only. No LLM/image/Canva/Adobe calls, execution, persistence, renderer changes or migration.

`analyzeArticleVisualNeeds` reads bounded visible text through the existing pattern input selector, publicInfo allowlist, article type, visible paragraph/info/quote/image structure, urgency/publication kind and institution priority. It returns booleans/counts only. Image presence is not proof of a real photo. The caller supplies institutional material availability from existing approved active institution-source project visual assets; review of suitability remains an operator task.

`recommendVisualStrategy` applies precedence: urgent/time-sensitive HTML → real photo + information hybrid → real subject/institution source → procedural/numeric/map information graphic → structured Canva layout → symbolic/seasonal generated image → HTML fallback. Unknown/insufficient inputs ask the operator to clarify purpose/data. Urgent notices do not wait for image production. Specific person/interview, past event record, identified facility/product and local on-site reporting never request generated imagery.

`buildVisualDirectorResult` returns primary/optional secondary, heuristic confidence (not calibrated probability), reasons, need flags, human input guidance and optional Adobe postprocessing tasks. Adobe is a capability, never a strategy. These suggestions do not invoke tools. Existing Visual Asset Spec/concept generation and explicit execution buttons are unchanged; the director itself neither creates new specs nor triggers generation.

Only when the selected primary is canva_full_layout does it delegate to `recommendArticleDesignTemplates`. Result includes canonical family/IDs and the existing Top 3 DTO for UI reuse; no duplicated family/variant scoring or field mapping. Unsubstantiated Canva candidates fall back to HTML/human review. Unsupported datasets continue to be excluded by the existing registry recommender.

UI: compact “AI 시각 전략” at the top of the existing AI design recommendation container, followed by existing recommendation/concept controls. Article prop changes recompute useMemo; recommendation is never saved. Existing manual design and concept/draft controls remain available. Only the new director decides whether to expose the Canva Top 3 candidates; other strategies show neutral planning guidance instead of an error/empty Canva candidate warning.

Representative fixtures: festival→Canva; mayor interview→institution asset/real photo; support application steps→information graphic; urgent traffic closure→HTML; seasonal cultural concepts→generated image recommendation; real facility photograph+comparison table→hybrid. Availability and postprocessing are advice, not an assertion that the material is licensed, factually appropriate or edited.
