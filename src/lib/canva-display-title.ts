// Presentation only: never write this derived value back to article content.
// Semantic boundaries are deterministic heuristics, not linguistic analysis.
export function validateCanvaTitleOverride(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw Error("표시 제목을 확인해 주세요.");
  const title = value.replace(/\r\n/g, "\n");
  if (!title.trim() || title.length > 500 || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(title) || title.split("\n").length > 3 || title.split("\n").some(line => !line.trim())) {
    throw Error("표시 제목은 빈 줄 없이 1~3줄, 500자 이하로 입력해 주세요.");
  }
  return title;
}

function visualWidth(text: string) {
  return Array.from(text).reduce((width, character) => width + (/\s/.test(character) ? 0.3 : /[\u0021-\u007e]/.test(character) ? 0.55 : 1), 0);
}

export function canvaDisplayTitle(title: string): string {
  // Preserve deliberate line breaks and short titles. Never split a single word.
  if (/[\r\n]/.test(title) || visualWidth(title) <= 16) return title;
  const boundaries = Array.from(title.matchAll(/\s+/g), match => ({
    start: match.index!, end: match.index! + match[0].length,
    punctuation: /[,：:·–—]$/.test(title.slice(0, match.index!).trimEnd()),
  }));
  if (!boundaries.length || boundaries.length > 100) return title;
  const words = title.trim().split(/\s+/).length;
  function candidate(cuts: typeof boundaries) {
    const lines: string[] = []; let start = 0;
    for (const cut of cuts) { lines.push(title.slice(start, cut.start)); start = cut.end; }
    lines.push(title.slice(start));
    if (lines.some(line => !line.trim() || /^[,:·–—]/.test(line.trim()))) return null;
    const counts = lines.map(line => line.trim().split(/\s+/).length);
    // Avoid one/two-word orphans when enough words exist for substantial lines.
    const minimum = words >= lines.length * 3 ? 3 : 2;
    if (counts.some(count => count < minimum)) return null;
    // Keep a year with its event name rather than leaving it on the preceding line.
    if (lines.slice(0, -1).some(line => /(?:^|\s)\d{4}년?$/.test(line.trim()))) return null;
    const widths = lines.map(visualWidth);
    const max = Math.max(...widths), min = Math.min(...widths);
    // Prefer keeping common modifiers and their nouns, or names and actions,
    // together. This is a small Korean heading heuristic, not AI inference.
    const phrasePenalty = lines.slice(0, -1).reduce((penalty, line, index) => penalty +
      (/(?:^|\s)(함께|대표|지역|가족|참여|지원|신청|및|또는|그리고)$/.test(line.trim()) ? 12 : 0) +
      (/^(개최|모집|안내|신청)(?:\s|$)/.test(lines[index + 1].trim()) ? 12 : 0), 0);
    const score = (max - min) + Math.max(0, max - 14) * 8 + phrasePenalty - cuts.filter(cut => cut.punctuation).length * 12;
    return { lines, max, score };
  }
  const pairs = boundaries.map(cut => candidate([cut])).filter(result => result !== null).sort((a,b) => a.score - b.score);
  const two = pairs[0];
  // Prefer two lines. A third line is only considered when two are too wide.
  if (two && two.max <= 17) return two.lines.join("\n");
  const triples = boundaries.flatMap((first, i) => boundaries.slice(i + 1).map(second => candidate([first, second])))
    .filter(result => result !== null).sort((a,b) => a.score - b.score);
  const three = triples[0];
  return (three && (!two || three.max < two.max) ? three : two)?.lines.join("\n") ?? title;
}
