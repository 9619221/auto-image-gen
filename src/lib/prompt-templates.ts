import type { AnalysisResult, ImageType, ImagePlan, SalesRegion } from "./types";
import { IMAGE_TYPE_LABELS, REGION_CONFIGS, regionToLanguage, LANGUAGE_ENGLISH_NAMES } from "./types";
import { filterProhibitedWords } from "./prohibited-words";
import { sanitizeForPrompt, sanitizeArray } from "./sanitize";

// ===== Text Utilities =====

function toEnglish(text: string): string {
  const match = text.match(/\(([^)]+)\)\s*$/);
  if (match) return match[1].trim();
  const match2 = text.match(/（([^）]+)）\s*$/);
  if (match2) return match2[1].trim();
  if (!/[\u4e00-\u9fff]/.test(text)) return text;
  return text;
}

function toEnglishArray(arr: string[]): string[] {
  return arr.map(toEnglish);
}

/** Truncate to N words, max M chars, title-cased. Never ends on a dangling word. */
function compactLabel(text: string, maxWords = 3, maxChars = 20): string {
  // Strip filler / connectors that make no sense as trailing words
  const danglingWords = new Set(["and", "or", "the", "a", "an", "with", "for", "to", "in", "on", "of", "by", "is", "are", "its", "no", "not", "your", "our", "my"]);

  const words = text
    .replace(/["""（）(),:;.\-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords + 2); // grab extra words so we can skip danglers

  let result = "";
  let wordCount = 0;
  for (const word of words) {
    if (wordCount >= maxWords) break;
    const next = result ? `${result} ${word}` : word;
    if (next.length > maxChars) break;
    result = next;
    wordCount++;
  }

  // Trim trailing dangling words
  let parts = result.split(/\s+/);
  while (parts.length > 1 && danglingWords.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  result = parts.join(" ");

  if (!result && words[0]) result = words[0].slice(0, maxChars);
  return titleCase(result);
}

function titleCase(text: string): string {
  const skip = new Set(["a", "an", "the", "and", "or", "for", "in", "on", "of", "to", "with"]);
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i === 0 || !skip.has(word)) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(" ");
}

function uniqueLabels(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    if (seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    result.push(cleaned);
  }
  return result;
}

function pickRandom<T>(arr: T[]): T {
  if (!arr || arr.length === 0) return "" as unknown as T;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== Feature → Benefit Mapping =====

interface BenefitMatch {
  pattern: RegExp;
  painPoint: string;    // Problem the customer has
  benefit: string;      // How the product solves it
  badge: string;        // Short badge label
}

const BENEFIT_MAP: BenefitMatch[] = [
  // === Jewelry / Gemstone / Accessories ===
  { pattern: /natural.?stone|genuine.?stone|real.?stone|天然石/i,
    painPoint: "Is It Real?", benefit: "Genuine Natural Stone", badge: "Natural" },
  { pattern: /kyanite|蓝晶石/i,
    painPoint: "Unique Crystal Energy", benefit: "Genuine Kyanite", badge: "Kyanite" },
  { pattern: /agate|玛瑙/i,
    painPoint: "Timeless Stone Beauty", benefit: "Genuine Agate", badge: "Agate" },
  { pattern: /crystal|水晶|quartz|石英/i,
    painPoint: "Crystal Clear Quality", benefit: "Genuine Crystal", badge: "Crystal" },
  { pattern: /jade|翡翠|玉/i,
    painPoint: "Authentic Jade", benefit: "Genuine Jade", badge: "Jade" },
  { pattern: /chatoyancy|cat.?eye|猫眼/i,
    painPoint: "Mesmerizing Glow", benefit: "Unique Cat-Eye Effect", badge: "Cat-Eye" },
  { pattern: /hand.?made|handcraft|手工|artisan/i,
    painPoint: "Crafted With Care", benefit: "Handcrafted Quality", badge: "Handmade" },
  { pattern: /(?:heal|chakra|spiritual|meditation|瑜伽|冥想)(?!.*(?:nail|polish|lipstick|mascara|makeup|cosmetic|甲油|口红))/i,
    painPoint: "Find Your Balance", benefit: "Calming Energy", badge: "Calming" },
  { pattern: /elastic|stretch|弹力|松紧/i,
    painPoint: "One Size Fits All", benefit: "Stretchy Elastic Band", badge: "Adjustable" },
  { pattern: /bead|珠|round/i,
    painPoint: "Smooth Bead Finish", benefit: "Polished Round Beads", badge: "Polished" },
  { pattern: /wrap|multi.?layer|多层|multi.?circle/i,
    painPoint: "Layer Up Your Look", benefit: "Multi-Wrap Design", badge: "Multi-Wrap" },
  { pattern: /unisex|男女|for.?men|for.?women/i,
    painPoint: "For Him & Her", benefit: "Unisex Style", badge: "Unisex" },

  // === Beauty / Cosmetics / Nail / Skincare ===
  { pattern: /nail.?hardener|hardener.?nail|nail.?strengthen|强化甲|硬甲/i,
    painPoint: "Weak, Brittle Nails?", benefit: "Nail-Strengthening Formula", badge: "Nail Armor" },
  { pattern: /color.?strong|strong.?color|显色/i,
    painPoint: "Color That Pops", benefit: "Vivid Color Payoff", badge: "Vivid Color" },
  { pattern: /nail.?polish|nail.?lacquer|甲油|指甲油/i,
    painPoint: "Tired of Dull, Streaky Polish?", benefit: "Rich Pigment Formula", badge: "True Color" },
  { pattern: /quick.?dry|fast.?dry|速干/i,
    painPoint: "Dry in 60 Seconds Flat", benefit: "Instant Dry Technology", badge: "Quick Dry" },
  { pattern: /chip.?resist|long.?lasting|持久|不掉色/i,
    painPoint: "Still Flawless on Day 7", benefit: "Chip-Proof Shield", badge: "7-Day Wear" },
  { pattern: /gel|凝胶/i,
    painPoint: "Gel Look, No UV Lamp Needed", benefit: "Mirror-Finish Gloss", badge: "Gel Finish" },
  { pattern: /matte|哑光/i,
    painPoint: "Velvet Smooth, Zero Streaks", benefit: "Self-Leveling Matte", badge: "Matte" },
  { pattern: /glitter|shimmer|metallic|闪|金属光泽/i,
    painPoint: "Sparkle That Turns Heads", benefit: "Multi-Dimensional Shimmer", badge: "Shimmer" },
  { pattern: /lipstick|lip.?gloss|口红|唇膏|唇彩/i,
    painPoint: "Fading Lip Color?", benefit: "All-Day Color Lock", badge: "Long Wear" },
  { pattern: /mascara|睫毛膏/i,
    painPoint: "Flat, Thin Lashes?", benefit: "Instant Volume Lift", badge: "Volumizing" },
  { pattern: /foundation|粉底/i,
    painPoint: "Cakey Foundation?", benefit: "Skin-Like Finish", badge: "Breathable" },
  { pattern: /eyeshadow|eye.?shadow|眼影/i,
    painPoint: "Patchy, Fading Eyeshadow?", benefit: "One-Swipe Pigment", badge: "Pigmented" },
  { pattern: /skincare|serum|moisturiz|cream|lotion|护肤|精华|面霜/i,
    painPoint: "Dry, Tired Skin?", benefit: "Deep Hydration Boost", badge: "Hydrating" },
  { pattern: /sunscreen|spf|防晒/i,
    painPoint: "Greasy Sunscreen?", benefit: "Weightless UV Shield", badge: "UV Shield" },
  { pattern: /makeup|cosmetic|beauty|化妆|美妆/i,
    painPoint: "Makeup That Works as Hard as You", benefit: "Pro-Level Results", badge: "Pro Finish" },
  { pattern: /brush|applicator|刷子|化妆刷/i,
    painPoint: "Streaky Application?", benefit: "Smooth Every Stroke", badge: "Soft Touch" },

  // === Home Décor / Flowers / Plants ===
  { pattern: /artificial|faux|fake|silk.?flower|仿真|假花|绢花/i,
    painPoint: "Always in Bloom", benefit: "Lifelike Faux Flowers", badge: "Lifelike" },
  { pattern: /baby.?breath|gypsophila|满天星/i,
    painPoint: "Delicate Floral Touch", benefit: "Realistic Baby's Breath", badge: "Realistic" },
  { pattern: /bouquet|花束/i,
    painPoint: "Instant Elegance", benefit: "Ready-Made Bouquet", badge: "Bouquet" },
  { pattern: /vase|花瓶/i,
    painPoint: "Perfect Centerpiece", benefit: "Elegant Vase Design", badge: "Elegant" },
  { pattern: /wreath|花环/i,
    painPoint: "Warm Welcome", benefit: "Decorative Wreath", badge: "Decor" },
  { pattern: /candle|蜡烛|香薰/i,
    painPoint: "Set the Mood", benefit: "Warm Ambient Glow", badge: "Ambient" },
  { pattern: /frame|picture|photo.?frame|相框/i,
    painPoint: "Showcase Your Memories", benefit: "Classic Frame Design", badge: "Display" },
  { pattern: /pillow|cushion|抱枕|靠垫/i,
    painPoint: "Cozy Comfort", benefit: "Soft & Plush", badge: "Plush" },
  { pattern: /curtain|窗帘/i,
    painPoint: "Light & Privacy Control", benefit: "Quality Fabric Drapes", badge: "Elegant" },

  // === Cleaning / disposable ===
  { pattern: /dispos|one.?time|throw.?away|no.?clean|no.?wash|skip.?clean/i,
    painPoint: "Hate Doing Dishes?", benefit: "Zero Cleanup", badge: "Use & Toss" },
  { pattern: /easy.?clean|wipe|rinse|dishwasher|no.?scrub/i,
    painPoint: "No More Scrubbing", benefit: "Effortless Cleanup", badge: "Easy Clean" },
  // Heat / cooking
  { pattern: /heat.?resist|oven.?safe|high.?temp|withstand.?heat|fireproof/i,
    painPoint: "Oven-Safe, Worry-Free", benefit: "Handles Any Heat", badge: "Oven-Safe" },
  { pattern: /even.?heat|heat.?distribut|uniform.?heat|consistent.?cook/i,
    painPoint: "Perfect Results Every Time", benefit: "Even Heat Distribution", badge: "Even Cooking" },
  // Durability / strength
  { pattern: /sturd|durable|strong|heavy.?duty|thick|reinforc|rigid|load.?bear/i,
    painPoint: "Built Tough, Won't Bend", benefit: "Extra Strong Build", badge: "Extra Sturdy" },
  { pattern: /leak.?proof|sealed|spill.?proof|no.?leak|water.?tight/i,
    painPoint: "No Spills, No Mess", benefit: "Leak-Proof Design", badge: "Leak-Proof" },
  // Lightweight / portable
  { pattern: /lightweight|light.?weight|portable|easy.?carry|travel.?friendly/i,
    painPoint: "Easy to Carry", benefit: "Light but Strong", badge: "Lightweight" },
  // Size / capacity
  { pattern: /large.?capac|big.?size|spacious|roomy|generous.?size|family.?size/i,
    painPoint: "Feeds the Whole Family", benefit: "Extra Large Capacity", badge: "Family Size" },
  // Multi-pack / value
  { pattern: /multi.?pack|value.?pack|bulk|(\d+).?pack|(\d+).?count|(\d+).?piece/i,
    painPoint: "Stock Up & Save", benefit: "Great Value Pack", badge: "Bulk Value" },
  // Versatile / multi-use
  { pattern: /versatil|multi.?use|multi.?purpose|many.?use|all.?purpose/i,
    painPoint: "One for Everything", benefit: "Endless Possibilities", badge: "Multi-Use" },
  // Food safety
  { pattern: /food.?safe|food.?grade|bpa.?free|non.?toxic|safe.?material/i,
    painPoint: "Food-Grade Safe", benefit: "Safe for Your Family", badge: "Food-Safe" },
  // Non-stick
  { pattern: /non.?stick|easy.?release|no.?stick|food.?release/i,
    painPoint: "Food Slides Right Off", benefit: "Non-Stick Surface", badge: "Non-Stick" },
  // Eco-friendly
  { pattern: /eco.?friend|recyclable|sustain|green|biodegradable|compostable/i,
    painPoint: "Better for the Planet", benefit: "Thoughtful Design", badge: "Earth-Wise" },
  // Layered / stackable (jewelry first — matches before generic stackable)
  { pattern: /layer|stack.?bracelet|multi.?strand|wrap.?around|叠戴|stackab.*(?:bracelet|ring|necklace|jewel|bead)/i,
    painPoint: "Layer Up Your Look", benefit: "Layered Design", badge: "Layered" },
  // Stackable / storage (non-jewelry)
  { pattern: /stackab|nest|compact.?stor|space.?sav|flat.?pack/i,
    painPoint: "Saves Cabinet Space", benefit: "Stackable Design", badge: "Stackable" },
  // Premium / quality
  { pattern: /premium|high.?quality|profession|commercial.?grade/i,
    painPoint: "Premium Quality Inside", benefit: "Premium Grade", badge: "Premium" },
  // With lid / cover
  { pattern: /with.?lid|lid.?includ|cover|seal.?tight/i,
    painPoint: "Keep Food Fresh", benefit: "Lid Included", badge: "With Lid" },
  // Aluminum specific
  { pattern: /aluminum|aluminium|foil/i,
    painPoint: "Cook, Serve & Toss", benefit: "Premium Aluminum", badge: "Aluminum" },
  // Waterproof / water resistant
  { pattern: /waterproof|water.?resist|moisture|splash.?proof/i,
    painPoint: "Rain or Shine Ready", benefit: "Waterproof Protection", badge: "Waterproof" },
  // Anti-slip / grip
  { pattern: /anti.?slip|non.?slip|grip|rubber.?feet|no.?skid/i,
    painPoint: "Stays in Place", benefit: "Anti-Slip Grip", badge: "Non-Slip" },
  // Electronics / Hardware / Connectors
  { pattern: /connector|plug|socket|terminal|接头|连接器|插头|插座|端子/i,
    painPoint: "Reliable Connection", benefit: "Secure Fit Every Time", badge: "Secure Fit" },
  { pattern: /easy.?install|plug.?and.?play|plug.?n.?play|snap.?fit|quick.?connect|tool.?free/i,
    painPoint: "Quick & Easy Install", benefit: "Plug & Play Setup", badge: "Easy Install" },
  { pattern: /\bawg\b|\bgauge\b|\bamp\b|\bvolt\b|\bwatt\b|current.?capacity|\brated\s+(?:voltage|current|power|amperage)/i,
    painPoint: "Right Spec for the Job", benefit: "Proper Rating", badge: "Rated" },
  // Gift / gifting
  { pattern: /gift|present|occasion|birthday|holiday|christmas/i,
    painPoint: "Perfect Gift Idea", benefit: "Gift-Ready", badge: "Great Gift" },
  // Set / complete
  { pattern: /complete.?set|everything.?you.?need|all.?in.?one|full.?kit/i,
    painPoint: "Everything You Need", benefit: "Complete Set", badge: "Full Set" },
];

/** Map a badge to its OPPOSITE for comparison images (right/generic side) */
function badgeToOpposite(badge: string): string {
  const map: Record<string, string> = {
    // Durability / Strength
    "Extra Sturdy": "Flimsy Build",
    "Durable": "Breaks Easily",
    "Premium": "Low-Grade Build",
    "Polished": "Rough Finish",
    // Speed / Drying
    "Quick Dry": "Slow Dry Time",
    "Gel Finish": "Dull Finish",
    // Longevity
    "7-Day Wear": "Chips in Days",
    "Long Wear": "Fades Fast",
    // Color / Appearance
    "True Color": "Dull Color",
    "Vivid Color": "Washed Out",
    "Shimmer": "Flat & Dull",
    "Matte": "Uneven Finish",
    "Pigmented": "Patchy Coverage",
    "Smooth": "Streaky Finish",
    // Beauty
    "Volumizing": "Flat & Thin",
    "Breathable": "Feels Heavy",
    "Hydrating": "Dries Out Skin",
    "UV Shield": "No Protection",
    "Pro Finish": "Amateur Look",
    "Soft Touch": "Rough & Stiff",
    // Food / Kitchen
    "Food-Safe": "Unknown Safety",
    "Non-Stick": "Food Sticks On",
    "Easy Clean": "Hard to Clean",
    "Oven-Safe": "Not Heat Safe",
    "Even Cooking": "Uneven Heat",
    "Family Size": "Too Small",
    // General
    "Leak-Proof": "Leaks & Spills",
    "Lightweight": "Heavy & Bulky",
    "Stackable": "Wastes Space",
    "Multi-Use": "Single Use Only",
    "Bulk Value": "Pricey Singles",
    "Waterproof": "Gets Damaged",
    "Non-Slip": "Slides Around",
    "Great Gift": "Plain Packaging",
    "Full Set": "Pieces Missing",
    "Adjustable": "One Size Only",
    "Unisex": "Limited Styles",
    "Handmade": "Mass-Produced",
    "Natural": "Synthetic",
    "Versatile": "Limited Use",
    "Gift Idea": "Needs Wrapping",
    // Home Décor
    "Lifelike": "Looks Fake",
    "Realistic": "Looks Plastic",
    "Bouquet": "Sparse Stems",
    "Elegant": "Cheap Looking",
    "Decor": "Plain Design",
    "Ambient": "No Ambiance",
    "Display": "Flimsy Frame",
    "Plush": "Flat & Thin",
    // Nail / Beauty specific
    "Nail Armor": "Weak & Brittle",
    // Jewelry
    "Calming": "No Character",
    "Cat-Eye": "Plain Stone",
    "Multi-Wrap": "Basic Band",
    "Layered": "Single Strand",
    // Electronics / Hardware
    "Easy Install": "Complicated Setup",
    "Secure Fit": "Loose Connection",
    "Easy Setup": "Confusing Setup",
    "Rated": "Unknown Spec",
    "Pro Grade": "Amateur Quality",
    "Aluminum": "Thin Plastic",
    "Earth-Wise": "Wasteful",
    "With Lid": "No Cover",
    // Pet
    "Pet-Safe": "Unknown Safety",
    "Washable": "Hard to Clean",
  };
  return map[badge] || "Basic Quality";
}

/** Match selling point text to a benefit entry */
function matchBenefit(text: string): BenefitMatch | null {
  const lower = text.toLowerCase();
  for (const entry of BENEFIT_MAP) {
    if (entry.pattern.test(lower)) return entry;
  }
  return null;
}

// ===== Strategy Engine =====

/**
 * 判断是否为小型产品（最长边 < 15cm）
 * 通过尺寸文字解析 + 类目关键词辅助判断
 */
function detectSmallProduct(dimensions: string, category: string, productName: string): boolean {
  // 类目关键词直接判定为小产品（覆盖全品类常见小件）
  const ctx = `${category} ${productName}`.toLowerCase();
  if (/nail.?polish|lipstick|mascara|eyeshadow|perfume|serum|lip.?gloss|concealer|eyeliner|blush|compact|甲油|口红|睫毛膏|眼影|香水|精华|唇彩|遮瑕|眼线|腮红/.test(ctx)) return true; // 美妆
  if (/earring|ring|pendant|charm|necklace|bracelet|brooch|pin|badge|cufflink|耳环|戒指|吊坠|项链|手链|胸针|徽章|袖扣/.test(ctx)) return true; // 首饰
  if (/keychain|key.?ring|lighter|usb|flash.?drive|sd.?card|memory.?card|钥匙扣|打火机|U盘|SD卡/.test(ctx)) return true; // 小配件
  if (/pill.?box|vitamin|capsule|tablet|药盒|维生素|胶囊/.test(ctx)) return true; // 健康小件
  if (/button|buckle|zipper|sewing|thimble|needle|纽扣|扣子|拉链|缝纫|顶针|针/.test(ctx)) return true; // 缝纫配件
  if (/coin|dice|chess.?piece|figurine|miniature|硬币|骰子|棋子|手办|微缩/.test(ctx)) return true; // 收藏小件
  if (/eraser|sharpener|clip|paper.?clip|staple|橡皮|卷笔刀|回形针|订书钉/.test(ctx)) return true; // 文具小件
  if (/hook|knob|handle|screw|bolt|nut|挂钩|旋钮|把手|螺丝|螺母/.test(ctx)) return true; // 五金小件

  // 解析尺寸数字（支持 cm 和 in）
  if (!dimensions) return false;
  const cmNumbers: number[] = [];

  // 匹配 "30 x 20 x 15 cm" 格式
  const cmMatch = dimensions.match(/([\d.]+)\s*[x×]\s*([\d.]+)(?:\s*[x×]\s*([\d.]+))?\s*cm/i);
  if (cmMatch) {
    cmNumbers.push(parseFloat(cmMatch[1]), parseFloat(cmMatch[2]));
    if (cmMatch[3]) cmNumbers.push(parseFloat(cmMatch[3]));
  }

  // 匹配 inch 格式并转换
  const inMatch = dimensions.match(/([\d.]+)\s*[x×]\s*([\d.]+)(?:\s*[x×]\s*([\d.]+))?\s*in/i);
  if (inMatch && cmNumbers.length === 0) {
    cmNumbers.push(parseFloat(inMatch[1]) * 2.54, parseFloat(inMatch[2]) * 2.54);
    if (inMatch[3]) cmNumbers.push(parseFloat(inMatch[3]) * 2.54);
  }

  if (cmNumbers.length === 0) return false;
  const maxDim = Math.max(...cmNumbers);
  return maxDim < 15; // 最长边小于15cm视为小产品
}

function inferProductStrategy(analysis: AnalysisResult) {
  const productName = toEnglish(analysis.productName);
  const category = toEnglish(analysis.category || "");
  const sellingPoints = toEnglishArray(analysis.sellingPoints || []);
  const usageScenes = toEnglishArray(analysis.usageScenes || []);
  const targetAudience = toEnglishArray(analysis.targetAudience || []);
  const materials = toEnglish(analysis.materials || "");

  // Detect if this is a beauty/cosmetics product — to filter out inappropriate badges
  const isBeautyProduct = /nail.?polish|nail.?lacquer|nail.?hardener|hardener.?nail|lipstick|mascara|makeup|cosmetic|beauty|eyeshadow|foundation|skincare|甲油|指甲油|口红|化妆|美妆|护肤/.test(
    `${category} ${productName}`.toLowerCase()
  );

  // Detect if this is an electronics/hardware/tools product (broad matching)
  const isHardwareProduct = /connector|cable|wire(?!less)|adapter|plug|socket|terminal|switch|circuit|pcb|led\b|resistor|capacitor|sensor|module|arduino|raspberry|solder|motor|relay|fuse|crimp|splice|harness|gauge|amp\b|volt|watt|helping.?hand|third.?hand|magnif|clamp|vise|vice|workbench|work.?station|plier|wrench|screwdriver|drill|ratchet|repair.?tool|craft.?tool|hobby.?tool|heat.?gun|multimeter|oscilloscope|computer|pc\b|cpu|gpu|fan\b|power.?supply|psu|motherboard|component|extension.?cable|splitter|pin\b.*(?:cable|wire|connector)|接头|连接器|插头|插座|电缆|电线|开关|电路|焊|端子|排线|转接|钳|扳手|螺丝刀|工具|万用表|放大镜|电脑|风扇|电源|主板/.test(
    `${category} ${productName}`.toLowerCase()
  );

  // Badges that should NOT appear on beauty products
  // Includes: spiritual/gemstone, construction/durability (sounds like hardware, not beauty)
  const beautyBannedBadges = new Set([
    "Calming", "Natural", "Kyanite", "Agate", "Crystal", "Jade", "Cat-Eye",
    "Extra Sturdy", "Durable", "Non-Slip", "Stackable", "Leak-Proof",
    "Oven-Safe", "Food-Safe", "Family Size", "Waterproof", "With Lid",
    "Aluminum", "Full Set", "Multi-Use", "Bulk Value", "Premium",
    "Lightweight", "Great Gift", "Gift Idea", "Gift-Ready",
  ]);

  // Badges that should NOT appear on electronics/hardware products
  const hardwareBannedBadges = new Set([
    // Jewelry / Gemstone
    "Natural", "Kyanite", "Agate", "Crystal", "Jade", "Cat-Eye",
    "Calming", "Handmade", "Polished", "Multi-Wrap", "Unisex", "Layered",
    "Versatile",
    // Home Décor / Floral
    "Lifelike", "Realistic", "Bouquet", "Elegant", "Decor", "Ambient", "Plush",
    // Gift (NOT appropriate for hardware/electronics)
    "Great Gift", "Gift Idea", "Gift-Ready",
    // Beauty / Cosmetics
    "Shimmer", "Vivid Color", "True Color", "Matte",
    "Volumizing", "Breathable", "Hydrating", "UV Shield",
    "Pro Finish", "Soft Touch", "Quick Dry", "7-Day Wear",
    "Gel Finish", "Long Wear", "Pigmented", "Nail Armor",
    // Kitchen / Food
    "Food-Safe", "Non-Stick", "Oven-Safe", "Even Cooking",
    // Pet
    "Pet-Safe",
    // Too generic — prefer hardware-specific badges
    "Stackable", "Leak-Proof", "With Lid", "Family Size",
  ]);

  // Match each selling point to a benefit
  const matched: BenefitMatch[] = [];
  const usedPatterns = new Set<string>();
  for (const sp of sellingPoints) {
    const m = matchBenefit(sp);
    if (m && !usedPatterns.has(m.painPoint)) {
      // Skip inappropriate badges for specific product categories
      if (isBeautyProduct && beautyBannedBadges.has(m.badge)) continue;
      if (isHardwareProduct && hardwareBannedBadges.has(m.badge)) continue;
      matched.push(m);
      usedPatterns.add(m.painPoint);
    }
  }
  // Also check materials for extra matches
  const matMatch = matchBenefit(materials);
  if (matMatch && !usedPatterns.has(matMatch.painPoint)) {
    if (!(isBeautyProduct && beautyBannedBadges.has(matMatch.badge))
      && !(isHardwareProduct && hardwareBannedBadges.has(matMatch.badge))) {
      matched.push(matMatch);
    }
  }

  // Category-aware fallback benefits (NO fake claims like "Best Seller" or "5-Star Pick")
  const catFallbacks = getCategoryFallbacks(category, productName, materials);
  while (matched.length < 3) {
    const fb = catFallbacks[matched.length] || catFallbacks[0];
    // Avoid duplicating existing badges
    if (!usedPatterns.has(fb.painPoint)) {
      matched.push(fb);
      usedPatterns.add(fb.painPoint);
    } else {
      // Try next fallback
      const alt = catFallbacks.find(f => !usedPatterns.has(f.painPoint));
      if (alt) {
        matched.push(alt);
        usedPatterns.add(alt.painPoint);
      } else {
        matched.push(fb); // last resort
        break;
      }
    }
  }

  // 安全网：二次过滤美妆禁用 badge（防止通过 fallback/materials 路径漏入）
  if (isBeautyProduct) {
    for (let i = matched.length - 1; i >= 0; i--) {
      if (beautyBannedBadges.has(matched[i].badge)) {
        matched.splice(i, 1);
      }
    }
    // 补充到至少3个（用美妆专用 fallback）
    const beautyFallbacks = getCategoryFallbacks(category, productName, materials);
    while (matched.length < 3) {
      const fb = beautyFallbacks.find(f => !matched.some(m => m.painPoint === f.painPoint));
      if (fb) {
        matched.push(fb);
      } else {
        break;
      }
    }
  }

  // 安全网：二次过滤五金/电子禁用 badge
  if (isHardwareProduct) {
    for (let i = matched.length - 1; i >= 0; i--) {
      if (hardwareBannedBadges.has(matched[i].badge)) {
        matched.splice(i, 1);
      }
    }
    const hwFallbacks = getCategoryFallbacks(category, productName, materials);
    while (matched.length < 3) {
      const fb = hwFallbacks.find(f => !matched.some(m => m.painPoint === f.painPoint));
      if (fb) {
        matched.push(fb);
      } else {
        break;
      }
    }
  }

  const scene1 = compactLabel(usageScenes[0] || "everyday use", 5, 32).toLowerCase();
  const scene2 = compactLabel(usageScenes[1] || usageScenes[0] || "home use", 5, 32).toLowerCase();
  const audience1 = compactLabel(targetAudience[0] || "everyday users", 3, 24);

  // Pain-point image: headline = customer problem, badges = benefits
  const painPointHeadline = matched[0].painPoint;
  const painPointBadge1 = matched[1].badge;
  const painPointBadge2 = matched[2].badge;

  // Function image: headline = key benefit, badges = supporting features
  const functionHeadline = matched[1].benefit;
  const functionBadge1 = matched[0].badge;
  // Avoid duplicating badges already used in pain-point
  const functionBadge2Raw = matched[2].badge;
  const functionBadge2 = (functionBadge2Raw.toLowerCase() === painPointBadge1.toLowerCase() || functionBadge2Raw.toLowerCase() === painPointBadge2.toLowerCase())
    ? (matched.length > 3 ? matched[3].badge : matched[0].benefit)
    : functionBadge2Raw;

  // Lifestyle: result headline from scene context
  const resultHeadline = deriveResultHeadline(scene1, audience1, category, materials, productName);

  // Value: why choose this product
  const valueHeadline = deriveValueHeadline(category, productName, materials);

  // A+ labels: 3 distinct buying reasons (benefit phrases)
  const aPlusLabelsRaw = uniqueLabels(
    matched.map(m => m.benefit)
  ).slice(0, 3);
  // Ensure we always have 3 labels — pad with badge text if needed
  while (aPlusLabelsRaw.length < 3) {
    const extra = matched.find(m => !aPlusLabelsRaw.map(l => l.toLowerCase()).includes(m.badge.toLowerCase()));
    if (extra) {
      aPlusLabelsRaw.push(extra.badge);
    } else {
      break;
    }
  }
  const aPlusLabels = aPlusLabelsRaw;

  // Comparison badges: top 3 unique badges for ours-vs-theirs
  const comparisonBadges = uniqueLabels([
    matched[0].badge,
    matched[1].badge,
    matched[2].badge,
  ]).slice(0, 3);

  // Pre-generate OPPOSITE text for comparison image right side
  const comparisonOpposites = comparisonBadges.map(badge => badgeToOpposite(badge));

  // 过滤所有文案中的违禁词
  const safe = (text: string) => filterProhibitedWords(text);

  return {
    productName,
    category,
    sellingPoints,
    usageScenes,
    targetAudience,
    materials,
    painPointHeadline: safe(painPointHeadline),
    painPointBadge1: safe(painPointBadge1),
    painPointBadge2: safe(painPointBadge2),
    functionHeadline: safe(functionHeadline),
    functionBadge1: safe(functionBadge1),
    functionBadge2: safe(functionBadge2),
    resultHeadline: safe(resultHeadline),
    valueHeadline: safe(valueHeadline),
    aPlusLabels: aPlusLabels.map(safe).filter(l => l.length > 0),
    comparisonBadges: comparisonBadges.map(safe).filter(b => b.length > 0),
    comparisonOpposites: comparisonOpposites.map(safe).filter(b => b.length > 0),
    scene1,
    scene2,
    audience1,
    isBeautyProduct,
    isNailPolish: /nail.?polish|nail.?lacquer|nail.?hardener|hardener.?nail|甲油|指甲油/.test(`${category} ${productName}`.toLowerCase()),
    isHardwareProduct,
    isSmallProduct: detectSmallProduct(analysis.estimatedDimensions || "", category, productName),
  };
}

/** Category-aware fallbacks — no fake claims */
function getCategoryFallbacks(category: string, productName: string, materials: string): BenefitMatch[] {
  const ctx = `${category} ${productName} ${materials}`.toLowerCase();

  // ⚡ Electronics / Hardware / Connectors / Tools — MUST be checked BEFORE jewelry
  // (tools for jewelry making should get tool badges, not jewelry badges)
  if (/connector|cable|wire|adapter|plug|socket|terminal|switch|circuit|pcb|led|module|electronic|electric|tool|hardware|motor|relay|fuse|crimp|solder|helping.?hand|third.?hand|magnif|clamp|vise|vice|workbench|work.?station|plier|wrench|screwdriver|drill|repair|station|接头|连接器|插头|电|焊|端子|工具|五金|钳|扳手|螺丝刀|放大镜/.test(ctx)) {
    return [
      { pattern: /^$/, painPoint: "Built Tough", benefit: "Durable Construction", badge: "Extra Sturdy" },
      { pattern: /^$/, painPoint: "Pro-Level Precision", benefit: "Professional Grade Tool", badge: "Pro Grade" },
      { pattern: /^$/, painPoint: "Quick & Easy Setup", benefit: "Ready to Use", badge: "Easy Setup" },
      { pattern: /^$/, painPoint: "Reliable Performance", benefit: "Secure Fit Every Time", badge: "Secure Fit" },
    ];
  }

  // Jewelry / gemstone / accessories (word boundaries to avoid matching "wiring", "spring" etc.)
  if (/\bring\b|jewel|necklace|bracelet|\bearring\b|pendant|charm|\bbead\b|\bgem\b|\bstone\b|crystal|agate|kyanite|jade|quartz|饰品|戒指|项链|手链|耳环|珠|水晶|玛瑙/.test(ctx)) {
    return [
      { pattern: /^$/, painPoint: "Genuine Natural Stone", benefit: "Real Natural Material", badge: "Natural" },
      { pattern: /^$/, painPoint: "Wear It Your Way", benefit: "Versatile Styling", badge: "Versatile" },
      { pattern: /^$/, painPoint: "Thoughtful Gift", benefit: "Gift-Ready", badge: "Gift Idea" },
      { pattern: /^$/, painPoint: "Smooth Polished Finish", benefit: "Fine Craftsmanship", badge: "Polished" },
    ];
  }

  // Beauty / Cosmetics / Nail
  if (/nail.?polish|nail.?lacquer|lipstick|mascara|makeup|cosmetic|beauty|eyeshadow|foundation|skincare|甲油|指甲油|口红|化妆|美妆|护肤/.test(ctx)) {
    return [
      { pattern: /^$/, painPoint: "No More Waiting", benefit: "Quick Dry Formula", badge: "Quick Dry" },
      { pattern: /^$/, painPoint: "Color That Lasts", benefit: "Chip-Resistant Finish", badge: "Long Wear" },
      { pattern: /^$/, painPoint: "Salon-Quality Color", benefit: "Rich Pigment Formula", badge: "Vivid Color" },
      { pattern: /^$/, painPoint: "Smooth Application", benefit: "Even Coverage", badge: "Smooth" },
    ];
  }

  // Home Décor / Flowers
  if (/flower|floral|artificial|faux|bouquet|decor|decorat|花|仿真|装饰/.test(ctx)) {
    return [
      { pattern: /^$/, painPoint: "Always in Bloom", benefit: "Lifelike Design", badge: "Lifelike" },
      { pattern: /^$/, painPoint: "Easy to Arrange", benefit: "Ready to Display", badge: "Ready-Made" },
      { pattern: /^$/, painPoint: "Thoughtful Gift", benefit: "Gift-Ready", badge: "Gift Idea" },
    ];
  }

  // Pet products
  if (/pet|dog|cat|puppy|kitten|宠物|猫|狗/.test(ctx)) {
    return [
      { pattern: /^$/, painPoint: "Safe for Your Pet", benefit: "Pet-Safe Material", badge: "Pet-Safe" },
      { pattern: /^$/, painPoint: "Easy to Clean", benefit: "Quick Wash", badge: "Washable" },
      { pattern: /^$/, painPoint: "Durable Build", benefit: "Long-Lasting", badge: "Durable" },
    ];
  }

  // Kitchen / cooking
  if (/kitchen|cook|bak|food|pan|pot|tray|plate|bowl|cup|厨|烹|盘|碗/.test(ctx)) {
    return [
      { pattern: /^$/, painPoint: "Safe for Food", benefit: "Food-Grade Material", badge: "Food-Safe" },
      { pattern: /^$/, painPoint: "Easy to Clean", benefit: "Quick Cleanup", badge: "Easy Clean" },
      { pattern: /^$/, painPoint: "Built to Last", benefit: "Durable Construction", badge: "Durable" },
    ];
  }

  // Generic fallbacks — factual, no fake claims
  return [
    { pattern: /^$/, painPoint: "Quality You Can Feel", benefit: "Premium Material", badge: "Premium" },
    { pattern: /^$/, painPoint: "Built to Last", benefit: "Durable Design", badge: "Durable" },
    { pattern: /^$/, painPoint: "Ready to Use", benefit: "Easy Setup", badge: "Easy Setup" },
  ];
}

function deriveResultHeadline(scene: string, audience: string, category: string, materials?: string, productName?: string): string {
  // Use CATEGORY + MATERIAL + PRODUCT NAME as primary signal
  const cat = category.toLowerCase();
  const mat = (materials || "").toLowerCase();
  const pn = (productName || "").toLowerCase();
  const ctx2 = `${cat} ${mat} ${pn}`;

  // ⚡ Electronics / Hardware / Tools — check BEFORE jewelry (tools for jewelry ≠ jewelry)
  if (/connector|plug|socket|terminal|crimp|splice|接头|连接器|插头|插座|端子/.test(ctx2)) {
    const hwHeadlines = ["Reliable Every Time", "Connect With Confidence", "Solid Connection", "Wired Right"];
    return hwHeadlines[Math.floor(Math.random() * hwHeadlines.length)];
  }
  if (/solder|helping.?hand|third.?hand|magnif|clamp|vise|vice|焊|放大镜/.test(ctx2)) {
    const toolHeadlines = ["Precision Made Easy", "Hands-Free Precision", "Work Smarter", "Built for the Job"];
    return toolHeadlines[Math.floor(Math.random() * toolHeadlines.length)];
  }
  if (/wire|cable|harness|电线|电缆|排线/.test(ctx2)) return "Stay Connected";
  if (/tool|wrench|plier|screwdriver|drill|repair|工具|扳手|钳|螺丝刀|钻/.test(ctx2)) return "Get the Job Done";
  if (/switch|relay|circuit|fuse|motor|开关|继电器|电路|保险丝|马达/.test(ctx2)) return "Built for Reliability";
  if (/electronic|electric|component|hardware|五金|电子|配件/.test(ctx2)) {
    const techHeadlines = ["Tech Essentials", "Reliable Every Time", "Built for Performance", "Connect With Confidence"];
    return techHeadlines[Math.floor(Math.random() * techHeadlines.length)];
  }

  // Jewelry — stone-specific headlines
  if (/kyanite|蓝晶石/.test(ctx2)) return "Calm Blue Energy";
  if (/agate|玛瑙/.test(ctx2) && /red|红/.test(ctx2)) return "Bold Red Elegance";
  if (/agate|玛瑙/.test(ctx2)) return "Natural Stone Beauty";
  if (/amethyst|紫水晶/.test(ctx2)) return "Purple Serenity";
  if (/rose.?quartz|粉晶|芙蓉石/.test(ctx2)) return "Soft Pink Glow";
  if (/tiger.?eye|虎眼/.test(ctx2)) return "Bold Earth Tones";
  if (/jade|翡翠|玉/.test(ctx2)) return "Timeless Jade";
  if (/obsidian|黑曜石/.test(ctx2)) return "Sleek Dark Edge";
  if (/lapis|青金石/.test(ctx2)) return "Deep Blue Charm";
  if (/turquoise|绿松石/.test(ctx2)) return "Desert Sky Blue";
  if (/moonstone|月光石/.test(ctx2)) return "Moonlit Glow";
  if (/aquamarine|海蓝宝/.test(ctx2)) return "Ocean Blue Clarity";
  if (/crystal|水晶|quartz|石英/.test(ctx2)) return "Crystal Clear Style";
  if (/pearl|珍珠/.test(ctx2)) return "Classic Pearl Elegance";

  // Generic jewelry fallback — randomize
  // Use \b word boundary to avoid matching "wiring", "spring" etc.
  // Only match "accessori" if NOT electronics/hardware context
  if (/\bring\b|(?<!electronic.{0,3})(?<!electric.{0,3})\bjewel|necklace|bracelet|\bearring\b|pendant|charm|饰品|戒指|项链|手链|耳环/.test(cat) && !/electronic|electric|connector|cable|wire|tool|hardware|solder|pcb|circuit|pin|plug|socket|terminal|fan|adapter|电子|电气|工具|五金|焊|连接器|接头|插头|插座|端子/.test(ctx2)) {
    const jewelryHeadlines = ["Wear Your Story", "Everyday Elegance", "Your Signature Look", "Simply Beautiful"];
    return jewelryHeadlines[Math.floor(Math.random() * jewelryHeadlines.length)];
  }
  if (/watch|手表/.test(cat)) return "Time in Style";
  if (/bag|purse|wallet|clutch|tote|包|钱包/.test(cat)) return "Carry in Style";
  if (/hat|cap|scarf|glove|帽|围巾|手套/.test(cat)) return "Style Essential";
  if (/cloth|dress|shirt|jacket|coat|服装|衣/.test(cat)) return "Wear With Confidence";
  if (/shoe|boot|sneaker|sandal|鞋|靴/.test(cat)) return "Step Up Your Style";

  // Beauty / Cosmetics / Nail / Skincare
  if (/nail.?polish|nail.?lacquer|甲油|指甲油/.test(ctx2)) {
    const nailHeadlines = ["Nails That Get Compliments", "Salon Finish at Home", "Your New Signature Shade", "Color That Speaks"];
    return nailHeadlines[Math.floor(Math.random() * nailHeadlines.length)];
  }
  if (/lipstick|lip.?gloss|口红|唇膏/.test(ctx2)) return "Lips They Remember";
  if (/mascara|睫毛膏/.test(ctx2)) return "Lashes That Stop Traffic";
  if (/foundation|粉底/.test(ctx2)) return "Skin, But Better";
  if (/eyeshadow|eye.?shadow|眼影/.test(ctx2)) return "Eyes That Own the Room";
  if (/skincare|serum|moisturiz|cream|lotion|护肤|精华|面霜/.test(ctx2)) return "Wake Up Glowing";
  if (/sunscreen|spf|防晒/.test(ctx2)) return "Protected & Beautiful";
  if (/makeup|cosmetic|beauty|化妆|美妆/.test(cat)) {
    const beautyHeadlines = ["Ready in Minutes", "Your Best Look Yet", "Confidence in a Bottle", "Beauty Without Effort"];
    return beautyHeadlines[Math.floor(Math.random() * beautyHeadlines.length)];
  }

  // Home Décor / Flowers / Plants
  if (/baby.?breath|gypsophila|满天星/.test(ctx2)) return "Delicate Floral Touch";
  if (/artificial|faux|fake|silk.?flower|仿真花|假花/.test(ctx2)) return "Always in Bloom";
  if (/bouquet|花束/.test(ctx2)) return "Instant Elegance";
  if (/flower|floral|花/.test(cat)) {
    const flowerHeadlines = ["Bloom All Year", "Fresh Look, No Fuss", "Nature's Beauty", "Lasting Bloom"];
    return flowerHeadlines[Math.floor(Math.random() * flowerHeadlines.length)];
  }
  if (/candle|蜡烛|香薰/.test(ctx2)) return "Set the Mood";
  if (/pillow|cushion|抱枕|靠垫/.test(ctx2)) return "Cozy Comfort";
  if (/curtain|窗帘/.test(ctx2)) return "Elegant Drape";
  if (/decor|decorat|home.?accent|装饰|摆件/.test(cat)) {
    const decorHeadlines = ["Elevate Your Space", "Style Your Room", "Instant Room Refresh"];
    return decorHeadlines[Math.floor(Math.random() * decorHeadlines.length)];
  }

  // Pet products
  if (/pet|dog|cat|puppy|kitten|宠物|猫|狗/.test(cat)) return "Pet-Approved";

  // Electronics / Tech / Hardware
  if (/connector|plug|socket|terminal|crimp|splice|接头|连接器|插头|插座|端子/.test(ctx2)) {
    const hwHeadlines = ["Reliable Every Time", "Connect With Confidence", "Solid Connection", "Wired Right"];
    return hwHeadlines[Math.floor(Math.random() * hwHeadlines.length)];
  }
  if (/wire|cable|harness|电线|电缆|排线/.test(ctx2)) return "Stay Connected";
  if (/charg|adapter|充电|数据线/.test(ctx2)) return "Stay Powered Up";
  if (/headphone|earphone|earbud|speaker|耳机|音箱/.test(ctx2)) return "Sound Perfected";
  if (/phone.?case|手机壳/.test(ctx2)) return "Style & Protection";
  if (/keyboard|mouse|键盘|鼠标/.test(ctx2)) return "Type in Comfort";
  if (/light|lamp|led|灯/.test(ctx2)) return "Light Up Your Space";
  if (/tool|wrench|plier|screwdriver|drill|工具|扳手|钳|螺丝刀|钻/.test(ctx2)) return "Get the Job Done";
  if (/switch|relay|circuit|fuse|开关|继电器|电路|保险丝/.test(ctx2)) return "Built for Reliability";

  // Then fall back to scene-based matching
  const ctx = `${scene} ${audience} ${category}`.toLowerCase();
  if (/cook|bak|oven|kitchen|meal|food|grill|bbq|catering/.test(ctx)) return "Meal Prep Made Easy";
  if (/organiz|storage|clutter|tidy|desk|shelf/.test(ctx)) return "Clutter-Free Living";
  if (/outdoor|camp|travel|garden|patio|picnic|hik/.test(ctx)) return "Ready for Adventure";
  if (/fitness|gym|workout|exercise|yoga|health/.test(ctx)) return "Your Fitness Upgrade";
  if (/office|work|professional|business|meeting/.test(ctx)) return "Work Smarter";
  if (/family|kid|parent|baby|child|party/.test(ctx)) return "Family Favorite";
  if (/tech|electronic|computer|phone|gadget|charg/.test(ctx)) return "Tech Essentials";
  if (/beauty|skin|hair|makeup|grooming/.test(ctx)) return "Look Your Best";
  if (/home|house|room|living|bedroom/.test(ctx)) return "Elevate Your Space";
  return `Perfect for ${audience}`;
}

/** Detect if product is small / wearable and needs special framing in lifestyle images */
function getProductVisibilityRule(category: string, productName: string): string {
  const ctx = `${category} ${productName}`.toLowerCase();

  // Small wearable items — product MUST be prominent
  if (/\bring\b|jewel|necklace|bracelet|\bearring\b|pendant|charm|watch|戒指|项链|手链|耳环|手表|饰品/.test(ctx)) {
    return `
🔍 SMALL PRODUCT VISIBILITY — CRITICAL:
- This is a SMALL wearable product. It MUST be the visual focal point.
- Use CLOSE-UP or MEDIUM-CLOSE framing — do NOT shoot full body or wide angle.
- Frame the shot so the product fills at least 30-40% of the image area.
- Use shallow depth of field to blur the background and draw attention to the product.
- Lighting must highlight the product: catch light on metal, sparkle on gems, texture on leather.
- The person wearing/holding it should be secondary — the PRODUCT is the star.
- Example framing: hand/wrist close-up for rings/bracelets, neck/collarbone for necklaces, face-side for earrings.
`;
  }

  // Small non-wearable items
  if (/key|pin|badge|button|charm|小|迷你|mini/.test(ctx)) {
    return `
🔍 SMALL PRODUCT VISIBILITY:
- This product is physically small. Ensure it's clearly visible in the scene.
- Use close or medium framing — avoid wide shots where the product gets lost.
- The product must fill at least 25% of the image area.
`;
  }

  return "";
}

/** Get scene direction appropriate for the product category */
function getCategorySceneGuide(category: string, productName: string): string {
  const ctx = `${category} ${productName}`.toLowerCase();

  // ⚡ Electronics / Hardware / Tools — check BEFORE jewelry (tools for jewelry making ≠ jewelry)
  if (/connector|cable|wire|adapter|plug|socket|terminal|switch|circuit|pcb|led|solder|helping.?hand|third.?hand|magnif|clamp|vise|vice|tool|hardware|repair|station|接头|连接器|插头|电|焊|端子|工具|五金|放大镜/.test(ctx)) {
    const hwScenes = [
      "person at a well-organized workbench, soldering iron in hand, using the product on a circuit board — warm overhead task light, tools neatly arranged",
      "electronics hobbyist at a clean desk with oscilloscope and components — product prominently in use, focused work atmosphere",
      "workshop or garage setting, product being used for a repair project — good task lighting, organized tools visible",
      "maker space or lab environment, person assembling electronics — product is the central focus of the work",
    ];
    const chosenScene = hwScenes[Math.floor(Math.random() * hwScenes.length)];
    return `
🎬 SCENE DIRECTION (Tools/Electronics):
- USE THIS SPECIFIC SCENE: ${chosenScene}
- Show the product being USED in a real work context
- Background: workshop, workbench, lab, or maker space — NOT a living room, garden, or fashion setting
- Do NOT use: jewelry store scenes, fashion/beauty settings, nature walks, cafés
- The person should look focused and competent — this is a WORK tool, not a fashion accessory
`;
  }

  if (/\bring\b|jewel|necklace|bracelet|\bearring\b|pendant|charm|饰品|戒指|项链|手链|耳环/.test(ctx)) {
    // 随机选一个场景方向，避免总是同一个
    const jewelryScenes = [
      "getting ready for a date night — mirror, vanity, warm light",
      "relaxing at a sunlit café with a latte — outdoor terrace, golden hour",
      "walking through a garden or park at sunset — natural greenery, warm bokeh",
      "having brunch with friends — elegant table setting, bright natural light",
      "reading a book by a window — cozy armchair, soft afternoon light",
      "at an art gallery or museum — minimal modern interior, soft spotlights",
      "enjoying afternoon tea — elegant teaware, floral arrangement, soft tones",
      "strolling through a European-style street — cobblestone, warm architecture",
    ];
    const chosenScene = jewelryScenes[Math.floor(Math.random() * jewelryScenes.length)];
    return `
🎬 SCENE DIRECTION (Jewelry/Accessories):
- USE THIS SPECIFIC SCENE: ${chosenScene}
- Show the product being WORN in a stylish, aspirational context
- Background: soft bokeh, warm tones, elegant but not corporate
- Do NOT use: office/work scenes, gym, kitchen, industrial settings, yoga/meditation
- Do NOT use: white fur/fluffy fabric backgrounds
- The model should look happy, confident, and stylish — NOT working at a desk or meditating
`;
  }

  // Beauty / Cosmetics / Nail
  if (/nail.?polish|nail.?lacquer|lipstick|mascara|makeup|cosmetic|beauty|eyeshadow|foundation|甲油|指甲油|口红|化妆|美妆/.test(ctx)) {
    const beautyScenes = [
      "close-up of a woman's hand wrapped around a ceramic latte cup on a marble café counter — natural window light from the left, shallow DOF f/2.0, her polished nails are the SHARPEST focal element in the frame",
      "a woman touching her chin/jawline thoughtfully at golden hour — soft warm backlight creating a rim of light around her hair, her polished nails catching and reflecting the warm light beautifully",
      "woman relaxing on a velvet sofa in a stylish living room — one hand resting elegantly on the armrest, nails prominently displayed, soft editorial lighting from a floor lamp, bokeh of warm interior behind",
      "woman holding a champagne flute at an elegant dinner — candlelight reflecting off her nails, warm skin tones, shallow DOF isolates her hand and the glass, romantic and aspirational atmosphere",
      "self-care moment: woman sitting at a vanity mirror applying the polish — beautiful warm lighting, the bottle and her nails both visible, intimate and empowering mood",
      "woman's hand gently touching fresh flowers in a bright sunlit room — the polish color contrasts beautifully with the petals, natural soft lighting, clean and fresh feeling",
    ];
    const chosenScene = beautyScenes[Math.floor(Math.random() * beautyScenes.length)];
    return `
🎬 SCENE DIRECTION (Beauty/Cosmetics):
- USE THIS SPECIFIC SCENE: ${chosenScene}
- Show the product being USED or the RESULT of using it (e.g., painted nails, applied makeup)
- Background: glamorous but approachable, warm tones, soft directional lighting
- 🚫🚫🚫 BANNED SCENES (ABSOLUTE — do NOT use ANY of these, ZERO EXCEPTIONS):
  office, desk, laptop, computer, keyboard, work setting, study, library,
  gym, kitchen, warehouse, factory, construction site, industrial,
  yoga studio, meditation room, hospital, clinic
- 🚫🚫🚫 BANNED PROPS (if ANY of these appear, the image is REJECTED):
  laptop, keyboard, mouse, notebook, planner, pen, pencil, office supplies,
  exercise equipment, textbooks, paperwork, briefcase, filing cabinet
- BEFORE finalizing: scan the entire image for banned props. If ANY banned item appears even in the background, REMOVE it.
- The model should look confident, stylish, and beautiful — NOT working, studying, or exercising
- For nail polish: the NAILS are the HERO of the image — they must be the sharpest, most prominent element
- The polish color on the nails must EXACTLY match the product bottle color (refer to COLOR LOCK)
- Show the nails in a way that makes the viewer think: "I want my nails to look like THAT"

📷 PHOTOGRAPHIC REALISM — CRITICAL:
- This MUST look like a real photograph shot by a professional beauty photographer, NOT an AI render
- Natural skin texture: visible pores, subtle light variation, real skin — NOT airbrushed or plastic-smooth
- Realistic fabric: natural wrinkles, real textile texture, not perfectly smooth
- Single clear light source with natural falloff and shadow direction
- Depth of field must be physically realistic: shallow DOF = f/1.8-2.8 equivalent
- NO "AI glow" — no unnaturally even illumination, no perfect symmetry, no HDR over-processing
- Color grading: editorial magazine style (Vogue, Elle, Allure), NOT Instagram filter
- The image should be INDISTINGUISHABLE from a real professional beauty photoshoot
`;
  }

  // Home Décor / Flowers
  if (/flower|floral|artificial|faux|bouquet|wreath|花|仿真|花束|花环/.test(ctx)) {
    const flowerScenes = [
      "elegant living room with the flowers in a vase on a coffee table — natural light from window",
      "bright kitchen counter with the flowers as a centerpiece — warm morning light",
      "bedroom nightstand with the flowers — cozy, romantic atmosphere",
      "dining table setting with the flowers as centerpiece — elegant dinner party mood",
      "entryway console table with the flowers welcoming guests — bright and inviting",
      "wedding or event table decoration — romantic, dreamy atmosphere",
    ];
    const chosenScene = flowerScenes[Math.floor(Math.random() * flowerScenes.length)];
    return `
🎬 SCENE DIRECTION (Home Décor/Flowers):
- USE THIS SPECIFIC SCENE: ${chosenScene}
- Show the product displayed beautifully in a REAL home or event setting
- Background: warm, inviting, well-decorated interior
- The flowers/décor should be the HERO of the shot — prominent and well-lit
- Do NOT use: outdoor wilderness, gym, office cubicle
- Styling: clean, modern, aspirational home — think Pinterest or interior design magazine
`;
  }

  if (/pet|dog|cat|puppy|kitten|宠物|猫|狗/.test(ctx)) {
    return `
🎬 SCENE DIRECTION (Pet Products):
- Show a REAL pet using/wearing the product in a natural setting
- BEST scenes: living room, backyard, park, cozy couch, pet bed
- The pet should look happy, comfortable, and safe
- Owner can be partially visible for scale, but the PET + PRODUCT are the stars
`;
  }

  return "";
}

function deriveValueHeadline(category: string, productName: string, materials: string): string {
  const ctx = `${category} ${productName} ${materials}`.toLowerCase();

  // ⚡ Electronics / Hardware / Tools — check BEFORE jewelry
  if (/connector|plug|socket|terminal|crimp|splice|接头|连接器|插头|插座|端子/.test(ctx)) return "Reliable Connection";
  if (/solder|helping.?hand|third.?hand|magnif|clamp|vise|vice|焊|放大镜/.test(ctx)) return "Precision You Can Trust";
  if (/wire|cable|harness|电线|电缆|排线/.test(ctx)) return "Secure Connection";
  if (/tool|wrench|plier|screwdriver|drill|repair|工具|扳手|钳|螺丝刀/.test(ctx)) return "Professional Grade";
  if (/switch|relay|circuit|fuse|motor|开关|继电器|电路|马达/.test(ctx)) return "Engineered to Last";

  // Jewelry / gemstone — material authenticity
  if (/kyanite|蓝晶石/.test(ctx)) return "Genuine Kyanite";
  if (/agate|玛瑙/.test(ctx)) return "Genuine Natural Agate";
  if (/crystal|水晶|quartz/.test(ctx)) return "Real Crystal Stone";
  if (/jade|翡翠|玉/.test(ctx)) return "Authentic Jade";
  if (/\bring\b|jewel|necklace|bracelet|\bearring\b|pendant|charm|\bbead\b|\bgem\b|\bstone\b|饰品|戒指|项链|手链|耳环|珠/.test(ctx)) return "Natural Stone Quality";

  // Beauty / Cosmetics
  if (/nail.?polish|nail.?lacquer|甲油|指甲油/.test(ctx)) return "Pro Formula, Home Price";
  if (/lipstick|lip.?gloss|口红|唇膏/.test(ctx)) return "Color That Stays Put";
  if (/mascara|睫毛膏/.test(ctx)) return "Volume You Can See";
  if (/foundation|粉底/.test(ctx)) return "Skin-Match Technology";
  if (/eyeshadow|eye.?shadow|眼影/.test(ctx)) return "Buildable Color Depth";
  if (/skincare|serum|moisturiz|cream|lotion|护肤|精华|面霜/.test(ctx)) return "Visible Results in Days";
  if (/makeup|cosmetic|beauty|化妆|美妆/.test(ctx)) return "Pro Results, Every Time";

  // Home Décor / Flowers
  if (/artificial|faux|fake|silk.?flower|仿真|假花/.test(ctx)) return "Lifelike Design";
  if (/baby.?breath|gypsophila|满天星/.test(ctx)) return "Realistic Detail";
  if (/bouquet|花束/.test(ctx)) return "Ready to Display";
  if (/flower|floral|花/.test(ctx)) return "Nature-Inspired";
  if (/candle|蜡烛|香薰/.test(ctx)) return "Warm Ambiance";
  if (/decor|decorat|装饰|摆件/.test(ctx)) return "Thoughtful Design";

  // Electronics / Tech / Hardware
  if (/connector|plug|socket|terminal|crimp|splice|接头|连接器|插头|插座|端子/.test(ctx)) return "Reliable Connection";
  if (/wire|cable|harness|电线|电缆|排线/.test(ctx)) return "Secure Connection";
  if (/charg|adapter|充电|数据线/.test(ctx)) return "Fast & Reliable";
  if (/headphone|earphone|earbud|speaker|耳机|音箱/.test(ctx)) return "Clear Sound Quality";
  if (/phone.?case|手机壳/.test(ctx)) return "Tough Protection";
  if (/keyboard|mouse|键盘|鼠标/.test(ctx)) return "Precision Control";
  if (/tool|wrench|plier|screwdriver|drill|工具|扳手|钳|螺丝刀/.test(ctx)) return "Professional Grade";
  if (/switch|relay|circuit|fuse|motor|开关|继电器|电路|马达/.test(ctx)) return "Engineered to Last";

  if (/aluminum|steel|metal|iron/.test(ctx)) return "Built to Last";
  if (/food.?grade|bpa.?free|safe|non.?toxic/.test(ctx)) return "Food-Safe Quality";
  if (/bamboo|wood|natural|organic|eco/.test(ctx)) return "Nature-Inspired";
  if (/premium|luxury|high.?end/.test(ctx)) return "Top-Tier Quality";
  if (/pack|set|count|piece/.test(ctx)) return "Great Value Set";
  if (/silicone|rubber|flexible/.test(ctx)) return "Flexible & Durable";
  if (/cotton|fabric|textile|linen/.test(ctx)) return "Soft & Durable";
  if (/glass|ceramic|porcelain/.test(ctx)) return "Elegant & Sturdy";
  if (/plastic|resin|polypropylene/.test(ctx)) return "Lightweight & Tough";
  return `Why Choose ${compactLabel(productName, 2, 16)}`;
}

// ===== Prompt Building Blocks =====

const mainAngles = [
  "from a slight 3/4 angle showing depth and dimension",
  "from a clean front-facing perspective with soft shadow underneath",
  "from a slightly elevated angle showing the top and front",
  "from a dynamic low angle that makes the product look impressive",
];

// 每张图使用不同角度，避免整套8张看起来一样
const featuresAngles = [
  "Product tilted 15-20° to the left, creating a dynamic lean — NOT straight-on",
  "Product shot from a 45° overhead bird's-eye perspective, showing the top cap and front label",
  "Product at a dramatic 3/4 angle from the lower right, looking up at it — makes it feel powerful",
];

const closeupAngles = [
  "Product at a steep 60° side angle, showing the profile/silhouette and label edge",
  "Product lying on its side at a natural angle, cap pointing toward camera",
  "Product from directly above (top-down), cap removed, showing the bottle opening and color inside",
];

const dimensionsAngles = [
  "Product at a clean 3/4 angle so all three dimensions (height, width, depth) are visible simultaneously",
  "Product slightly rotated 30° to show both the front face and one side face clearly",
];

const valueAngles = [
  "Product from a low hero angle (camera at table level, looking slightly up) — makes product feel premium and important",
  "Product at an elegant 45° angle on a reflective surface, showing the bottle from a fresh perspective",
  "Product shot from the side at eye-level, showing the profile silhouette — different from every other image in the set",
];

const mainLighting = [
  "Professional studio lighting with soft, even illumination and subtle rim light",
  "Clean butterfly lighting with a gentle gradient shadow beneath the product",
  "Bright, airy studio lighting with a soft reflection on the surface below",
  "Dramatic studio lighting with one key light creating elegant shadow play",
];

const beautyMainLighting = [
  "Soft beauty lighting with a large key light at 45° and fill card opposite — even, shadow-free illumination that shows true product color without hot spots",
  "Ring light style: flat, even frontal lighting that makes glossy surfaces pop with a circular catchlight — ideal for nail polish and cosmetics",
  "Editorial beauty lighting: large softbox overhead with a subtle kick from below to illuminate labels and show product shape, gentle rim light for separation",
  "Window-light simulation: soft directional light from one side with a reflector fill — creates gentle dimension while keeping colors accurate and labels readable",
];

const closeupStyles = [
  "Use a cropped inset panel to show one meaningful detail up close — shoot from a 45-degree angle",
  "Split the image: full product on the left, macro detail on the right — use a top-down perspective for the detail",
  "Use shallow depth-of-field to draw the eye to one premium component — shoot at eye level",
  "Hero product shot from a low angle with one detail callout in the corner",
  "Overhead/flat-lay style with the product and one zoomed-in detail circle",
];

const beautyCloseupStyles = [
  "Split frame: product bottle on left, macro close-up of perfectly polished nails on right — show color depth and glossy reflection under directional light",
  "Main shot: a hand with stunning polished nails at 30° angle catching light, product bottle placed just behind — shallow DOF highlights the nail surface texture",
  "Color showcase: three lighting angles showing the same polished nail — direct light, side light, and backlight — to reveal color shift, depth, and dimension. Product bottle centered below",
  "Macro hero: extreme close-up of two nails filling 60% of frame, showing wet-gloss finish, perfect cuticle line, and smooth even coverage. Product bottle in soft-focus background",
  "Swatch comparison: product bottle center, with small color swatch circles around it showing the color on different skin tones (light, medium, warm) — proves universal flattery",
];

const closeupBackgrounds = [
  "clean white marble surface with soft natural side lighting",
  "matte dark slate surface for high-contrast detail visibility",
  "light linen fabric with subtle texture — NOT white fur or fluffy fabric",
  "neutral concrete or stone surface with minimal texture",
  "warm wood grain surface with soft overhead lighting",
];

const lifestyleMoods = [
  "golden-hour warmth with soft natural light from a window, single clear light source direction",
  "bright natural daylight with a clean airy feel, slight lens vignette at edges",
  "warm editorial lighting (like Vogue or Elle magazine), gentle shadow depth with natural falloff",
];

const lifestyleCompositions = [
  "Rule of thirds: product at the left intersection point, scene fills the right two-thirds, shallow DOF at f/2.0",
  "Leading lines: use environmental lines (table edge, window frame, countertop) to draw the eye directly to the product",
  "Frame within frame: use a mirror, doorway, or architectural element to frame the product scene, creating depth",
  "Diagonal energy: compose the scene along a strong diagonal line, product at the visual anchor point",
  "Negative space: product and model in the lower-right third, generous aspirational space above for the headline",
];

const multiSceneLayouts = [
  "HERO + THUMBNAILS — one large hero panel (60% of image height) on top, two equal panels (each 50% of remaining width) below. Clear 4px white borders between all panels.",
  "TRIPTYCH — three equal vertical panels side by side, each with its own scene. Consistent 4px white border between panels. Each panel balanced in visual weight.",
  "LEFT HERO + RIGHT STACK — one large hero panel (55% width) on the left, two stacked panels on the right (each 50% of hero height). Clean 4px white dividers.",
];

// ===== Main Plan Generator =====

export function generatePlans(
  analysis: AnalysisResult,
  imageTypes: ImageType[],
  salesRegion: SalesRegion = "us"
): ImagePlan[] {
  const regionConfig = REGION_CONFIGS[salesRegion];
  const imageLanguage = regionToLanguage(salesRegion);
  const targetLang = LANGUAGE_ENGLISH_NAMES[imageLanguage] || "English";

  const langRule = imageLanguage === "en"
    ? "ALL text on the image MUST be in ENGLISH."
    : imageLanguage === "zh"
    ? "ALL text on the image MUST be in CHINESE (中文)."
    : `ALL text on the image MUST be in ${targetLang.toUpperCase()}.`;

  const regionStyleRule = `
🎨 REGIONAL STYLE — ${regionConfig.label}:
- Photography style: ${regionConfig.styleGuide}
- Models/people: ${regionConfig.modelEthnicity}
- Scene/interior style: ${regionConfig.sceneStyle}
- Color tone: ${regionConfig.colorTone}
`;

  const cleanCornerRule = `
🚫 CLEAN CORNERS RULE:
- No watermark, logo, signature, seal, or decorative corner icon
- Keep all four corners completely clean
`;

  const productIdentityRule = `
🔒 PRODUCT IDENTITY RULE:
- This is a real retail product, not an abstract decor object
- Preserve the original product purpose, structure, and practical identity
- PRODUCT LABEL TEXT — CRITICAL:
  - Brand name, product name, and key info MUST be LETTER-PERFECT — spell each character exactly as shown in the reference
  - Before rendering ANY label text, spell it out character by character and verify against the reference photo
  - Common AI error: truncating or altering the last 1-2 characters of brand names (e.g., "XLIXTC" becoming "XLIXTO") — CHECK EVERY LETTER
  - If the brand name has unusual letter combinations, be EXTRA careful to reproduce them exactly
  - If you cannot render text accurately, make it small/subtle rather than large and wrong
  - The label text orientation must match the product surface (curved on bottles, flat on boxes)

📐 FRAMING & CROPPING — CRITICAL:
- The ENTIRE product must be visible within the image — do NOT crop or cut off any part
- Leave at least 5% padding on all sides between the product edge and image border
- The product should fill 60-80% of the image area (not too small, not cropped)
- For images with text overlays: ensure the text does NOT cover the product's key features
- For multi-panel layouts: each panel must show the COMPLETE product, not partial views
`;

  const structureLockRule = `
🔒 STRUCTURE LOCK RULE:
- Keep the exact outer silhouette, slots, openings, compartments from the reference
- Do not add, remove, or redesign any structural parts

🚨 PRODUCT SHAPE & DETAILS — ZERO TOLERANCE:
- If the reference shows a SQUARE bottle, generate a SQUARE bottle — NOT round, NOT cylindrical
- If the reference shows a ROUND bottle, generate a ROUND bottle — NOT square
- The bottle cross-section shape is LOCKED: square stays square, round stays round, oval stays oval
- CAP/LID must match the reference EXACTLY: same shape (dome, flat, tapered), same color, same finish (matte, glossy, metallic)
- Do NOT change cap color from rose gold to yellow gold, or from gold to silver, etc.
- The bottle-to-cap proportion must remain the same as in the reference

🚨 CONNECTOR / CABLE / WIRE — EXACT COUNT MATCH:
- Count the EXACT number of wires/pins/prongs in the reference image and match it PRECISELY
- If the reference shows 3 wires (e.g. red, black, yellow), generate EXACTLY 3 wires — NOT 4, NOT 6, NOT 8
- If the reference shows a 3-pin connector, generate a 3-pin connector — NOT 6-pin, NOT 8-pin
- Wire COLORS must match the reference exactly (e.g. red+black+yellow stays red+black+yellow)
- Connector housing shape, size, and color must match the reference
- Do NOT "upgrade" or "enhance" the product by adding more pins or wires
- CHECK: Count the wires/pins in your generated image — if the count differs from the reference, REGENERATE
`;

  // Sanitize analysis fields to prevent prompt injection via user-edited data
  const sanitizedAnalysis: AnalysisResult = {
    ...analysis,
    productName: sanitizeForPrompt(analysis.productName, 200),
    category: sanitizeForPrompt(analysis.category || "", 100),
    sellingPoints: sanitizeArray(analysis.sellingPoints || [], 200),
    materials: sanitizeForPrompt(analysis.materials || "", 100),
    colors: sanitizeForPrompt(analysis.colors || "", 200),
    targetAudience: sanitizeArray(analysis.targetAudience || [], 200),
    usageScenes: sanitizeArray(analysis.usageScenes || [], 200),
    estimatedDimensions: sanitizeForPrompt(analysis.estimatedDimensions || "", 100),
  };

  const strategy = inferProductStrategy(sanitizedAnalysis);
  const { productName } = strategy;

  const brandSystemRule = `
🎯 LISTING SYSTEM RULE:
- Use short conversion-first headlines, not editorial slogans
- At most 1 headline and 2 tiny badges per support image
- Clean white or light-neutral backgrounds
- Bold, simple typography easy to scan on mobile
- Each image communicates ONE core buying reason
- Visual hierarchy: headline text LARGEST → product SECOND → badges SMALLEST
- Use HIGH CONTRAST between text and background — text must pop immediately
- Headlines: bold sans-serif type, dark color on light background or white on dark overlay
- One accent color element (underline, highlight, or icon) draws the eye to the key message
- The image must create an EMOTIONAL reaction — not just inform, but PERSUADE
`;

  const spellingRule = `
📝 TEXT ACCURACY — CRITICAL:
- Before rendering ANY text, verify the spelling of EVERY word letter by letter
- Common AI misspellings to AVOID: "Spape"→"Shape", "Quailty"→"Quality", "Prfect"→"Perfect", "Beutiful"→"Beautiful", "Strenght"→"Strength", "Dimesions"→"Dimensions", "Widht"→"Width", "Hieght"→"Height", "Lenght"→"Length"
- Double-check every word before committing to the image
- If uncertain about spelling, use a simpler synonym
- ALL text must be real words spelled correctly — no gibberish or placeholder text
- Dimension labels: use standard abbreviations (cm, in, mm, oz, ml, lb, kg)
`;

  const prohibitedWordsRule = `
🚨 PROHIBITED WORDS — AMAZON COMPLIANCE:
Text on images must NOT contain any of these:
- Ranking claims: "Best Seller", "#1", "Top Rated", "Most Popular", "Top Pick", "Top Choice", "Award-Winning"
- Rating claims: "5-Star", "Star Pick", "Highly Rated", "Customer Favorite"
- Medical/health claims: "Healing", "Therapeutic", "Cures", "FDA Approved", "Clinically Proven", "Chakra", "Detox"
- Absolute claims: "100%", "Perfect", "Guaranteed", "Flawless", "Unbreakable", "World's Best"
- Unverified eco claims: "Eco-Friendly", "Organic", "Sustainable", "Biodegradable", "Carbon Neutral"
- Price/promo language: "Free Shipping", "Discount", "Sale", "Cheapest", "Deal", "Buy Now"
- Urgency language: "Limited Time", "Hurry", "Act Now", "Order Now"
If the provided headline or badge text contains any prohibited word, SKIP that text entirely — do NOT display it.
`;

  const strictSingleProductRule = `
🔒 SINGLE PRODUCT RULE:
- Show only the real product from the reference
- Do not generate comparison products, exploded parts, or duplicates
- Do not invent accessories, filler props, or fake package contents
- Do NOT add fictional props (magnifying glasses, rulers, pointers, etc.)
`;

  const noCopyReferenceTextRule = `
🚫 DO NOT COPY REFERENCE TEXT:
- Do NOT reproduce any text visible in the reference photos (e.g. text on cards, tags, packaging)
- Only use the EXACT text specified in the TEXT RULES section below
- If reference photos show text like "have a nice day" or brand slogans, IGNORE them completely
`;

  const strictBadgeRule = `
🚫 STRICT BADGE / LABEL RULE:
- Use ONLY the exact text specified in TEXT RULES below — no more, no less
- Do NOT invent extra badges, seals, ribbons, or stamps (e.g. "Best Seller", "5-Star Pick", "Premium Quality")
- Do NOT add fake certification badges, rating stars, or award icons
- Do NOT duplicate any badge — each badge text appears ONCE only
- Show exactly the number of badges specified in TEXT RULES — no more, no less
`;

  const humanAnatomyRule = `
🚨 HUMAN ANATOMY — CRITICAL (ZERO TOLERANCE):
🖐️ FINGER COUNT IS THE #1 ANATOMY RULE:
- EVERY visible hand MUST have EXACTLY 5 fingers: 1 thumb + 4 fingers = 5 total
- Count BEFORE rendering: thumb (short, thick) + index + middle + ring + pinky = 5. NEVER 4. NEVER 6.
- If you cannot guarantee correct finger count, DO NOT show hands at all — crop them out or use a wider angle
- For nail polish / beauty: if showing hands close-up, show ONLY 4 fingertips (curl the thumb behind) to reduce error risk

🛡️ SAFE HAND POSES (use these to avoid deformed hands):
- HOLDING AN OBJECT: hand wraps around a cup, glass, bottle, phone — the object hides the palm and some fingers, reducing error risk
- FINGERTIPS ONLY: show only the tips of 4 fingers (thumb curled behind), nail-side toward camera
- RESTING ON SURFACE: hand flat on a table/countertop, fingers relaxed and slightly apart — natural and easy to render correctly
- SINGLE HAND ONLY: if the scene allows, show only ONE hand — two hands doubles the chance of errors
- ⚠️ AVOID these high-risk poses: interlaced fingers, jazz hands (spread wide), pointing, making gestures, holding thin objects at odd angles

📐 SMALL PANEL RULE (for multi-panel layouts):
- In small panels (under 50% of image area), use WIDER shots where hands are smaller and detail is less critical
- Do NOT zoom into hands in small panels — small size + high detail = more visible errors
- Prefer showing hands holding/using the product from a medium distance
- If the panel is too small to render hands well, show the product WITHOUT hands in that panel

- Thumbs must be clearly distinct — shorter, thicker, opposable
- Each finger: 3 segments with natural bending
- Fingernails: exactly ONE per finger, natural shape
- All body proportions natural — no extra limbs, merged fingers, distorted joints
`;

  // 产品颜色还原规则 — 基于分析结果中的颜色信息
  const colorAccuracyRule = (colors: string) => colors ? `
🎨 COLOR ACCURACY — CRITICAL (HIGHEST PRIORITY):
🔒 COLOR LOCK: This product is ${colors}. Lock this EXACT color before generating.

STEP-BY-STEP COLOR PROTOCOL (follow in order):
1. SAMPLE: Look at the reference photo. Identify the exact hex color of each product zone (body, cap, label, accent).
2. LOCK: Write down the hex values mentally. These are your COLOR ANCHORS: ${colors}
3. GENERATE: When rendering the product, use ONLY the locked hex values — do NOT let lighting, background, or artistic style shift them.
4. VERIFY: Before finalizing, compare every product pixel against the COLOR ANCHORS. If any zone drifts by more than ~10% in hue/saturation, correct it.

ANTI-COLOR-DRIFT RULES:
- The product body color MUST be the SAME in ALL 8 images — this is an Amazon listing set, not 8 independent photos
- Scene lighting MUST NOT tint the product. In warm scenes: product stays its true color (NOT warmer). In cool scenes: product stays its true color (NOT cooler).
- TECHNIQUE: Mentally apply white-balance correction to the product region — as if the product is lit by pure daylight (D65 / 6500K) regardless of scene lighting
- COMMON FAILURES to AVOID:
  * Nude/beige product turning golden/yellow under warm lighting
  * Light-colored product becoming washed out or too bright on white backgrounds
  * Product color shifting darker in moody/editorial lighting
  * ⚠️ Cap/lid metallic color changing from rose gold to yellow gold or silver — THIS IS A CRITICAL FAILURE
- CAP/LID COLOR LOCK: The cap/lid color is part of the product identity. If the reference shows a ROSE GOLD cap, it must stay ROSE GOLD in every image. Yellow gold ≠ rose gold. Silver ≠ chrome. Match the EXACT metallic tone.
- Background and lighting choices are SECONDARY to color accuracy — if a scene's lighting would shift the product color, change the lighting, NOT the product color
` : "";

  // 模特多样性规则
  const modelDiversityRule = `
👥 MODEL DIVERSITY:
- Use models of VARIED ethnicities and skin tones (East Asian, South Asian, Black, Hispanic, Caucasian, Middle Eastern)
- Do NOT default to only Caucasian/white models
- Pick a model ethnicity that feels natural for the product and target market
- All models should look natural, confident, and relatable
`;

  // 减少售后退货：图片必须真实反映产品，避免过度美化导致期望落差
  const realisticExpectationRule = `
📦 REALISTIC PRODUCT REPRESENTATION (REDUCES RETURNS):
- Show the product's TRUE size, proportions, and appearance — do NOT exaggerate or idealize
- The product color, texture, and finish in the image must match what the customer will receive
- Do NOT add items that are NOT included in the package (e.g., showing flowers in a vase when only the vase is sold)
- Do NOT show the product in an unrealistic scale — if it's small, show it next to a common reference object (hand, coin, phone) so the customer knows the real size
- Material appearance must be honest: if it's plastic, don't make it look like glass; if it's faux leather, don't make it look like genuine leather
- For beauty products: show realistic application results, not impossible perfection — nails should look salon-quality but humanly achievable
- The goal: when the customer receives the product, they should think "this looks exactly like the listing photos"
`;

  // 小产品"手入镜"规则 — 按图片类型决定是否需要手
  // lifestyle: 必须有手（使用场景天然需要手）
  // dimensions: 需要手做参照物
  // closeup: 看产品类型 — 首饰/美妆需要手展示效果，五金/文具不需要
  // packaging/value: 可选，有手更好但不强制
  // comparison/features/aplus: 不需要手
  function getHandInFrameRule(imgType: string): string {
    if (!strategy.isSmallProduct) return "";

    const isWearable = /nail|lipstick|ring|earring|bracelet|necklace|pendant|watch|甲油|口红|戒指|耳环|手链|项链|手表/.test(
      `${strategy.category} ${strategy.productName}`.toLowerCase()
    );

    switch (imgType) {
      case "lifestyle":
        return `
🤚 SMALL PRODUCT — HAND REQUIRED:
This product is SMALL. Show a human hand naturally HOLDING or USING the product in this scene.
- The hand provides intuitive size reference — the customer instantly understands the real size
- Hand pose should be natural and match the scene (holding, using, picking up)
- Do NOT make the product appear larger than reality
`;
      case "dimensions":
        return `
🤚 SMALL PRODUCT — SIZE REFERENCE:
This product is SMALL. Include a hand or common object (coin, pen) next to the product for scale.
- The customer MUST understand the real size before purchasing — this prevents returns
`;
      case "closeup":
        return isWearable ? `
🤚 SMALL PRODUCT — SHOW IN USE:
This is a small wearable/beauty product. Show it being WORN or APPLIED — the hand/body is part of demonstrating the product's effect.
- For jewelry: show it on a finger, wrist, ear, or neck
- For beauty: show the result on skin, nails, or lips
- The hand/body naturally provides a size reference
` : "";
      case "packaging":
        return `
🤚 SMALL PRODUCT — OPTIONAL HAND:
This product is small. If it fits the composition, showing a hand holding or placing the product adds a natural size reference. Not mandatory but recommended.
`;
      default:
        return "";
    }
  }

  // 动态规则实例化
  const colorRule = colorAccuracyRule(sanitizedAnalysis.colors || "");
  const diversityRule = modelDiversityRule;

  const textSafeZoneRule = `
🚨 TEXT SAFE ZONE — CRITICAL:
- ALL text must stay inside a safe zone with at least 40px padding from every edge
- Text must NEVER be cut off, cropped, or overflow the image boundary
- Center text horizontally; avoid placing text in corners or at the very edge
- Use a semi-transparent overlay behind text if needed for readability
- If text is long, use a smaller font — do NOT let it extend beyond the safe zone
`;

  return imageTypes.map((imageType) => {
    switch (imageType) {
      case "main":
        return {
          imageType,
          title: "Hero image",
          description: `${productName} — clean premium hero on white background.`,
          validationNotes: ["one product only", "white background only", "no text on hero image"],
          prompt: `Create a premium Amazon hero image for ${productName}.

⚠️ ${langRule}
${cleanCornerRule}
${productIdentityRule}
${structureLockRule}
🔒 Show ONLY ONE product. Match the reference exactly in shape, color, material, finish, and proportions.
${colorRule}

${realisticExpectationRule}
🚨 HERO IMAGE — CRITICAL RULES:
- Show the product in its FULLY ASSEMBLED, ready-to-use state
- Do NOT show disassembled parts, screws, accessories, or components laid out separately
- Do NOT create a "what's included" flat-lay — that belongs in the packaging image, NOT the hero
- The product must look like something you'd pick up and USE, not a parts diagram
- If the product has multiple components, show them ASSEMBLED together as one unit

COMPOSITION:
- Pure white background (#FFFFFF)
- Center the product with elegant whitespace
- Product should fill approximately 85% of the frame
${strategy.isNailPolish ? `- ${pickRandom([
  "Bottle at a slight 10-15 degree tilt, cap REMOVED and resting beside the bottle base, brush pulled halfway out showing loaded bristles with polish matching the bottle color",
  "Bottle standing upright, cap lifted off and leaning against the bottle at an angle, brush tip visible with a thin strand of polish — dynamic and eye-catching",
  "Eye-level shot with bottle cap elegantly placed beside the base, brush pulled out showing the applicator — a small polish swatch dot on the white surface near the bottle base to show the actual color",
])}
- The open-cap pose creates visual interest vs competitors' static closed bottles
- The brush and any polish swatch MUST match the bottle color exactly` : `- ${pickRandom(mainAngles)}`}
- ${strategy.isBeautyProduct ? pickRandom(beautyMainLighting) : pickRandom(mainLighting)}
- Add a subtle, soft shadow beneath the product for grounding (not floating)

RULES:
- No text, no icons, no props, no extra objects
- No dimension lines, no duplicate products
- No loose screws, tools, or packaging materials
- Keep real-world proportions
- 800x800px

STYLE:
- High-end e-commerce photography — the kind that makes you click "Add to Cart"
- Crisp edges, soft refined shadow
- Premium but believable product rendering
- The product should look solid, substantial, and desirable`,
        };

      case "features": {
        const featureBadges = uniqueLabels([strategy.painPointBadge1, strategy.painPointBadge2, strategy.functionBadge1, strategy.functionBadge2]);
        const badgeCount = Math.min(featureBadges.length, 2 + Math.floor(Math.random() * 3)); // 随机 2-4 个
        const selectedBadges = featureBadges.slice(0, badgeCount);
        return {
          imageType,
          title: "Pain-point / benefit image",
          description: `${productName} — addresses customer pain point and shows the product as the solution.`,
          validationNotes: ["headline is a question or problem statement", `${badgeCount} badges`, "single product only"],
          prompt: `Create a PAIN-POINT image for ${productName} that makes the customer think "I need this!"

⚠️ ${langRule}
${cleanCornerRule}
${productIdentityRule}
${structureLockRule}
${textSafeZoneRule}
${noCopyReferenceTextRule}
${strictBadgeRule}
${prohibitedWordsRule}
${spellingRule}
${colorRule}
${humanAnatomyRule}
🔒 Show ONE product only. Match the reference product exactly.

CONCEPT:
- This image addresses a CUSTOMER PROBLEM and shows the product as the SOLUTION
- The headline names the pain point the customer recognizes from daily life
- The customer should feel: "Yes, that's exactly my problem — and this product fixes it!"

📐 CAMERA ANGLE — MUST BE DIFFERENT FROM MAIN IMAGE:
- ${pickRandom(featuresAngles)}
- ⚠️ Do NOT use the same straight-on front-facing angle as the main/hero image — this image must look visually DISTINCT

VISUAL STORYTELLING:
- Show a clear problem→solution visual narrative
- Product is the HERO — it's the answer to the problem
- Clean background, product as focal point
- Strong whitespace, premium feel
- The image should trigger an EMOTIONAL response: "Yes, that's MY problem — and this fixes it!"
${/nail.?polish|nail.?lacquer|nail.?hardener|hardener.?nail|lipstick|mascara|foundation|eyeshadow|makeup|cosmetic|beauty|甲油|口红|化妆|美妆/.test(strategy.category + " " + strategy.productName) ? `
🎨 BEAUTY-SPECIFIC VISUAL — MANDATORY LAYOUT:
- 🚨 POLISHED NAILS MUST fill at least 50% of the image area — they are the #1 element, NOT the bottle
- MANDATORY COMPOSITION: Close-up of 4 beautifully polished fingertips (thumb curled behind) fills the left/center of the image. The bottle is visible but SMALLER, positioned to the side.
- Camera angle: slightly overhead looking down at the hand, nails tilted toward camera to catch glossy reflections
- The polished nails MUST be the EXACT SAME COLOR as the product in the bottle (refer to COLOR LOCK)
- Do NOT use a different nail color (no dark brown, no red, no pink if the product is nude/beige)
- NAIL BEAUTY CHECKLIST (verify ALL before finalizing):
  ✓ Are polished nails the LARGEST element in the frame? (must be yes)
  ✓ Does the nail color match the bottle exactly? (must be yes)
  ✓ Are there light reflections showing wet-gloss depth? (must be yes)
  ✓ Is the bottle visible but secondary? (must be yes)
  ✓ Do the nails look salon-quality: smooth, even, no streaks? (must be yes)
- If the image shows ONLY the bottle with no polished nails visible, the image is REJECTED — REGENERATE
- Light should catch the polish to show depth, dimension, and wet-gloss shine
- 🚫🚫🚫 ABSOLUTE BAN — ZERO EXCEPTIONS:
  - Do NOT show damaged, chipped, dirty, yellowed, or unhealthy-looking nails ANYWHERE in the image
  - Do NOT show "before" images with ugly/bare/unpolished nails — ONLY show the beautiful RESULT
  - Do NOT show any negative nail imagery — this is a PREMIUM product, every nail shown must look STUNNING
  - If showing a comparison, show TWO polished states (e.g., matte vs glossy), NEVER polished vs unpolished
  - ⚠️ IMPORTANT: The headline text may mention a PROBLEM (e.g., "Weak, Brittle Nails?") — this is the HEADLINE TEXT ONLY
    The VISUAL must show the SOLUTION, not the problem! Show ONLY gorgeous, strong, perfectly polished nails.
    The text asks the question → the image shows the answer. NEVER illustrate the problem visually.
- The image should make the viewer think: "I NEED my nails to look like that"
` : ""}

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.painPointHeadline}"
- EXACT badge texts (copy verbatim): ${selectedBadges.map(b => `"${b}"`).join(", ")}
- ⚠️ Do NOT invent, rephrase, or expand the text above. Use ONLY these exact words.
- ⚠️ Do NOT add extra badges, icons, timelines, rulers, scales, or infographic elements beyond what is listed
- No paragraph text, no long descriptions

📋 TEXT MANIFEST (ONLY these texts appear on this image):
1. Headline: "${strategy.painPointHeadline}"
${selectedBadges.map((b, i) => `${i + 2}. Badge: "${b}"`).join("\n")}
TOTAL: ${1 + selectedBadges.length} text elements. Do NOT add ANY text not listed above.
Spell each word EXACTLY as shown — letter by letter.

STYLE:
- Premium Amazon listing image that makes the customer STOP scrolling
- Bold, clear headline typography that reads instantly on mobile
- The headline should hit like a punch — the customer immediately recognizes their problem
- 800x800px`,
        };
      }

      case "closeup":
        return {
          imageType,
          title: "Why-it's-better detail image",
          description: `${productName} — shows WHY this product is better, giving the customer a reason to choose it.`,
          validationNotes: ["one headline only", "max 2 micro labels", "benefit-focused"],
          prompt: `Create a BENEFIT-FOCUSED detail image for ${productName}.

⚠️ ${langRule}
${cleanCornerRule}
${productIdentityRule}
${structureLockRule}
${textSafeZoneRule}
${noCopyReferenceTextRule}
${strictBadgeRule}
${prohibitedWordsRule}
${spellingRule}
${colorRule}
${humanAnatomyRule}
${getHandInFrameRule("closeup")}
🔒 Show ONLY ONE product. Keep the product identical to the reference.

${strategy.isNailPolish ? `
🚨 NAIL POLISH CLOSEUP — MANDATORY (THIS IS THE #1 RULE FOR THIS IMAGE):
- The HERO SUBJECT of this image is POLISHED NAILS, not the bottle
- Show a close-up of a hand with GORGEOUSLY POLISHED NAILS — wet-gloss, perfect cuticles, even coverage
- The nails must fill at least 40% of the image area — they are the STAR, not a side detail
- Place the product bottle nearby (in background or beside the hand) as a color reference
- The nail color and the bottle color must match EXACTLY
- Shoot at a slight angle to catch light reflection showing color depth and dimension
- Use soft directional lighting that creates a glossy highlight streak across each nail surface
- The nails should make viewers think: "I NEED this color on my nails RIGHT NOW"
- Do NOT show damaged, chipped, dirty, or ugly nails — ZERO negative imagery
- Do NOT use magnifying glass circles or detail callouts — just beautiful macro photography
- Do NOT focus on the bottle detail (corners, threading, cap) — the RESULT matters, not the packaging
` : `
CONCEPT:
- This image answers: "Why should I buy THIS one instead of the cheaper alternative?"
- Show the quality difference the customer can FEEL through the image
- Close-up detail proves the quality claim visually
`}
- The headline states a clear BENEFIT, not just a feature name

🚫 NO FICTIONAL PROPS:
- Do NOT add magnifying glasses, rulers, hands pointing, arrows, or any props not in the reference
- Do NOT add visual gimmicks — let the product photography speak for itself
- Only the product and its REAL components/accessories should appear
- Use camera zoom/crop to show detail, NOT illustrated props

📐 CAMERA ANGLE — MUST BE DIFFERENT FROM OTHER IMAGES:
- ${pickRandom(closeupAngles)}
- ⚠️ Do NOT use the same straight-on front-facing angle as the main image

BACKGROUND:
- ${pickRandom(closeupBackgrounds)}
- Do NOT use white fur, fluffy fabric, or pet-hair-like surfaces

LAYOUT:
- ${strategy.isBeautyProduct ? pickRandom(beautyCloseupStyles) : pickRandom(closeupStyles)}
- ${strategy.isBeautyProduct ? "Show the RESULT of using the product — stunning nails/skin/lips that make the viewer want the same look" : "Zoom into the detail that proves the benefit: material thickness, reinforced edges, premium finish"}
- Use actual macro photography style — get close to the product surface

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.functionHeadline}"
- EXACT label texts (copy verbatim): "${strategy.functionBadge1}", "${strategy.functionBadge2}"
- ⚠️ Do NOT invent, rephrase, or expand the text above. Use ONLY these exact words.

STYLE:
- Premium close-up product photography
- Shallow depth of field, refined lighting
- Clean background
- 800x800px`,
        };

      case "dimensions":
        return {
          imageType,
          title: "Size guide",
          description: `${productName} — clear dimensions to eliminate sizing doubts.`,
          validationNotes: ["max 4 dimension labels", "overall size first"],
          prompt: `Create a refined dimensions image for ${productName}.

⚠️ ${langRule}
${cleanCornerRule}
${productIdentityRule}
${structureLockRule}
🔒 Show ONLY ONE product. Keep the product identical to the reference.
${colorRule}
${spellingRule}
${realisticExpectationRule}

📐 CAMERA ANGLE:
- ${pickRandom(dimensionsAngles)}
- A 3/4 angle is PREFERRED for dimensions images because it shows height, width, AND depth simultaneously

LAYOUT:
- Minimal white or pale gray background
- Show one full product view clearly
- Overall dimensions: length, width, height
- Maximum 4 total dimension labels
- Thin clean measurement lines
- Strong whitespace
- ⚠️ CRITICAL FOR REDUCING RETURNS: Include a common reference object for scale so the customer understands the REAL size
${strategy.isSmallProduct
  ? `- ⚠️ THIS IS A SMALL PRODUCT — show a human hand holding or placing the product to demonstrate its compact size. The customer MUST understand it is small BEFORE purchasing.
- Include a familiar reference object next to the product: a coin, a fingertip, or a pen cap
- Do NOT zoom in so much that the product appears larger than reality`
  : `- Show the product next to a familiar reference (e.g., a hand, a smartphone silhouette, a standard mug) for intuitive scale`}

TEXT RULES:
- Short labels only
- Small header: "Size Guide"
- Match these values: ${sanitizedAnalysis.estimatedDimensions}

STYLE:
- Premium brand size-guide look
- Elegant, restrained, easy to scan on mobile
- 800x800px`,
        };

      case "lifestyle": {
        const visibilityRule = getProductVisibilityRule(strategy.category, strategy.productName);
        const sceneGuide = getCategorySceneGuide(strategy.category, strategy.productName);
        return {
          imageType,
          title: "Lifestyle / usage scene",
          description: `${productName} — shows the product in real-world use, making the buyer envision owning it.`,
          validationNotes: ["one headline only", "single hero scene", "adult only"],
          prompt: `Create a premium lifestyle image for ${productName}.

⚠️ ${langRule}
${regionStyleRule}
${cleanCornerRule}
${productIdentityRule}
${structureLockRule}
${textSafeZoneRule}
${noCopyReferenceTextRule}
${strictBadgeRule}
${prohibitedWordsRule}
${spellingRule}
🔒 Show the exact product from the reference in realistic use. Adults only.
🔒 BOTTLE SHAPE CHECK: If the reference shows a SQUARE bottle, it MUST remain SQUARE in this scene. Do NOT round the corners or change to cylindrical. Compare your output silhouette to the reference before finalizing.
${colorRule}
${diversityRule}
${humanAnatomyRule}
${getHandInFrameRule("lifestyle")}
${visibilityRule}
${sceneGuide}

SCENE:
- Real-world scenario: ${strategy.scene1}
- Target customer: ${strategy.audience1}
- Mood: ${pickRandom(lifestyleMoods)}
- Composition: ${pickRandom(lifestyleCompositions)}
- The product must be clearly visible and being USED (not just sitting there)
- Show the RESULT of using the product — the customer's life is better
- ⚠️ The scene MUST match the product category — do NOT put fashion items in office scenes or jewelry in kitchens
- ⚠️ COLOR PROTECTION: Even in warm/golden-hour scenes, the PRODUCT must retain its TRUE color from the reference. Apply scene warmth to the environment ONLY, not to the product. Think of it as the product having its own white-balanced spotlight.
${strategy.isNailPolish ? `
🎨 NAIL POLISH LIFESTYLE — NAILS ARE THE HERO:
- The polished nails MUST be the most eye-catching element in the frame — large, in-focus, beautifully lit
- Show a woman's hand with perfectly polished nails as the CENTRAL subject of the scene
- The nail color MUST exactly match the product bottle color — no color drift from scene lighting
- Nails should catch light with a glossy, wet-look reflection that makes the color look rich and dimensional
- The product bottle should appear somewhere in the scene (on a table, in a bag, held in the other hand) but nails are PRIMARY
- Scene ideas: elegant dinner (hand holding wine glass), café moment (hand wrapped around coffee cup), getting ready (hand on vanity mirror edge)
- Every nail must look salon-perfect: smooth, even, no bubbles, no streaks, clean cuticle lines
- Do NOT show chipped, damaged, or poorly applied polish — this is ASPIRATIONAL imagery` : ""}

🚫 UNIVERSAL BANNED PROPS (check EVERY scene before finalizing):
- Do NOT include: laptop, computer, keyboard, mouse, notebook, planner, pen, pencil,
  desk lamp, office supplies, textbook, paperwork, briefcase, filing cabinet, sticky notes
- Do NOT include: exercise equipment, yoga mat, gym equipment, weights
- If ANY banned prop appears even partially in the background, REGENERATE without it
- The scene should feel aspirational and lifestyle-focused, NOT work-related or studious

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.resultHeadline}"
- ⚠️ Do NOT invent, rephrase, or expand the text above. Use ONLY these exact words.
- No subtitle, no extra labels

📷 PHOTOGRAPHIC REALISM:
- This MUST look like a real professional photograph, NOT an AI-generated render
- Natural imperfections: slight lens blur at edges, real skin texture, natural fabric wrinkles
- Single clear light source direction with natural falloff
- Depth of field must be physically realistic (f/1.8-2.8 equivalent for portrait/product shots)
- NO "AI glow": no unnaturally smooth skin, no perfect symmetry, no HDR over-processing
- Color grading: editorial magazine style, NOT Instagram filter look
- Real-world details: subtle scratches on props, natural wood grain variation, actual textile weave

STYLE:
- Aspirational lifestyle photography — the customer should think: "I want that life"
- The image must create DESIRE, not just inform
- Warm natural lighting with depth
- The product should look like something the viewer NEEDS, not just sees
- Show a REAL usage moment — the customer sees themselves in the photo and feels the product solving their problem
- The emotion in the image should be: satisfaction, confidence, joy, or relief — the customer AFTER using this product
- 800x800px`,
        };
      }

      case "packaging":
        return {
          imageType,
          title: "Value / why-choose image",
          description: `${productName} — convinces the buyer this is the best option in its category.`,
          validationNotes: ["no invented accessories", "competitive edge focus"],
          prompt: `Create a premium value-differentiation image for ${productName}.
Material: ${strategy.materials}

⚠️ ${langRule}
${cleanCornerRule}
${productIdentityRule}
${structureLockRule}
${textSafeZoneRule}
${noCopyReferenceTextRule}
${strictBadgeRule}
${prohibitedWordsRule}
${spellingRule}
${colorRule}
${getHandInFrameRule("packaging")}
🔒 Show only the actual product from the reference.

📐 CAMERA ANGLE — MUST BE DIFFERENT FROM OTHER IMAGES:
- ${pickRandom(valueAngles)}
- ⚠️ Do NOT use the same straight-on front-facing angle — each image in the listing set must show the product from a UNIQUE perspective

GOAL:
- Show why THIS product beats the generic alternatives
- Highlight material quality, quantity/count value, or unique design advantage
- Make the customer feel they're getting MORE for their money

LAYOUT:
- ${/nail.?polish|nail.?lacquer|nail.?hardener|hardener.?nail|lipstick|mascara|makeup|cosmetic|beauty|甲油|口红|化妆|美妆/.test(strategy.category + " " + strategy.productName)
  ? pickRandom([
      "Product bottle on a marble or glass surface with soft reflection, alongside a beautifully polished hand showing the result",
      "3/4 angle hero shot on a premium vanity surface with soft shadow, a hand with perfect nails resting nearby",
      "Eye-level studio shot with a clean gradient background, product next to swatches or a polished nail close-up",
      "Split composition: product bottle on left, stunning nail close-up on right showing the color payoff",
    ])
  : pickRandom([
      "Elegant top-down flat-lay with the product's real components or accessories around it",
      "3/4 angle hero shot on a premium surface with soft shadow",
      "Eye-level studio shot with a clean gradient background",
      "Overhead arrangement showing the product with its key components laid out neatly",
      "Dynamic low-angle shot making the product look impressive and premium",
    ])}
- Product as visual hero — COMPLETE and UNCUT, fully visible
- 🚫 Do NOT add random unrelated props (no food, nuts, crystals, leaves, or decorative items that have nothing to do with the product)
- Only show the product itself and items directly related to its use
- Clean premium spacing

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.valueHeadline}"
- Up to two support labels from this pre-approved list ONLY: ${strategy.aPlusLabels.slice(0, 2).filter(Boolean).map(l => `"${l}"`).join(", ")}
- ⚠️ Do NOT invent, rephrase, or expand the headline above. Use ONLY these exact words for the headline.
- ⚠️ Do NOT invent certification claims (e.g., "Formaldehyde-Free", "Dermatologist Tested", "FDA Approved", "Certified Organic") — ONLY use the pre-approved labels above
- ⚠️ Each support label must use UNIQUE words — do NOT repeat the same word twice in a single label
- No "What You Get" framing, no long explanations

STYLE:
- Premium comparison/value image
- Clean surface, balanced spacing
- Feels polished and trustworthy
- 800x800px`,
        };

      case "lifestyle2": {
        const aPlusSceneGuide = getCategorySceneGuide(strategy.category, strategy.productName);
        return {
          imageType,
          title: "A+ closing — 3 buying reasons",
          description: `${productName} — final persuasive image showing 3 distinct reasons to buy NOW.`,
          validationNotes: ["2-3 scenes only", "one label per scene", "each label is a buying reason"],
          prompt: `Create a premium A+ closing image for ${productName} — the FINAL image that convinces the customer to click "Add to Cart".

⚠️ ${langRule}
${regionStyleRule}
${cleanCornerRule}
${productIdentityRule}
${structureLockRule}
${strictSingleProductRule}
${brandSystemRule}
${textSafeZoneRule}
${noCopyReferenceTextRule}
${strictBadgeRule}
${prohibitedWordsRule}
${spellingRule}
🔒 Keep the product identical to the reference in every panel. Adults only.
🔒 BOTTLE SHAPE CHECK: If the reference shows a SQUARE bottle, it MUST remain SQUARE in every panel. Do NOT round the corners or change to cylindrical.
${colorRule}
${diversityRule}
${humanAnatomyRule}
${aPlusSceneGuide}

CONCEPT:
- This image gives the customer 3 clear REASONS TO BUY
- Each panel shows THE SAME PRODUCT (from reference) in a different use context
- After seeing this image, the customer should have no doubts left

🚨 CRITICAL — PRODUCT CONSISTENCY:
- EVERY panel must show the EXACT SAME product from the reference photos
- Do NOT substitute, replace, or swap the product with any other item
- Do NOT add unrelated products (no phone holders, no other accessories)
- If the product is a bottle cage, show ONLY a bottle cage in every panel
- Each panel = same product, different angle or usage scenario

LAYOUT:
- ${pickRandom(multiSceneLayouts)}
- Show 2 or 3 scenes only
- Each panel: the product in action + one benefit label
- Product visible and recognizable in every scene

📐 PANEL SIZE RULES — CRITICAL:
- In the HERO panel: product fills at least 40% of that panel's area
- In SECONDARY panels: product fills at least 30% of that panel's area
- The product must appear the SAME apparent size across panels (no tiny in one, huge in another)
- Each panel: 8px internal padding from panel edge to content

🎨 VISUAL CONSISTENCY ACROSS PANELS:
- Same color temperature across ALL panels (all warm OR all cool — NOT mixed)
- SAME product color in every panel (refer to COLOR LOCK above) — even if panels have different lighting moods, the PRODUCT color must be identical
- Same typography style: same font, same size, same text color for all labels
- Same border/divider treatment between all panels
- Labels positioned consistently (e.g., all at bottom-center of each panel)
- Overall feel: cohesive set, not 3 random images thrown together

SCENES (each = one buying reason):
1. "${strategy.aPlusLabels[0] || "Premium Quality"}" — ${strategy.scene1}
2. "${strategy.aPlusLabels[1] || "Easy to Use"}" — product detail or feature close-up
${strategy.aPlusLabels.length >= 3 ? `3. "${strategy.aPlusLabels[2]}" — ${strategy.scene2}` : ""}

TEXT RULES:
- EXACT label per scene (copy verbatim, do not modify): ${strategy.aPlusLabels.filter(Boolean).map(l => `"${l}"`).join(", ")}
- ⚠️ Do NOT invent, rephrase, or expand any label. Use ONLY these exact words.
- No subtitles, no paragraphs, no placeholders

STYLE:
- Premium brand A+ visual module
- Warm editorial lighting
- Clean scene separation with consistent borders
- Elegant, conversion-focused composition
- This is the LAST image before the customer decides — it must CLOSE THE SALE
- Every panel should answer a potential objection: quality, versatility, value
- The overall message: "This product fits perfectly into YOUR life"
- 800x800px`,
        };
      }

      case "comparison":
        return {
          imageType,
          title: "对比优势图 — Ours vs Theirs",
          description: `${productName} — side-by-side comparison showing why our product wins.`,
          validationNotes: ["no real brand names", "left=ours right=generic", "max 4 comparison rows"],
          prompt: `Create a COMPARISON image for ${productName} — "Ours vs. Ordinary" side-by-side.
${strategy.isNailPolish ? `
🚨🚨🚨 READ THIS FIRST — NAIL POLISH COMPARISON — #1 RULE:
The image MUST show HANDS WITH POLISHED NAILS on BOTH sides. This is the MOST IMPORTANT rule.
- LEFT: Our bottle + a hand with GORGEOUS polished nails (salon-quality, mirror-gloss, flawless)
- RIGHT: Generic bottle + a hand with MEDIOCRE polish (streaky, thin coverage, duller)
- Do NOT just show two bottles — bottles alone do NOT sell nail polish. The NAILS are the proof.
- The customer must SEE the quality difference ON ACTUAL NAILS, not just on bottles.
- If the generated image shows only bottles without nails, it is REJECTED. REGENERATE with nails.
` : ""}

⚠️ ${langRule}
${cleanCornerRule}
${productIdentityRule}
${textSafeZoneRule}
${noCopyReferenceTextRule}
${strictBadgeRule}
${prohibitedWordsRule}
${spellingRule}
🔒 Left side: the REAL product from the reference. Right side: a GENERIC plain version (no real brand).
${colorRule}

${strategy.isNailPolish ? `
CONCEPT — NAIL POLISH COMPARISON (NAILS ARE THE PROOF):
- This is a NAIL POLISH comparison — the customer cares about HOW IT LOOKS ON NAILS, not the bottle
- The image has TWO HALVES:
  - LEFT ("Ours" ✓): Our bottle in the background + a HAND with salon-quality polished nails in the foreground
  - RIGHT ("Ordinary" ✗): A generic bottle in the background + a HAND with mediocre polish (streaky, thinner, duller)
- The HANDS WITH POLISHED NAILS are the HERO elements — each hand fills at least 30% of its half
- The bottles are SECONDARY — smaller, behind or beside the hands
- Comparison rows below the hands show the text differences
- The customer sees the nail quality difference INSTANTLY and chooses ours

LAYOUT:
- Clean white background, split into two equal halves
- LEFT HALF (warm, premium lighting):
  - A female hand with 4 beautifully polished nails (thumb hidden), glossy, even, salon-perfect
  - Our product bottle placed behind/beside the hand, smaller
  - Header: "Ours" with ✓
- RIGHT HALF (cool, flat lighting):
  - A female hand with mediocre polish — slightly streaky, thinner coverage, less glossy
  - A generic plain bottle behind/beside the hand
  - Header: "Ordinary" with ✗
- Below each half: 2-3 comparison text rows with checkmarks/crosses
` : `
CONCEPT:
- Split the image into LEFT ("Ours" ✓) and RIGHT ("Ordinary" ✗)
- The customer instantly sees WHY our product is the better choice
- Use green checkmarks ✓ on the left, red crosses ✗ on the right
- Show 3-4 key differences that matter to the buyer
- ⚠️ CRITICAL: Left and right sides must show OPPOSITE descriptions — NOT the same text with different icons!
  - LEFT (✓): positive benefit of OUR product (e.g., "Quick Dry")
  - RIGHT (✗): the OPPOSITE problem of the generic product (e.g., "Slow Dry Time")

LAYOUT:
- Clean white background
- Two columns: LEFT = our product (bright, premium, warm lighting), RIGHT = generic (dull, desaturated, cheap-looking)
- Header: "Ours (premium)" / "Ordinary (dull)" — make the labels emotionally charged
- 3-4 comparison rows with icons (✓ green checkmarks on left, ✗ red crosses on right)
- STRONG visual contrast: our side should look PREMIUM and DESIRABLE, their side should look CHEAP and UNAPPEALING
- Our product: crisp, well-lit, saturated colors, premium positioning
- Generic product: slightly blurred, washed out, cheaper materials look, dull colors
- The visual difference should be IMMEDIATELY obvious — customer decides in 1 second
`}

COMPARISON ROWS — USE THESE EXACT TEXTS (LEFT ✓ vs RIGHT ✗):
- Row 1 LEFT ✓: "${strategy.comparisonBadges[0]}"  →  Row 1 RIGHT ✗: "${strategy.comparisonOpposites[0] || "Basic Quality"}"
- Row 2 LEFT ✓: "${strategy.comparisonBadges[1]}"  →  Row 2 RIGHT ✗: "${strategy.comparisonOpposites[1] || "Falls Short"}"
- Row 3 LEFT ✓: "${strategy.comparisonBadges[2] || "Premium Quality"}"  →  Row 3 RIGHT ✗: "${strategy.comparisonOpposites[2] || "Cheap Feel"}"
- ⚠️ Copy each text VERBATIM — do NOT rephrase, merge, or repeat left-side text on the right side

TEXT RULES:
- Short labels only (2-3 words per comparison point)
- ⚠️ Do NOT use any real brand names — use "Ordinary" or "Basic" for the generic side
- No paragraphs or long descriptions
- Each comparison point should name a BENEFIT the customer cares about, not just a feature

📋 TEXT MANIFEST — COPY VERBATIM (these are the ONLY texts on this image):
- Header Left: "Ours"
- Header Right: "Ordinary"
- Row 1 LEFT ✓: "${strategy.comparisonBadges[0]}"  |  Row 1 RIGHT ✗: "${strategy.comparisonOpposites[0] || "Basic Quality"}"
- Row 2 LEFT ✓: "${strategy.comparisonBadges[1]}"  |  Row 2 RIGHT ✗: "${strategy.comparisonOpposites[1] || "Falls Short"}"
- Row 3 LEFT ✓: "${strategy.comparisonBadges[2] || "Premium Quality"}"  |  Row 3 RIGHT ✗: "${strategy.comparisonOpposites[2] || "Cheap Feel"}"
⚠️ CRITICAL: The LEFT text and RIGHT text in each row are DIFFERENT WORDS. Do NOT copy the left text to the right side.
Spell each word EXACTLY as shown above — letter by letter. Do NOT invent any additional text.

STYLE:
- Clean Amazon comparison infographic that SELLS
- Bold, scannable on mobile — the customer decides in under 2 seconds
- High contrast between the two sides — night and day difference
- The customer should think: "Obviously I want the left one"
- 800x800px`,
        };

      default:
        return {
          imageType,
          title: IMAGE_TYPE_LABELS[imageType],
          description: `${productName} professional product image`,
          prompt: `Create a professional product image for ${productName}. Clean background. Premium commercial look. 800x800px.`,
        };
    }
  });
}
