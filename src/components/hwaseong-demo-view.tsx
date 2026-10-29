import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { DemoShareSession } from "@/components/demo-share-session";
import { HwaseongProposalReader } from "@/components/hwaseong-proposal-reader";
import type { getHwaseongDemoData } from "@/lib/hwaseong-demo-render";
export function HwaseongDemoView({result,confirmCookie=false}:{result:Awaited<ReturnType<typeof getHwaseongDemoData>>;confirmCookie?:boolean}) {
  return <DemoShareSession slug={result.props.slug} shareId={result.access.share.id} expiresAt={result.access.share.expires_at} confirmOnMount={confirmCookie}>
    <PublicFontFaceStyle fonts={result.props.fonts}/><HwaseongProposalReader {...result.props} detail={false} width={390}/>
  </DemoShareSession>;
}
