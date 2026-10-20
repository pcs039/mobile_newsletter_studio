// UI request ownership only; the existing server remains responsible for authorization.
export function createArticleSubmitGate() {
  let generation = 0;
  let active = true;
  let busy = false;
  return {
    activate() { generation += 1; active = true; busy = false; },
    invalidate() { generation += 1; active = false; busy = false; },
    begin() {
      if (!active || busy) return null;
      busy = true;
      const scope = generation;
      return {
        isCurrent: () => active && generation === scope,
        finish() { if (generation === scope) busy = false; },
      };
    },
  };
}
