import { NextResponse } from "next/server";
import {
  createProjectRecipientGroup,
  createProjectSendCampaign,
  type CreateProjectSendCampaignInput,
} from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

const channels = new Set(["kakao", "sms", "email", "qr", "manual"]);
const statuses = new Set(["draft", "ready", "sent", "failed"]);

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : 0;

  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : status === "invalid_input"
        ? 400
        : httpStatus ?? 500;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "배포 운영 저장 요청 데이터를 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const action = asText(payload.action);
  const projectSlug = asText(payload.projectSlug);

  if (action === "createGroup") {
    const result = await createProjectRecipientGroup({
      projectSlug,
      name: asText(payload.name),
      description: asText(payload.description),
      recipientCount: asNonNegativeNumber(payload.recipientCount),
      channelNote: asText(payload.channelNote),
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
    }

    return NextResponse.json(result, { status: 201 });
  }

  if (action === "createCampaign") {
    const channel = asText(payload.channel);
    const status = asText(payload.status);

    if (!channels.has(channel) || !statuses.has(status)) {
      return NextResponse.json(
        { ok: false, message: "발송 채널 또는 발송 상태 값을 확인해야 합니다." },
        { status: 400 },
      );
    }

    const result = await createProjectSendCampaign({
      projectSlug,
      channel: channel as CreateProjectSendCampaignInput["channel"],
      targetGroupId: asText(payload.targetGroupId),
      targetGroupName: asText(payload.targetGroupName),
      messageTitle: asText(payload.messageTitle),
      publicUrl: asText(payload.publicUrl),
      status: status as CreateProjectSendCampaignInput["status"],
      sentAt: asText(payload.sentAt),
      note: asText(payload.note),
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
    }

    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.json({ ok: false, message: "지원하지 않는 배포 운영 작업입니다." }, { status: 400 });
}
