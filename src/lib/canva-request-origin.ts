import "server-only";
import { CanvaConnectError, validateRedirect } from "@/lib/canva-connect-contract";

// Trust proxy headers only inside a Vercel deployment, never on a local/custom server.
export function canvaRequestOrigin(request: Request) {
  const direct = new URL(request.url).origin;
  if (process.env.VERCEL !== "1" || !["preview", "production"].includes(process.env.VERCEL_ENV || "")) return direct;

  const fail = () => { throw new CanvaConnectError(403, "요청 서버 주소를 확인해 주세요."); };
  const deploymentHost = process.env.VERCEL_URL;
  const validDeploymentHost = (host: string | undefined): host is string =>
    Boolean(host && /^[a-z0-9-]+\.vercel\.app$/.test(host));
  if (!validDeploymentHost(deploymentHost)) return fail();
  const allowed = new Set([deploymentHost]);
  if (validDeploymentHost(process.env.VERCEL_BRANCH_URL)) allowed.add(process.env.VERCEL_BRANCH_URL);
  const redirect = new URL(validateRedirect(process.env.CANVA_REDIRECT_URI || ""));
  if (redirect.protocol !== "https:") return fail();
  allowed.add(redirect.host);

  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto");
  // Vercel documents forwarded-host as identical to Host. Reject ambiguous chains,
  // conflicting hosts and ports instead of picking a client-controlled value.
  if (!host || !allowed.has(host) || (forwardedHost !== null && forwardedHost !== host) || proto !== "https") return fail();
  return `https://${host}`;
}

export function requireCanvaSameOrigin(request: Request) {
  if (request.headers.get("origin") !== canvaRequestOrigin(request)) throw new CanvaConnectError(403, "현재 관리자 화면에서 다시 요청해 주세요.");
}
