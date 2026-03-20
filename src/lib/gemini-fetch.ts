/**
 * Custom fetch wrapper for Gemini API compatibility.
 *
 * 1. Strips unsupported fields ("stream", "stream_options") from JSON body
 * 2. Auto-retries on 429 errors (proxy rate limiting) with exponential backoff
 */

const UNSUPPORTED_FIELDS = ["stream", "stream_options"];

function stripFields(bodyStr: string): string | null {
  try {
    const body = JSON.parse(bodyStr);
    let changed = false;
    for (const field of UNSUPPORTED_FIELDS) {
      if (field in body) {
        delete body[field];
        changed = true;
      }
    }
    return changed ? JSON.stringify(body) : null;
  } catch {
    return null;
  }
}

export const geminiFetch: typeof fetch = async (input, init) => {
  // Strip unsupported fields from POST JSON body
  if (init?.method === "POST" && init.body && typeof init.body === "string") {
    const cleaned = stripFields(init.body);
    if (cleaned !== null) {
      init = { ...init, body: cleaned };
    }
  }

  // Auto-retry on 429 errors (proxy rate limit / "stream" field errors)
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(input, init);

    if (response.status !== 429 || attempt === MAX_RETRIES - 1) {
      return response; // 成功、非429错误、或最后一次重试 — 直接返回
    }

    // 429 error — clone body for logging, then retry
    const errorText = await response.clone().text().catch(() => "");
    console.error(`[geminiFetch] 429 error (attempt ${attempt + 1}/${MAX_RETRIES}): ${errorText.slice(0, 200)}`);

    const delay = 3000 * (attempt + 1); // 3s, 6s
    await new Promise(r => setTimeout(r, delay));
  }

  // Should not reach here, but just in case
  return fetch(input, init);
};
