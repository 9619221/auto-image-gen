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
    // 移除常见注入模式（英文）
    .replace(/ignore\s+(all\s+)?(previous|above|prior|earlier|last|original)\s+(instructions?|rules?|prompts?|context)/gi, "")
    .replace(/forget\s+(all\s+)?(previous|above|prior|earlier)?\s*(instructions?|rules?|prompts?|context)?/gi, "")
    .replace(/(override|disregard|bypass)\s+(all\s+)?(previous|above|prior|earlier)?\s*(instructions?|rules?|prompts?|restrictions?|safety)/gi, "")
    .replace(/\b(pretend|imagine|roleplay|act)\s+(you\s+are|as\s+(if|a|an)|to\s+be)/gi, "")
    .replace(/system\s*:\s*/gi, "")
    .replace(/\buser\s*:\s*/gi, "")
    .replace(/\bassistant\s*:\s*/gi, "")
    .replace(/<\/?(?:system|user|assistant|instruction|prompt|context)[^>]*>/gi, "")
    // 移除常见注入模式（中文）
    .replace(/忽略(之前|以上|所有|先前)的?(指令|规则|提示|要求)/g, "")
    .replace(/(无视|跳过|绕过)(之前|以上|所有|先前)的?(指令|规则|提示|要求|限制|安全)/g, "")
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
 * 从 LLM 响应中安全提取 JSON 对象
 * - 使用非贪婪匹配避免跨 JSON 块误匹配
 * - 内置 try-catch 防止 parse 异常
 * - 支持 defaults 参数作为 fallback
 */
export function extractJSON<T = Record<string, unknown>>(
  text: string,
  defaults?: T
): T | null {
  if (!text) return defaults ?? null;

  // 尝试匹配最外层 JSON 对象: 找到第一个 { 然后匹配到对应的 }
  // 使用平衡括号计数而非贪婪正则
  const startIdx = text.indexOf("{");
  if (startIdx === -1) return defaults ?? null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(startIdx, i + 1)) as T;
        } catch {
          return defaults ?? null;
        }
      }
    }
  }

  return defaults ?? null;
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
