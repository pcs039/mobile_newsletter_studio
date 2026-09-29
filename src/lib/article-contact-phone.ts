export type ArticleContactPhoneStatus = "complete" | "needs_area_code" | "invalid";

const phoneCandidatePattern =
  /(?<!\d)(?:\+82[\s().-]*\d{1,2}[\s().-]*\d{3,4}[\s.-]*\d{4}|0\d{1,2}[\s().-]*\d{3,4}[\s.-]*\d{4}|1[568]\d{2}[\s.-]*\d{4}|\d{3,4}[\s.-]+\d{4})(?!\d)/g;
const representativePrefixPattern = /^1[568]\d{2}$/;

function stripPhoneScheme(value: string) {
  return value.trim().replace(/^tel:/i, "").trim();
}

export function normalizeArticleContactPhone(value: string) {
  const cleaned = stripPhoneScheme(value);
  const hasInternationalPrefix = cleaned.startsWith("+");
  const digits = cleaned.replace(/\D/g, "");

  return `${hasInternationalPrefix ? "+" : ""}${digits}`;
}

export function getArticleContactPhoneStatus(value: string | null | undefined): ArticleContactPhoneStatus {
  const cleaned = stripPhoneScheme(value ?? "");

  if (!cleaned || /[a-z]/i.test(cleaned) || !/^\+?[\d\s().-]+$/.test(cleaned)) {
    return "invalid";
  }

  const digits = cleaned.replace(/\D/g, "");

  if (/^\+82/.test(cleaned)) {
    return digits.length >= 11 && digits.length <= 12 ? "complete" : "invalid";
  }

  if (/^1[568]\d{6}$/.test(digits)) {
    return "complete";
  }

  if (digits.startsWith("0")) {
    return digits.length >= 9 && digits.length <= 11 ? "complete" : "invalid";
  }

  const localMatch = cleaned.match(/^(\d{3,4})[\s.-]+(\d{4})$/);

  if (!localMatch) {
    return "invalid";
  }

  const prefix = localMatch[1];

  if (representativePrefixPattern.test(prefix)) {
    return "complete";
  }

  const numericPrefix = Number(prefix);

  if (prefix.length === 4 && numericPrefix >= 1900 && numericPrefix <= 2099) {
    return "invalid";
  }

  return "needs_area_code";
}

export function findArticleContactPhones(text: string) {
  return [...text.matchAll(phoneCandidatePattern)]
    .map((match) => match[0].trim())
    .filter((phone) => getArticleContactPhoneStatus(phone) !== "invalid");
}

export function findIncompleteContactPhones(text: string) {
  return [...new Set(
    findArticleContactPhones(text).filter(
      (phone) => getArticleContactPhoneStatus(phone) === "needs_area_code",
    ),
  )];
}

export function isSourceContactPhone(value: string, sourceText: string) {
  if (getArticleContactPhoneStatus(value) === "invalid") {
    return false;
  }

  const normalized = normalizeArticleContactPhone(value);

  return findArticleContactPhones(sourceText).some(
    (candidate) => normalizeArticleContactPhone(candidate) === normalized,
  );
}
