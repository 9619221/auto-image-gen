/**
 * Custom fetch wrapper for Gemini API compatibility.
 *
 * OpenAI SDK v6+ sends fields like "stream" in the JSON body,
 * which Gemini's OpenAI-compatible endpoint rejects with:
 *   "Unknown name "stream": Cannot find field."
 *
 * This wrapper intercepts POST requests with JSON bodies and
 * strips unsupported fields before forwarding to Gemini.
 */

const UNSUPPORTED_FIELDS = ["stream", "stream_options"];

export const geminiFetch: typeof fetch = async (input, init) => {
  if (init?.method === "POST" && init.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      let changed = false;
      for (const field of UNSUPPORTED_FIELDS) {
        if (field in body) {
          delete body[field];
          changed = true;
        }
      }
      if (changed) {
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {
      // Not JSON, pass through
    }
  }
  return fetch(input, init);
};
