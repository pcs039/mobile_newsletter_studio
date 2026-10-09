// Shared with the existing article draft provider; credentials stay on the server.
export const articleAiMaxSourceLength = 30_000;
export const articleAiRequestTimeoutMs = 55_000;

export function requestArticleAiResponse(apiKey: string, payload: Record<string, unknown>, signal: AbortSignal) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_ARTICLE_MODEL?.trim() || "gpt-5.6-terra",
      store: false,
      reasoning: { effort: "low" },
      ...payload,
    }),
    cache: "no-store",
    signal,
  });
}
