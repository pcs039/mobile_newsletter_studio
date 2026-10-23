import type { ProjectArticleComposition } from "@/lib/article-composition";
import type { ProjectDesignAsset } from "@/lib/newsletter-repository";

export type CopyOutcome = "success" | "rejected" | "unknown";
type Source = { composition: ProjectArticleComposition; assets: ProjectDesignAsset[] };
type Phase = "idle" | "loading" | "ready" | "empty" | "checking" | "copying" | CopyOutcome;
type CopyBody = { ok?: boolean; copyOutcome?: CopyOutcome; message?: string; composition?: ProjectArticleComposition; result?: { sourceArticleId?: string; targetArticleCount?: number } };
type CopyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const copyScopeNotice = "배경·상단 이미지 등의 자산 배치만 교체합니다. HTML 텍스트 디자인·글꼴·제작 패턴과 기사 제목·본문·링크는 유지됩니다. 적용 대상 Composition은 draft로 전환됩니다.";

function fingerprint(source: Source) {
  return JSON.stringify([source.composition, source.assets.map(a => [a.id, a.approvalStatus, a.isActive, a.updated]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))]);
}

// Local safety controller only: the existing RPC remains the transaction authority.
export class CompositionCopySafety {
  sourceId = "";
  source: Source | null = null;
  phase: Phase = "idle";
  message = "";
  savedChecks: Array<{ articleId: string; count: number; status: string }> = [];
  inspecting = false;
  private active = true;
  private version = 0;
  private flight = false;
  private targets: string[] = [];
  private readonly storageKey: string;
  constructor(readonly projectSlug: string, private changed: () => void, private request: typeof fetch = fetch,
    private storage: () => CopyStorage = () => window.sessionStorage, private timeoutMs = 15_000) {
    this.storageKey = `composition-copy-pending:${projectSlug}`;
  }
  get locked() { return this.phase === "unknown"; }
  get busy() { return this.flight || this.phase === "loading"; }
  get canCopy() { return !this.busy && !this.locked && !!this.source?.composition.assets.length; }
  affectsArticle(articleId: string) { return this.locked && this.targets.includes(articleId); }
  activate() { this.active = true; }
  dispose() { this.active = false; this.version++; }
  private notify() { if (this.active) this.changed(); }
  restore() {
    try {
      const saved = this.storage().getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved) as { targets?: unknown };
        if (!Array.isArray(data.targets) || !data.targets.length || data.targets.some(id => typeof id !== "string")) throw Error("invalid marker");
        this.targets = data.targets;
        this.unknown();
      }
      return true;
    } catch { this.phase = "rejected"; this.message = "복사 잠금 정보를 확인할 수 없습니다. 이 브라우저에서는 복사하지 않습니다."; this.notify(); return false; }
  }
  private unknown() {
    this.phase = "unknown";
    this.message = "결과 확인 필요 — 서버에 반영됐을 수 있어 이 탭의 해당 프로젝트 복사를 잠갔습니다. 저장본 조회만으로 요청 성공을 확정할 수 없으며 자동 재시도하지 않습니다.";
    this.notify();
  }
  private async json(url: string, init?: RequestInit) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.timeoutMs);
    try {
      const response = await this.request(url, { ...init, cache: "no-store", signal: abort.signal });
      const data = await response.json();
      if (abort.signal.aborted) throw Error("timeout");
      return { response, data };
    } finally { clearTimeout(timer); }
  }
  private async read(articleId: string): Promise<Source> {
    const { response, data } = await this.json(`/api/project-article-composition?${new URLSearchParams({ projectSlug: this.projectSlug, articleId })}`);
    if (!response.ok || !data?.ok || data.composition?.articleId !== articleId || !Array.isArray(data.composition.assets) || !Array.isArray(data.assets)) throw Error("read_failed");
    return { composition: data.composition, assets: data.assets };
  }
  async selectSource(id: string) {
    if (this.flight || this.locked || !this.restore() || this.locked) return;
    const version = ++this.version;
    this.sourceId = id; this.source = null; this.savedChecks = [];
    this.phase = id ? "loading" : "idle"; this.message = ""; this.notify();
    if (!id) return;
    try {
      const source = await this.read(id);
      if (!this.active || version !== this.version) return;
      this.source = source;
      this.phase = source.composition.assets.length ? "ready" : "empty";
      this.message = this.phase === "empty" ? "배치 0개 — 적용하면 대상의 기존 배치가 삭제되므로 복사할 수 없습니다." : "원본 배치를 확인했습니다. 실행 직전에 다시 조회합니다.";
    } catch {
      if (!this.active || version !== this.version) return;
      this.phase = "rejected"; this.message = "원본 조회 실패 — 복사를 실행하지 않았습니다. 원본을 다시 선택해 주세요.";
    }
    this.notify();
  }
  async copy(targets: string[], single: boolean, confirm: () => boolean): Promise<CopyBody | null> {
    if (!this.canCopy || !targets.length || new Set(targets).size !== targets.length || targets.includes(this.sourceId) || !this.restore() || this.locked) return null;
    this.flight = true;
    const version = this.version, sourceId = this.sourceId;
    try {
      if (!confirm()) return null;
      this.phase = "checking"; this.message = "원본 배치를 다시 확인하고 있습니다."; this.notify();
      let fresh: Source;
      try { fresh = await this.read(sourceId); } catch {
        this.phase = "rejected"; this.source = null; this.message = "실행 전 원본 조회 실패 — 복사는 실행하지 않았습니다."; return null;
      }
      if (!this.active || version !== this.version) return null;
      const changed = fingerprint(fresh) !== fingerprint(this.source!);
      this.source = fresh;
      if (!fresh.composition.assets.length || changed) {
        this.phase = fresh.composition.assets.length ? "ready" : "empty";
        this.message = fresh.composition.assets.length ? "원본이 변경되어 실행하지 않았습니다. 새 배치 정보를 확인한 뒤 다시 적용하세요." : "원본 배치가 0개로 변경되어 복사를 차단했습니다.";
        return null;
      }
      this.targets = [...targets];
      try { this.storage().setItem(this.storageKey, JSON.stringify({ targets })); } catch {
        this.phase = "rejected"; this.message = "결과 불명 잠금을 보관할 수 없어 복사하지 않았습니다."; return null;
      }
      this.phase = "copying"; this.message = "디자인 배치를 적용하고 있습니다."; this.notify();
      try {
        const { response, data } = await this.json("/api/project-article-composition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: single ? "copy_composition" : "copy_compositions_batch", projectSlug: this.projectSlug, sourceArticleId: sourceId, ...(single ? { articleId: targets[0] } : { targetArticleIds: targets }) }) });
        if (!this.active || version !== this.version) return null;
        const body = data as CopyBody;
        const receiptValid = single ? body.composition?.articleId === targets[0] : body.result?.sourceArticleId === sourceId && body.result.targetArticleCount === targets.length;
        if (response.ok && body.ok && body.copyOutcome === "success" && receiptValid) {
          this.storage().removeItem(this.storageKey); this.phase = "success"; this.message = "서버가 복사 완료를 확인했습니다. Composition은 draft 상태입니다."; return body;
        }
        if (!response.ok && body.copyOutcome === "rejected") {
          this.storage().removeItem(this.storageKey); this.phase = "rejected"; this.message = body.message || "서버가 복사를 거절했습니다."; return null;
        }
      } catch { /* POST may have committed. Never retry or claim rollback. */ }
      this.unknown(); return null;
    } finally { this.flight = false; this.notify(); }
  }
  async inspectSaved() {
    if (!this.locked || this.inspecting) return;
    this.inspecting = true; this.savedChecks = []; this.notify();
    try {
      for (const id of this.targets) {
        const saved = await this.read(id);
        if (!this.active) return;
        this.savedChecks.push({ articleId: id, count: saved.composition.assets.length, status: saved.composition.status });
      }
      this.message = "저장본을 조회했습니다. 현재 상태가 같아도 이번 요청의 성공 증거는 아닙니다. 결과 불명·재실행 잠금을 유지합니다.";
    } catch { this.message = "저장본 조회에도 실패했습니다. 복사 실패나 롤백으로 단정할 수 없어 결과 불명·재실행 잠금을 유지합니다."; }
    finally { this.inspecting = false; this.notify(); }
  }
}
