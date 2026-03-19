import { NextRequest, NextResponse } from "next/server";

/**
 * Simple API authentication via Bearer token.
 * Set API_SECRET in .env.local to enable.
 * If API_SECRET is not set, authentication is skipped (dev mode).
 */
export function authenticateRequest(req: NextRequest): NextResponse | null {
  // 同源请求跳过认证（前端页面内部调用 API）
  if (isSameOriginRequest(req)) {
    return null;
  }

  const secret = process.env.API_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[AUTH] API_SECRET not configured in production — rejecting request");
      return NextResponse.json({ error: "服务器认证未配置" }, { status: 500 });
    }
    return null; // Dev mode: open access
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "未授权访问" }, { status: 401 });
  }

  return null; // Auth passed
}

/**
 * 判断是否为同源请求
 * 浏览器发起的同源 fetch 请求会带有 Sec-Fetch-Site: same-origin，
 * 或者 Origin/Referer 与当前 Host 匹配。
 */
function isSameOriginRequest(req: NextRequest): boolean {
  // Sec-Fetch-Site 是浏览器自动设置的、不可伪造的头
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") {
    return true;
  }

  // 回退：检查 Origin 或 Referer 是否与 Host 匹配
  const host = req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * 简单的内存速率限制器
 * 基于 IP 地址，滑动窗口计数
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分钟窗口
const RATE_LIMIT_MAX_REQUESTS: Record<string, number> = {
  generate: 5,      // 每分钟最多5次生成
  analyze: 10,      // 每分钟最多10次分析
  score: 20,        // 每分钟最多20次评分
  title: 10,        // 每分钟最多10次标题
  regenerate: 10,   // 每分钟最多10次重生成
  default: 30,      // 默认每分钟30次
};

// 每5分钟清理过期条目，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * 检查速率限制
 * @param req 请求对象
 * @param endpoint 端点名称（generate, analyze, score, title）
 * @returns 如果超限返回 429 响应，否则返回 null
 */
export function checkRateLimit(req: NextRequest, endpoint: string): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const maxRequests = RATE_LIMIT_MAX_REQUESTS[endpoint] || RATE_LIMIT_MAX_REQUESTS.default;

  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // 新窗口
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      { error: `请求过于频繁，请${retryAfter}秒后重试` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}
