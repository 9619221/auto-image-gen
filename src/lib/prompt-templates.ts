import type { AnalysisResult, ImageType, ImagePlan, SalesRegion } from "./types";
import { IMAGE_TYPE_LABELS, REGION_CONFIGS, regionToLanguage, LANGUAGE_ENGLISH_NAMES } from "./types";
import { filterProhibitedWords } from "./prohibited-words";

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
    painPoint: "Streaky Application?", benefit: "Flawless Every Stroke", badge: "Soft Touch" },

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
    "Premium": "Cheap Material",
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
    // Jewelry
    "Calming": "No Character",
    "Cat-Eye": "Plain Stone",
    "Multi-Wrap": "Basic Band",
    "Layered": "Single Strand",
    // Electronics
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

function inferProductStrategy(analysis: AnalysisResult) {
  const productName = toEnglish(analysis.productName);
  const category = toEnglish(analysis.category || "");
  const sellingPoints = toEnglishArray(analysis.sellingPoints || []);
  const usageScenes = toEnglishArray(analysis.usageScenes || []);
  const targetAudience = toEnglishArray(analysis.targetAudience || []);
  const materials = toEnglish(analysis.materials || "");

  // Detect if this is a beauty/cosmetics product — to filter out spiritual/meditation badges
  const isBeautyProduct = /nail.?polish|nail.?lacquer|lipstick|mascara|makeup|cosmetic|beauty|eyeshadow|foundation|skincare|甲油|指甲油|口红|化妆|美妆|护肤/.test(
    `${category} ${productName}`.toLowerCase()
  );

  // Badges that should NOT appear on beauty products (spiritual/meditation context)
  const beautyBannedBadges = new Set(["Calming", "Natural", "Kyanite", "Agate", "Crystal", "Jade", "Cat-Eye"]);

  // Match each selling point to a benefit
  const matched: BenefitMatch[] = [];
  const usedPatterns = new Set<string>();
  for (const sp of sellingPoints) {
    const m = matchBenefit(sp);
    if (m && !usedPatterns.has(m.painPoint)) {
      // Skip spiritual/gemstone badges for beauty products
      if (isBeautyProduct && beautyBannedBadges.has(m.badge)) continue;
      matched.push(m);
      usedPatterns.add(m.painPoint);
    }
  }
  // Also check materials for extra matches
  const matMatch = matchBenefit(materials);
  if (matMatch && !usedPatterns.has(matMatch.painPoint)) {
    if (!(isBeautyProduct && beautyBannedBadges.has(matMatch.badge))) {
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
  const functionBadge2 = matched[2].badge;

  // Lifestyle: result headline from scene context
  const resultHeadline = deriveResultHeadline(scene1, audience1, category, materials);

  // Value: why choose this product
  const valueHeadline = deriveValueHeadline(category, productName, materials);

  // A+ labels: 3 distinct buying reasons (benefit phrases)
  const aPlusLabels = uniqueLabels([
    matched[0].benefit,
    matched[1].benefit,
    matched[2].benefit,
  ]).slice(0, 3);

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
  };
}

/** Category-aware fallbacks — no fake claims */
function getCategoryFallbacks(category: string, productName: string, materials: string): BenefitMatch[] {
  const ctx = `${category} ${productName} ${materials}`.toLowerCase();

  // Jewelry / gemstone / accessories
  if (/ring|jewel|necklace|bracelet|earring|pendant|charm|bead|gem|stone|crystal|agate|kyanite|jade|quartz|饰品|戒指|项链|手链|耳环|珠|水晶|玛瑙/.test(ctx)) {
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
    { pattern: /^$/, painPoint: "Thoughtful Gift", benefit: "Gift-Ready", badge: "Gift Idea" },
  ];
}

function deriveResultHeadline(scene: string, audience: string, category: string, materials?: string): string {
  // Use CATEGORY + MATERIAL as primary signal
  const cat = category.toLowerCase();
  const mat = (materials || "").toLowerCase();
  const ctx2 = `${cat} ${mat}`;

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
  if (/ring|jewel|necklace|bracelet|earring|pendant|charm|accessori|饰品|戒指|项链|手链|耳环/.test(cat)) {
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

  // Electronics / Tech
  if (/charg|cable|adapter|充电|数据线/.test(ctx2)) return "Stay Powered Up";
  if (/headphone|earphone|earbud|speaker|耳机|音箱/.test(ctx2)) return "Sound Perfected";
  if (/phone.?case|手机壳/.test(ctx2)) return "Style & Protection";
  if (/keyboard|mouse|键盘|鼠标/.test(ctx2)) return "Type in Comfort";
  if (/light|lamp|led|灯/.test(ctx2)) return "Light Up Your Space";

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
  if (/ring|jewel|necklace|bracelet|earring|pendant|charm|watch|戒指|项链|手链|耳环|手表|饰品/.test(ctx)) {
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

  if (/ring|jewel|necklace|bracelet|earring|pendant|charm|饰品|戒指|项链|手链|耳环/.test(ctx)) {
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

  // Jewelry / gemstone — material authenticity
  if (/kyanite|蓝晶石/.test(ctx)) return "Genuine Kyanite";
  if (/agate|玛瑙/.test(ctx)) return "Genuine Natural Agate";
  if (/crystal|水晶|quartz/.test(ctx)) return "Real Crystal Stone";
  if (/jade|翡翠|玉/.test(ctx)) return "Authentic Jade";
  if (/ring|jewel|necklace|bracelet|earring|pendant|charm|bead|gem|stone|饰品|戒指|项链|手链|耳环|珠/.test(ctx)) return "Natural Stone Quality";

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

  // Electronics / Tech
  if (/charg|cable|adapter|充电|数据线/.test(ctx)) return "Fast & Reliable";
  if (/headphone|earphone|earbud|speaker|耳机|音箱/.test(ctx)) return "Clear Sound Quality";
  if (/phone.?case|手机壳/.test(ctx)) return "Tough Protection";
  if (/keyboard|mouse|键盘|鼠标/.test(ctx)) return "Precision Control";

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

const mainLighting = [
  "Professional studio lighting with soft, even illumination and subtle rim light",
  "Clean butterfly lighting with a gentle gradient shadow beneath the product",
  "Bright, airy studio lighting with a soft reflection on the surface below",
  "Dramatic studio lighting with one key light creating elegant shadow play",
];

const closeupStyles = [
  "Use a cropped inset panel to show one meaningful detail up close — shoot from a 45-degree angle",
  "Split the image: full product on the left, macro detail on the right — use a top-down perspective for the detail",
  "Use shallow depth-of-field to draw the eye to one premium component — shoot at eye level",
  "Hero product shot from a low angle with one detail callout in the corner",
  "Overhead/flat-lay style with the product and one zoomed-in detail circle",
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
- PRODUCT LABEL TEXT: If the product has text/labels on it, keep them READABLE and SHARP
  - Brand name, product name, and key info should be legible (not blurry or warped)
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
`;

  const strategy = inferProductStrategy(analysis);
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
- SAFER ALTERNATIVES when hands are risky:
  * Show just fingertips (4 visible fingers, thumb hidden)
  * Show from wrist-up at an angle where some fingers overlap naturally
  * Show hands partially obscured by holding an object
  * Use a wider shot where hand details are less critical
- Thumbs must be clearly distinct — shorter, thicker, opposable
- Each finger: 3 segments with natural bending
- Fingernails: exactly ONE per finger, natural shape
- All body proportions natural — no extra limbs, merged fingers, distorted joints
`;

  // 产品颜色还原规则 — 基于分析结果中的颜色信息
  const colorAccuracyRule = (colors: string) => colors ? `
🎨 COLOR ACCURACY — CRITICAL (HIGHEST PRIORITY):
🔒 COLOR LOCK: This product is ${colors}. Lock this EXACT color before generating. Every pixel of the product MUST match this locked color across ALL images.

- The product color MUST match the reference photos EXACTLY — this is the #1 rule above ALL artistic choices
- Product colors: ${colors}
- BEFORE generating: study the reference photo, identify the PRECISE hue/saturation/brightness of the product, and LOCK that value
- Do NOT shift, brighten, desaturate, warm up, cool down, or alter the product color in ANY way
- If the reference shows deep blue → generate deep blue (NOT light blue, teal, or navy)
- If the reference shows red/crimson → generate red/crimson (NOT orange, pink, or maroon)
- If the reference shows nude/beige → generate the EXACT same nude/beige tone (NOT lighter, darker, more yellow, or more pink)
- WRONG EXAMPLES: reference=dusty rose but generated=coral/peach/salmon. reference=nude beige but generated=golden/yellow. These are FAILURES.
- Color accuracy is MORE important than artistic style, lighting mood, or background aesthetics
- Background and lighting MUST be neutral — do NOT let them color-cast onto the product
- Use neutral gray, white, or complementary backgrounds that preserve the product's true color
- In lifestyle scenes: the product RETAINS its EXACT color even under warm golden-hour or cool blue lighting
- NEVER let scene lighting shift the perceived product color
- This image is part of an 8-image Amazon listing set — the product color MUST be IDENTICAL across all 8 images
` : "";

  // 模特多样性规则
  const modelDiversityRule = `
👥 MODEL DIVERSITY:
- Use models of VARIED ethnicities and skin tones (East Asian, South Asian, Black, Hispanic, Caucasian, Middle Eastern)
- Do NOT default to only Caucasian/white models
- Pick a model ethnicity that feels natural for the product and target market
- All models should look natural, confident, and relatable
`;

  // 动态规则实例化
  const colorRule = colorAccuracyRule(analysis.colors || "");
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
- ${pickRandom(mainAngles)}
- ${pickRandom(mainLighting)}
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

      case "features":
        return {
          imageType,
          title: "Pain-point / benefit image",
          description: `${productName} — addresses customer pain point and shows the product as the solution.`,
          validationNotes: ["headline is a question or problem statement", "max 2 badges", "single product only"],
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

VISUAL STORYTELLING:
- Show a clear problem→solution visual narrative
- Product is the HERO — it's the answer to the problem
- Clean background, product as focal point
- Strong whitespace, premium feel
- The image should trigger an EMOTIONAL response: "Yes, that's MY problem — and this fixes it!"
${/nail.?polish|nail.?lacquer|lipstick|mascara|foundation|eyeshadow|makeup|cosmetic|beauty|甲油|口红|化妆|美妆/.test(strategy.category + " " + strategy.productName) ? `
🎨 BEAUTY-SPECIFIC VISUAL (CRITICAL):
- SPLIT COMPOSITION: Left side shows a hand with clean, bare/natural nails (plain but NOT ugly or damaged).
  Right side shows the SAME hand with gorgeously polished nails using this product.
- ⚠️ The polished nails on the "after" side MUST be the EXACT SAME COLOR as the product in the bottle (refer to COLOR LOCK)
- Do NOT use a different nail color (no dark brown, no red, no pink if the product is nude/beige)
- The "after" side must be ASPIRATIONAL: glossy, even, salon-quality finish that makes viewers want the same look
- The product bottle appears between the two sides as the visual "bridge" / solution
- The bare side should look neutral and clean — the polished side should look STUNNING in the product's EXACT color
- Light should catch the polish to show depth, dimension, and wet-gloss shine
- This before→after transformation is the #1 conversion driver for beauty products
` : ""}

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.painPointHeadline}"
- EXACT badge texts (copy verbatim): "${strategy.painPointBadge1}", "${strategy.painPointBadge2}", "${strategy.functionBadge1}", "${strategy.functionBadge2}"
- ⚠️ Do NOT invent, rephrase, or expand the text above. Use ONLY these exact words.
- No paragraph text, no long descriptions

📋 TEXT MANIFEST (ONLY these texts appear on this image):
1. Headline: "${strategy.painPointHeadline}"
2. Badge: "${strategy.painPointBadge1}"
3. Badge: "${strategy.painPointBadge2}"
4. Badge: "${strategy.functionBadge1}"
5. Badge: "${strategy.functionBadge2}"
TOTAL: up to 5 text elements (1 headline + up to 4 badges). Do NOT add ANY text not listed above.
Spell each word EXACTLY as shown — letter by letter.

STYLE:
- Premium Amazon listing image that makes the customer STOP scrolling
- Bold, clear headline typography that reads instantly on mobile
- The headline should hit like a punch — the customer immediately recognizes their problem
- 800x800px`,
        };

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
🔒 Show ONLY ONE product. Keep the product identical to the reference.

CONCEPT:
- This image answers: "Why should I buy THIS one instead of the cheaper alternative?"
- Show the quality difference the customer can FEEL through the image
- The headline states a clear BENEFIT, not just a feature name
- Close-up detail proves the quality claim visually
- For BEAUTY/COSMETICS products (nail polish, lipstick, etc.): show the STUNNING RESULT of using the product
  - NAIL POLISH: Show a CLOSE-UP of gorgeously polished nails — wet-gloss fresh, perfect cuticles, even application
  - Shoot at a slight angle to catch light reflection showing the depth, dimension, and richness of the color
  - Include the product bottle nearby for color reference — showing the bottle and nails match EXACTLY
  - The nails should look so beautiful that viewers IMMEDIATELY want the same color on their own nails
  - Use soft directional lighting that creates a highlight streak across the nail surface
  - Do NOT show "before" images with damaged/dirty/chipped nails
  - Do NOT show ugly/negative imagery — only show the ASPIRATIONAL result
  - If comparing, show ONLY two positive results (e.g., shimmer vs matte), never negative examples

🚫 NO FICTIONAL PROPS:
- Do NOT add magnifying glasses, rulers, hands pointing, arrows, or any props not in the reference
- Do NOT add visual gimmicks — let the product photography speak for itself
- Only the product and its REAL components/accessories should appear
- Use camera zoom/crop to show detail, NOT illustrated props

BACKGROUND:
- ${pickRandom(closeupBackgrounds)}
- Do NOT use white fur, fluffy fabric, or pet-hair-like surfaces

LAYOUT:
- ${pickRandom(closeupStyles)}
- Zoom into the detail that proves the benefit: material thickness, reinforced edges, premium finish
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

LAYOUT:
- Minimal white or pale gray background
- Show one full product view clearly
- Overall dimensions: length, width, height
- Maximum 4 total dimension labels
- Thin clean measurement lines
- Strong whitespace

TEXT RULES:
- Short labels only
- Small header: "Size Guide"
- Match these values: ${analysis.estimatedDimensions}

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
${colorRule}
${diversityRule}
${humanAnatomyRule}
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
🔒 Show only the actual product from the reference.

GOAL:
- Show why THIS product beats the generic alternatives
- Highlight material quality, quantity/count value, or unique design advantage
- Make the customer feel they're getting MORE for their money

LAYOUT:
- ${pickRandom(["Elegant top-down flat-lay with ingredients/materials around the product", "3/4 angle hero shot on a premium surface with soft shadow", "Eye-level studio shot with a clean gradient background", "Overhead arrangement showing the product with its key components laid out neatly", "Dynamic low-angle shot making the product look impressive and premium"])}
- Product as visual hero — COMPLETE and UNCUT, fully visible
- Clean premium spacing

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.valueHeadline}"
- Up to two support labels highlighting concrete advantages (e.g., material, count, certification)
- ⚠️ Do NOT invent, rephrase, or expand the headline above. Use ONLY these exact words for the headline.
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
- SAME product color in every panel (refer to COLOR LOCK above)
- Same typography style: same font, same size, same text color for all labels
- Same border/divider treatment between all panels
- Labels positioned consistently (e.g., all at bottom-center of each panel)
- Overall feel: cohesive set, not 3 random images thrown together

SCENES (each = one buying reason):
1. "${strategy.aPlusLabels[0]}" — ${strategy.scene1}
2. "${strategy.aPlusLabels[1]}" — product detail or feature close-up
3. "${strategy.aPlusLabels[2]}" — ${strategy.scene2}

TEXT RULES:
- EXACT label per scene (copy verbatim, do not modify): "${strategy.aPlusLabels[0]}", "${strategy.aPlusLabels[1]}", "${strategy.aPlusLabels[2]}"
- ⚠️ Do NOT invent, rephrase, or expand any label. Use ONLY these exact words.
- No subtitles, no paragraphs, no placeholders

STYLE:
- Premium brand A+ visual module
- Warm editorial lighting
- Clean scene separation with consistent borders
- Elegant, conversion-focused composition
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

CONCEPT:
- Split the image into LEFT ("Ours" ✓) and RIGHT ("Ordinary" ✗)
- The customer instantly sees WHY our product is the better choice
- Use green checkmarks ✓ on the left, red crosses ✗ on the right
- Show 3-4 key differences that matter to the buyer
- ⚠️ CRITICAL: Left and right sides must show OPPOSITE descriptions — NOT the same text with different icons!
  - LEFT (✓): positive benefit of OUR product (e.g., "Quick Dry")
  - RIGHT (✗): the OPPOSITE problem of the generic product (e.g., "Slow Dry Time")

COMPARISON ROWS — USE THESE EXACT TEXTS (LEFT ✓ vs RIGHT ✗):
- Row 1 LEFT ✓: "${strategy.comparisonBadges[0]}"  →  Row 1 RIGHT ✗: "${strategy.comparisonOpposites[0] || "Basic Quality"}"
- Row 2 LEFT ✓: "${strategy.comparisonBadges[1]}"  →  Row 2 RIGHT ✗: "${strategy.comparisonOpposites[1] || "Falls Short"}"
- Row 3 LEFT ✓: "${strategy.comparisonBadges[2] || "Premium Quality"}"  →  Row 3 RIGHT ✗: "${strategy.comparisonOpposites[2] || "Cheap Feel"}"
- ⚠️ Copy each text VERBATIM — do NOT rephrase, merge, or repeat left-side text on the right side

LAYOUT:
- Clean white background
- Two columns: LEFT = our product (bright, premium, warm lighting), RIGHT = generic (dull, desaturated, cheap-looking)
- Header: "Ours (premium)" / "Ordinary (dull)" — make the labels emotionally charged
- 3-4 comparison rows with icons (✓ green checkmarks on left, ✗ red crosses on right)
- STRONG visual contrast: our side should look PREMIUM and DESIRABLE, their side should look CHEAP and UNAPPEALING
- Our product: crisp, well-lit, saturated colors, premium positioning
- Generic product: slightly blurred, washed out, cheaper materials look, dull colors
- The visual difference should be IMMEDIATELY obvious — customer decides in 1 second

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
