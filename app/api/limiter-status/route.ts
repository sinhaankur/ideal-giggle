import { getLimiterMode, getRateLimitConfigSnapshot } from "@/lib/api/rate-limit-config"

function isAuthorized(req: Request) {
  const expectedToken = process.env.LIMITER_STATUS_TOKEN
  if (!expectedToken) return true

  const providedToken = req.headers.get("x-admin-token") || ""
  return providedToken.length > 0 && providedToken === expectedToken
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const snapshot = getRateLimitConfigSnapshot()

  return Response.json({
    ok: true,
    limiter: {
      mode: getLimiterMode(),
      policy: {
        windowMs: snapshot.windowMs,
        routes: {
          global: snapshot.globalLimit,
          chat: snapshot.chatLimit,
          mcpFallback: snapshot.fallbackLimit,
        },
      },
      distributedConfigured: snapshot.hasDistributedCredentials,
    },
    serverTime: new Date().toISOString(),
  })
}