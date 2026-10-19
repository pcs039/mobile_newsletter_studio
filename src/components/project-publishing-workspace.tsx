"use client";
import { useState, type ComponentProps } from "react";
import { ProjectClientReviewWorkflow } from "@/components/project-client-review-workflow";
import { ProjectPublicationControls } from "@/components/project-publication-controls";

type Props = ComponentProps<typeof ProjectClientReviewWorkflow>;
export function ProjectPublishingWorkspace(props: Props) {
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  return <>
    <ProjectPublicationControls key={props.projectId} projectId={props.projectId} projectSlug={props.projectSlug} publicUrlAbsolute={props.publicUrlAbsolute} ebookUrl={props.ebookUrl} onBusyChange={setPublicationBusy} blocked={reviewBusy} />
    <details className="rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-bold">기관 검토 요청·응답 · 선택 사항</summary>
      <div className="mt-4"><ProjectClientReviewWorkflow {...props} hidePublicationPanel externalBusy={publicationBusy} onReviewBusyChange={setReviewBusy} /></div>
    </details>
  </>;
}
