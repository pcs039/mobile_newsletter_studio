import { NextResponse } from "next/server";
import {
  isArticleCompositionAssetTypeCompatible,
  isArticleCompositionSingleSlot,
  isArticleCompositionSlot,
  isArticleCompositionStatus,
  validateArticleCompositionPlacementSettings,
  type ArticleCompositionSlot,
} from "@/lib/article-composition";
import {
  createProjectArticleComposition,
  deleteProjectArticleCompositionPlacement,
  getProjectArticleComposition,
  saveProjectArticleCompositionPlacement,
  updateProjectArticleCompositionStatus,
  type ArticleCompositionRepositoryResult,
} from "@/lib/article-composition-repository";
import {
  getProjectContent,
  getProjectDesignAssets,
  type ProjectContentArticle,
  type ProjectDesignAsset,
  type ProjectDesignProductionAssetType,
} from "@/lib/newsletter-repository";
import { requireProjectApiAccess } from "@/lib/project-api-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const productionAssetTypes = new Set<ProjectDesignProductionAssetType>([
  "background",
  "illustration",
  "icon",
  "card_frame",
  "banner",
  "pattern",
  "decoration",
]);

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readSortOrder(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000 ? value : null;
}

function repositoryStatusCode(status: ArticleCompositionRepositoryResult<unknown>["status"]) {
  if (status === "not_configured" || status === "migration_required") return 503;
  if (status === "not_found") return 404;
  if (status === "invalid_input") return 400;
  if (status === "conflict") return 409;
  return 500;
}

function repositoryResponse(result: ArticleCompositionRepositoryResult<unknown>, successStatus = 200) {
  return NextResponse.json(
    { ok: result.status === "ok", composition: result.data, message: result.message },
    { status: result.status === "ok" ? successStatus : repositoryStatusCode(result.status) },
  );
}

function isProductionAsset(asset: ProjectDesignAsset): asset is ProjectDesignAsset & {
  assetType: ProjectDesignProductionAssetType;
} {
  return productionAssetTypes.has(asset.assetType as ProjectDesignProductionAssetType);
}

type EditorContext = {
  article: ProjectContentArticle;
  assets: ProjectDesignAsset[];
  composition: Awaited<ReturnType<typeof getProjectArticleComposition>>["data"];
  projectId: string;
  projectSlug: string;
};

async function requireEditorContext(projectInput: string, articleId: string): Promise<
  | { ok: true; context: EditorContext }
  | { ok: false; response: NextResponse }
> {
  if (!projectInput || !articleId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "프로젝트와 기사 정보를 확인해 주세요." }, { status: 400 }),
    };
  }

  const access = await requireProjectApiAccess({ projectSlug: projectInput });
  if (!access.ok) return access;

  const [content, designAssets, compositionResult] = await Promise.all([
    getProjectContent(access.project.slug),
    getProjectDesignAssets(access.project.slug),
    getProjectArticleComposition(access.project.id, articleId),
  ]);
  const article = content.articles.find((candidate) => candidate.id === articleId);

  if (!article) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "현재 프로젝트의 기사를 찾지 못했습니다." }, { status: 404 }),
    };
  }
  if (!designAssets.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: designAssets.message },
        { status: designAssets.source === "unconfigured" ? 503 : 500 },
      ),
    };
  }
  if (compositionResult.status !== "ok" && compositionResult.status !== "not_found") {
    return { ok: false, response: repositoryResponse(compositionResult) };
  }

  return {
    ok: true,
    context: {
      article,
      assets: designAssets.assets,
      composition: compositionResult.data,
      projectId: access.project.id,
      projectSlug: access.project.slug,
    },
  };
}

function findSelectableAsset(context: EditorContext, assetId: string, slot: ArticleCompositionSlot) {
  const asset = context.assets.find((candidate) => candidate.id === assetId);

  if (!asset || asset.projectId !== context.projectId || !isProductionAsset(asset)) {
    return { ok: false, message: "현재 프로젝트의 모바일 제작 자산을 찾지 못했습니다." } as const;
  }
  if (!asset.isActive || asset.approvalStatus === "archived") {
    return { ok: false, message: "보관되었거나 비활성화된 자산은 기사 구성에 사용할 수 없습니다." } as const;
  }
  if (!isArticleCompositionAssetTypeCompatible(slot, asset.assetType)) {
    return { ok: false, message: "선택한 자산은 이 기사 화면 위치에 사용할 수 없습니다." } as const;
  }

  return { ok: true, asset } as const;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectSlug = asText(searchParams.get("projectSlug")) || asText(searchParams.get("projectId"));
  const articleId = asText(searchParams.get("articleId"));
  const result = await requireEditorContext(projectSlug, articleId);

  if (!result.ok) return result.response;

  return NextResponse.json({
    ok: true,
    composition: result.context.composition,
    assets: result.context.assets.filter(
      (asset) => isProductionAsset(asset) && asset.isActive && asset.approvalStatus !== "archived",
    ),
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectSlug = asText(payload?.projectSlug) || asText(payload?.projectId);
  const articleId = asText(payload?.articleId);
  const action = asText(payload?.action);
  const result = await requireEditorContext(projectSlug, articleId);

  if (!result.ok) return result.response;
  const { context } = result;

  if (action === "create_composition") {
    return repositoryResponse(await createProjectArticleComposition(context.projectId, articleId), 201);
  }
  if (action !== "add_placement") {
    return NextResponse.json({ ok: false, message: "기사 화면 구성 작업을 확인해 주세요." }, { status: 400 });
  }
  if (!context.composition) {
    return NextResponse.json({ ok: false, message: "먼저 기사 화면 구성을 만들어 주세요." }, { status: 409 });
  }

  const compositionId = asText(payload?.compositionId);
  const assetId = asText(payload?.assetId);
  const slotValue = payload?.slot;

  if (compositionId !== context.composition.id) {
    return NextResponse.json({ ok: false, message: "현재 기사의 화면 구성을 확인해 주세요." }, { status: 400 });
  }
  if (!isArticleCompositionSlot(slotValue)) {
    return NextResponse.json({ ok: false, message: "기사 화면 구성 위치를 확인해 주세요." }, { status: 400 });
  }

  const assetResult = findSelectableAsset(context, assetId, slotValue);
  if (!assetResult.ok) return NextResponse.json({ ok: false, message: assetResult.message }, { status: 400 });

  const settingsResult = validateArticleCompositionPlacementSettings(payload?.settings ?? {});
  if (!settingsResult.ok) return NextResponse.json({ ok: false, message: settingsResult.message }, { status: 400 });

  const existingPlacement = isArticleCompositionSingleSlot(slotValue)
    ? context.composition.assets.find((placement) => placement.slot === slotValue)
    : null;
  const requestedSortOrder = readSortOrder(payload?.sortOrder);
  const sortOrder = isArticleCompositionSingleSlot(slotValue) ? 0 : requestedSortOrder;

  if (sortOrder === null) {
    return NextResponse.json({ ok: false, message: "본문 장식의 표시 순서를 확인해 주세요." }, { status: 400 });
  }

  return repositoryResponse(
    await saveProjectArticleCompositionPlacement({
      articleId,
      assetId: assetResult.asset.id,
      compositionId,
      isVisible: asBoolean(payload?.isVisible, true),
      placementId: existingPlacement?.id,
      projectId: context.projectId,
      settings: settingsResult.settings,
      slot: slotValue,
      sortOrder,
    }),
    existingPlacement ? 200 : 201,
  );
}

export async function PATCH(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectSlug = asText(payload?.projectSlug) || asText(payload?.projectId);
  const articleId = asText(payload?.articleId);
  const action = asText(payload?.action);
  const result = await requireEditorContext(projectSlug, articleId);

  if (!result.ok) return result.response;
  const { context } = result;

  if (!context.composition) {
    return NextResponse.json({ ok: false, message: "기사 화면 구성을 찾지 못했습니다." }, { status: 404 });
  }
  if (asText(payload?.compositionId) !== context.composition.id) {
    return NextResponse.json({ ok: false, message: "현재 기사의 화면 구성을 확인해 주세요." }, { status: 400 });
  }

  if (action === "update_status") {
    if (!isArticleCompositionStatus(payload?.status)) {
      return NextResponse.json({ ok: false, message: "기사 화면 구성 상태를 확인해 주세요." }, { status: 400 });
    }
    return repositoryResponse(
      await updateProjectArticleCompositionStatus(context.projectId, articleId, payload.status),
    );
  }
  if (action !== "update_placement") {
    return NextResponse.json({ ok: false, message: "기사 화면 구성 작업을 확인해 주세요." }, { status: 400 });
  }

  const placementId = asText(payload?.placementId);
  const placement = context.composition.assets.find((candidate) => candidate.id === placementId);
  if (!placement) {
    return NextResponse.json({ ok: false, message: "현재 기사에 배치된 자산을 찾지 못했습니다." }, { status: 404 });
  }

  const assetId = asText(payload?.assetId) || placement.assetId;
  const assetResult = findSelectableAsset(context, assetId, placement.slot);
  if (!assetResult.ok) return NextResponse.json({ ok: false, message: assetResult.message }, { status: 400 });

  const settingsResult = validateArticleCompositionPlacementSettings(payload?.settings ?? placement.settings);
  if (!settingsResult.ok) return NextResponse.json({ ok: false, message: settingsResult.message }, { status: 400 });

  const requestedSortOrder = readSortOrder(payload?.sortOrder ?? placement.sortOrder);
  const sortOrder = isArticleCompositionSingleSlot(placement.slot) ? 0 : requestedSortOrder;
  if (sortOrder === null) {
    return NextResponse.json({ ok: false, message: "본문 장식의 표시 순서를 확인해 주세요." }, { status: 400 });
  }

  return repositoryResponse(
    await saveProjectArticleCompositionPlacement({
      articleId,
      assetId: assetResult.asset.id,
      compositionId: context.composition.id,
      isVisible: asBoolean(payload?.isVisible, placement.isVisible),
      placementId,
      projectId: context.projectId,
      settings: settingsResult.settings,
      slot: placement.slot,
      sortOrder,
    }),
  );
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectSlug = asText(searchParams.get("projectSlug")) || asText(searchParams.get("projectId"));
  const articleId = asText(searchParams.get("articleId"));
  const compositionId = asText(searchParams.get("compositionId"));
  const placementId = asText(searchParams.get("placementId"));
  const result = await requireEditorContext(projectSlug, articleId);

  if (!result.ok) return result.response;
  const { context } = result;

  if (!context.composition || context.composition.id !== compositionId) {
    return NextResponse.json({ ok: false, message: "현재 기사의 화면 구성을 찾지 못했습니다." }, { status: 404 });
  }
  if (!context.composition.assets.some((placement) => placement.id === placementId)) {
    return NextResponse.json({ ok: false, message: "제거할 구성 자산을 찾지 못했습니다." }, { status: 404 });
  }

  return repositoryResponse(
    await deleteProjectArticleCompositionPlacement({
      articleId,
      compositionId,
      placementId,
      projectId: context.projectId,
    }),
  );
}
