"use client";

import { useEffect, useRef, useState } from "react";
import type { ArticleTextDesign } from "@/lib/article-text-design";
import type { ArticleCompositionPlacementSettings, ProjectArticleComposition } from "@/lib/article-composition";

export type DesignSaveStatus = "saved" | "dirty" | "saving" | "error";
type Receipt = { composition: ProjectArticleComposition; message?: string };
type SaveTask = {
  key: string;
  kind: "text" | "layout";
  perform: () => Promise<Receipt>;
  placementId?: string;
  replacesText?: boolean;
  retryable?: boolean;
  signature?: string;
};
type PlacementPatch = Partial<Pick<ProjectArticleComposition["assets"][number], "settings" | "isVisible" | "sortOrder">>;
type PlacementDraft = { patch: PlacementPatch; version: number };
const textOf = (value: ProjectArticleComposition | null) => (value?.settings.textDesign ?? {}) as ArticleTextDesign;
const sameText = (a: ArticleTextDesign, b: ArticleTextDesign) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// One editor owns a serial write queue. Responses never race the next write, and
// they acknowledge only the draft revision actually submitted to that request.
export function useCompositionSaveState(initial: ProjectArticleComposition | null, articleId: string) {
  const [saved, setSaved] = useState(initial);
  const [text, setText] = useState<ArticleTextDesign>(() => textOf(initial));
  const [placements, setPlacements] = useState<Record<string, PlacementDraft>>({});
  const [textStatus, setTextStatus] = useState<DesignSaveStatus>("saved");
  const [layoutStatus, setLayoutStatus] = useState<DesignSaveStatus>("saved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingCounts, setPendingCounts] = useState({ text: 0, layout: 0 });
  const [canRetryLayout, setCanRetryLayout] = useState(false);
  const savedRef = useRef(saved), textRef = useRef(text), placementRef = useRef(placements);
  const textRevision = useRef(0), placementRevision = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0), scope = useRef(0);
  const pendingKinds = useRef({ text: 0, layout: 0 });
  const failures = useRef(new Map<string, SaveTask>());
  const latestTextSave = useRef(0);
  const pendingTasks = useRef(new Map<string, Promise<Receipt | null>>());

  useEffect(() => () => { scope.current += 1; }, []);

  function changeText(next: ArticleTextDesign) {
    textRevision.current += 1;
    textRef.current = next;
    setText(next);
    setTextStatus([...failures.current.values()].some(t => t.kind === "text") ? "error" : sameText(next, textOf(savedRef.current)) ? "saved" : "dirty");
  }

  function previewPatch(id: string, patch: PlacementPatch) {
    placementRef.current = { ...placementRef.current, [id]: { patch: { ...placementRef.current[id]?.patch, ...patch }, version: ++placementRevision.current } };
    setPlacements(placementRef.current);
    setLayoutStatus("dirty");
  }

  function accept(next: ProjectArticleComposition) {
    savedRef.current = next;
    setSaved(next);
  }

  function save(task: SaveTask): Promise<Receipt | null> {
    const requestId = task.signature === undefined ? undefined : `${task.key}:${task.signature}`;
    if (requestId && pendingTasks.current.has(requestId)) return pendingTasks.current.get(requestId)!;
    const expectedScope = scope.current;
    const revision = textRevision.current;
    const submittedPlacement = task.placementId ? placementRef.current[task.placementId]?.version : undefined;
    const textSave = task.kind === "text" ? ++latestTextSave.current : 0;
    pending.current += 1;
    pendingKinds.current[task.kind] += 1;
    setPendingCounts({ ...pendingKinds.current });
    setBusy(true);
    if (task.kind === "text") setTextStatus("saving"); else setLayoutStatus("saving");

    const work = async () => {
      if (expectedScope !== scope.current) return null;
      try {
        const result = await task.perform();
        if (expectedScope !== scope.current) return null;
        if (result.composition.articleId !== articleId || (savedRef.current && result.composition.id !== savedRef.current.id)) {
          throw new Error("현재 기사의 저장 결과를 확인하지 못했습니다. 저장본을 다시 확인하세요.");
        }
        accept(result.composition);
        failures.current.delete(task.key);
        setCanRetryLayout([...failures.current.values()].some(t => t.kind === "layout" && t.retryable));
        if (task.kind === "text" || task.replacesText) {
          if (textRevision.current === revision) {
            textRef.current = textOf(result.composition);
            setText(textRef.current);
          }
          if (task.kind !== "text" || textSave === latestTextSave.current) {
            setTextStatus(sameText(textRef.current, textOf(result.composition)) ? "saved" : "dirty");
          }
        }
        if (task.placementId && placementRef.current[task.placementId]?.version === submittedPlacement) {
          const next = { ...placementRef.current };
          delete next[task.placementId];
          placementRef.current = next;
          setPlacements(next);
        }
        if (task.kind === "layout") setLayoutStatus([...failures.current.values()].some(t => t.kind === "layout") ? "error" : Object.keys(placementRef.current).length ? "dirty" : "saved");
        setError(failures.current.size ? "저장 실패 — 재시도 필요. 실패한 입력은 유지됩니다." : "");
        return result;
      } catch (failure) {
        if (expectedScope !== scope.current) return null;
        failures.current.set(task.key, task);
        setCanRetryLayout([...failures.current.values()].some(t => t.kind === "layout" && t.retryable));
        const message = failure instanceof Error ? failure.message : "디자인을 저장하지 못했습니다.";
        setError(message);
        if (task.kind === "text") setTextStatus("error"); else setLayoutStatus("error");
        return null;
      } finally {
        if (expectedScope === scope.current) {
          if (requestId) pendingTasks.current.delete(requestId);
          pending.current -= 1;
          pendingKinds.current[task.kind] -= 1;
          setPendingCounts({ ...pendingKinds.current });
          setBusy(pending.current > 0);
        }
      }
    };
    const result = queue.current.then(work, work);
    queue.current = result;
    if (requestId) pendingTasks.current.set(requestId, result);
    return result;
  }

  // Draft apply is disabled while local drafts/writes exist. If typing starts
  // during that external action, keep the new local text over its fresh receipt.
  function acceptApplied(next: ProjectArticleComposition) {
    if (pending.current || next.articleId !== articleId || (savedRef.current && next.id !== savedRef.current.id)) return;
    if (savedRef.current && next.updatedAt < savedRef.current.updatedAt) return;
    const dirtyText = !sameText(textRef.current, textOf(savedRef.current));
    accept(next);
    if (!dirtyText) { textRef.current = textOf(next); setText(textRef.current); }
    setTextStatus(dirtyText ? "dirty" : "saved");
  }

  const composition: ProjectArticleComposition | null = saved ? {
    ...saved,
    settings: { ...saved.settings, textDesign: { ...text } },
    assets: saved.assets.map(p => placements[p.id] ? { ...p, ...placements[p.id].patch } : p),
  } : null;
  return {
    composition, saved, textStatus: pendingCounts.text ? "saving" as const : textStatus,
    layoutStatus: pendingCounts.layout ? "saving" as const : layoutStatus, busy, error, changeText, previewPatch, save, acceptApplied,
    previewPlacement: (id: string, settings: ArticleCompositionPlacementSettings) => previewPatch(id, { settings: { ...settings } }),
    placementPatch: (id: string) => placementRef.current[id]?.patch,
    hasUnsaved: !sameText(text, textOf(saved)) || Object.keys(placements).length > 0 || textStatus === "error" || layoutStatus === "error",
    retryLayout: () => {
      for (const task of failures.current.values()) if (task.kind === "layout" && task.retryable) void save(task);
    },
    canRetryLayout,
  };
}
