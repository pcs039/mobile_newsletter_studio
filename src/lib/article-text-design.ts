export type ArticleTextDesign = {
  subtitleEnabled?: boolean;
  subtitle?: string;
  numberEnabled?: boolean;
  number?: string;
  numberShape?: "circle" | "rounded" | "square";
  labelEnabled?: boolean;
  label?: string;
};

export function validateArticleTextDesign(value: unknown): { ok: true; settings: ArticleTextDesign } | { ok: false; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, message: "텍스트 디자인 설정을 확인해 주세요." };
  const input = value as Record<string, unknown>;
  const allowed = ["subtitleEnabled", "subtitle", "numberEnabled", "number", "numberShape", "labelEnabled", "label"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) return { ok: false, message: "지원하지 않는 텍스트 디자인 설정입니다." };
  const settings: ArticleTextDesign = {};
  for (const key of ["subtitleEnabled", "numberEnabled", "labelEnabled"] as const) {
    if (!(key in input)) continue;
    if (typeof input[key] !== "boolean") return { ok: false, message: "사용 여부를 확인해 주세요." };
    settings[key] = input[key];
  }
  for (const [key, limit] of [["subtitle", 300], ["number", 3], ["label", 80]] as const) {
    if (!(key in input)) continue;
    const text = input[key];
    if (typeof text !== "string" || text.length > limit || (key === "number" && text.trim() && !/^\d{1,3}$/.test(text.trim()))) return { ok: false, message: key === "number" ? "번호는 1~3자리 숫자로 입력해 주세요." : `텍스트는 ${limit}자 이하로 입력해 주세요.` };
    settings[key] = text.trim();
  }
  if ("numberShape" in input) {
    if (!["circle", "rounded", "square"].includes(input.numberShape as string)) return { ok: false, message: "번호 모양을 확인해 주세요." };
    settings.numberShape = input.numberShape as ArticleTextDesign["numberShape"];
  }
  return { ok: true, settings };
}

export function readArticleTextDesign(value: unknown): ArticleTextDesign {
  const result = validateArticleTextDesign(value);
  return result.ok ? result.settings : {};
}

export function hasArticleTextDesign(settings?: ArticleTextDesign) {
  return Boolean(settings && ((settings.subtitleEnabled && settings.subtitle) || (settings.numberEnabled && settings.number) || (settings.labelEnabled && settings.label)));
}
