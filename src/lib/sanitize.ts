/**
 * 输入净化工具 — 防止 LLM 提示词注入
 */

/**
 * 净化用户输入的文本，移除可能的提示词注入
 * - 移除控制字符
 * - 截断过长输入
 * - 转义可能改变 LLM 行为的模式
 */
export function sanitizeForPrompt(text: string, maxLength = 500): string {
  if (!text || typeof text !== "string") return "";

  return text
    // 移除控制字符
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // 移除常见注入模式
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)/gi, "")
    .replace(/system\s*:\s*/gi, "")
    .replace(/\buser\s*:\s*/gi, "")
    .replace(/\bassistant\s*:\s*/gi, "")
    .replace(/<\/?(?:system|user|assistant|instruction|prompt)[^>]*>/gi, "")
    // 截断
    .slice(0, maxLength)
    .trim();
}

/**
 * 净化字符串数组
 */
export function sanitizeArray(arr: string[], maxLength = 200): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => typeof item === "string")
    .map(item => sanitizeForPrompt(item, maxLength))
    .filter(item => item.length > 0);
}

/**
 * 验证 JSON 解析结果的基本形状
 */
export function validateShape<T>(
  data: unknown,
  requiredFields: string[],
  defaults: T
): T {
  if (!data || typeof data !== "object") return defaults;

  const obj = data as Record<string, unknown>;
  const result = { ...defaults } as Record<string, unknown>;

  for (const field of requiredFields) {
    if (field in obj && obj[field] !== undefined && obj[field] !== null) {
      result[field] = obj[field];
    }
  }

  return result as T;
}
