/**
 * Amazon 违禁词/敏感词过滤器
 *
 * 覆盖以下类型：
 * 1. 虚假排名声明 (Best Seller, #1, Top Rated)
 * 2. 虚假评价声明 (5-Star, Customer Favorite)
 * 3. 医疗/健康声明 (Healing, FDA, Doctor Recommended)
 * 4. 未经认证的环保声明 (Eco-Friendly, Green, Organic)
 * 5. 价格/促销用语 (Free, Cheap, Discount, Sale, Deal)
 * 6. 时效性用语 (New, Limited Time, Exclusive)
 * 7. 绝对化用语 (100%, Best, #1, Perfect, Guaranteed)
 * 8. 未经授权的认证声明 (FDA Approved, Certified, Award-Winning)
 * 9. 竞品贬低用语 (Ordinary, Cheap Alternative)
 */

interface ProhibitedEntry {
  pattern: RegExp;
  replacement: string;  // 安全替代词
  reason: string;       // 违禁原因
}

// 违禁词条目 — 按严重程度排列
const PROHIBITED_ENTRIES: ProhibitedEntry[] = [
  // === 虚假排名/评价声明 ===
  { pattern: /\bbest\s*seller\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\b#\s*1\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\bnumber\s*one\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\btop\s*rated\b/gi, replacement: "Well-Crafted", reason: "虚假评价声明" },
  { pattern: /\b5[\s-]*star\b/gi, replacement: "", reason: "虚假评价声明" },
  { pattern: /\bfour[\s-]*star\b/gi, replacement: "", reason: "虚假评价声明" },
  { pattern: /\bcustomer\s*favorite\b/gi, replacement: "", reason: "虚假评价声明" },
  { pattern: /\bmost\s*popular\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\bbest[\s-]*selling\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\baward[\s-]*winning\b/gi, replacement: "", reason: "未经授权的奖项声明" },
  { pattern: /\bhighly\s*rated\b/gi, replacement: "", reason: "虚假评价声明" },
  { pattern: /\btop\s*pick\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\b5[\s-]*star\s*pick\b/gi, replacement: "", reason: "虚假评价声明" },
  { pattern: /\bstar\s*pick\b/gi, replacement: "", reason: "虚假评价声明" },
  { pattern: /\btop\s*choice\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\bbest\s*choice\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\bbest\s*in\s*class\b/gi, replacement: "", reason: "虚假排名声明" },
  { pattern: /\bmarket\s*leader\b/gi, replacement: "", reason: "虚假排名声明" },

  // === 医疗/健康声明 ===
  { pattern: /\bhealing\b/gi, replacement: "Calming", reason: "医疗声明" },
  { pattern: /\bcures?\b/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\btreats?\s+(disease|illness|condition)/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\btherapeutic\b/gi, replacement: "Soothing", reason: "医疗声明" },
  { pattern: /\bmedicinal\b/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\bFDA\s*approved\b/gi, replacement: "", reason: "未经授权的认证" },
  { pattern: /\bdoctor\s*recommended\b/gi, replacement: "", reason: "未经授权的推荐" },
  { pattern: /\bclinically\s*proven\b/gi, replacement: "", reason: "未经证实的医疗声明" },
  { pattern: /\bmedically\s*tested\b/gi, replacement: "", reason: "未经证实的医疗声明" },
  { pattern: /\banti[\s-]*cancer\b/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\banti[\s-]*aging\b/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\bweight\s*loss\b/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\bdetox\b/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\bimmunit(y|ies)\b/gi, replacement: "", reason: "医疗声明" },
  { pattern: /\bchakra\b/gi, replacement: "", reason: "医疗/灵性声明" },

  // === 未经认证的环保声明 ===
  { pattern: /\beco[\s-]*friendly\b/gi, replacement: "Thoughtful Design", reason: "未经认证的环保声明" },
  { pattern: /\bgreen\s*product\b/gi, replacement: "", reason: "未经认证的环保声明" },
  { pattern: /\borganic\b/gi, replacement: "Natural", reason: "未经认证的有机声明" },
  { pattern: /\bsustainable\b/gi, replacement: "Durable", reason: "未经认证的环保声明" },
  { pattern: /\bbiodegradable\b/gi, replacement: "", reason: "未经认证的环保声明" },
  { pattern: /\bcarbon[\s-]*neutral\b/gi, replacement: "", reason: "未经认证的环保声明" },
  { pattern: /\bzero[\s-]*waste\b/gi, replacement: "", reason: "未经认证的环保声明" },

  // === 绝对化用语 ===
  { pattern: /\b100\s*%/gi, replacement: "Genuine", reason: "绝对化用语" },
  { pattern: /\bguaranteed\b/gi, replacement: "", reason: "未经授权的保证" },
  { pattern: /\bperfect\b/gi, replacement: "Great", reason: "绝对化用语" },
  { pattern: /\bflawless\b/gi, replacement: "Fine", reason: "绝对化用语" },
  { pattern: /\bunbreakable\b/gi, replacement: "Durable", reason: "绝对化用语" },
  { pattern: /\bindestructible\b/gi, replacement: "Durable", reason: "绝对化用语" },
  { pattern: /\bforever\b/gi, replacement: "Long-Lasting", reason: "绝对化用语" },
  { pattern: /\beveryone\s*loves\b/gi, replacement: "", reason: "绝对化用语" },
  { pattern: /\bworld[\s']*s?\s*best\b/gi, replacement: "", reason: "绝对化声明" },
  { pattern: /\bbest\s*ever\b/gi, replacement: "", reason: "绝对化声明" },

  // === 价格/促销用语 ===
  { pattern: /\bfree\s*shipping\b/gi, replacement: "", reason: "促销用语" },
  { pattern: /\bcheap(est)?\b/gi, replacement: "Affordable", reason: "贬价用语" },
  { pattern: /\bdiscount(ed)?\b/gi, replacement: "", reason: "促销用语" },
  { pattern: /\bon\s*sale\b/gi, replacement: "", reason: "促销用语" },
  { pattern: /\bbargain\b/gi, replacement: "", reason: "促销用语" },
  { pattern: /\bdeal\s*of\b/gi, replacement: "", reason: "促销用语" },
  { pattern: /\bbuy\s*one\s*get\b/gi, replacement: "", reason: "促销用语" },
  { pattern: /\bsave\s*\d+\s*%/gi, replacement: "", reason: "促销用语" },
  { pattern: /\blowest\s*price\b/gi, replacement: "", reason: "促销用语" },

  // === 时效性/排他性用语 ===
  { pattern: /\blimited\s*time\b/gi, replacement: "", reason: "时效性用语" },
  { pattern: /\blimited\s*edition\b/gi, replacement: "Special Design", reason: "时效性用语" },
  { pattern: /\bexclusive\s*offer\b/gi, replacement: "", reason: "时效性用语" },
  { pattern: /\bwhile\s*supplies\s*last\b/gi, replacement: "", reason: "时效性用语" },
  { pattern: /\bhurry\b/gi, replacement: "", reason: "紧迫性用语" },
  { pattern: /\bact\s*now\b/gi, replacement: "", reason: "紧迫性用语" },
  { pattern: /\border\s*now\b/gi, replacement: "", reason: "紧迫性用语" },
  { pattern: /\bbuy\s*now\b/gi, replacement: "", reason: "紧迫性用语" },
];

/**
 * 过滤文本中的违禁词，替换为安全用语
 * @param text 原始文本
 * @returns 过滤后的文本
 */
export function filterProhibitedWords(text: string): string {
  if (!text) return text;

  let result = text;
  for (const entry of PROHIBITED_ENTRIES) {
    result = result.replace(entry.pattern, entry.replacement);
  }

  // 清理多余空格和标点
  result = result
    .replace(/\s{2,}/g, " ")       // 连续空格 → 单空格
    .replace(/^\s+|\s+$/g, "")     // 首尾空格
    .replace(/,\s*,/g, ",")        // 连续逗号
    .replace(/\s*,\s*$/g, "")      // 末尾逗号
    .replace(/^\s*,\s*/g, "");     // 开头逗号

  return result;
}

/**
 * 检测文本中是否包含违禁词
 * @param text 待检测文本
 * @returns 检测到的违禁词列表
 */
export function detectProhibitedWords(text: string): { word: string; reason: string }[] {
  if (!text) return [];

  const found: { word: string; reason: string }[] = [];
  for (const entry of PROHIBITED_ENTRIES) {
    const matches = text.match(entry.pattern);
    if (matches) {
      for (const match of matches) {
        found.push({ word: match, reason: entry.reason });
      }
    }
  }
  return found;
}

/**
 * 批量过滤标题数组
 */
export function filterTitles(titles: string[]): string[] {
  return titles.map(t => filterProhibitedWords(t)).filter(t => t.length > 0);
}
