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
  { pattern: /heal|chakra|energy|spiritual|meditation|瑜伽|冥想/i,
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
    painPoint: "Salon-Quality Color", benefit: "Rich Pigment Formula", badge: "Vivid Color" },
  { pattern: /quick.?dry|fast.?dry|速干/i,
    painPoint: "No More Waiting", benefit: "Quick Dry Formula", badge: "Quick Dry" },
  { pattern: /chip.?resist|long.?lasting|持久|不掉色/i,
    painPoint: "Color That Lasts", benefit: "Chip-Resistant Finish", badge: "Long Wear" },
  { pattern: /gel|凝胶/i,
    painPoint: "Gel-Like Shine", benefit: "Mirror-Finish Gloss", badge: "Gel Finish" },
  { pattern: /matte|哑光/i,
    painPoint: "Smooth Matte Look", benefit: "Velvet Matte Finish", badge: "Matte" },
  { pattern: /glitter|shimmer|metallic|闪|金属光泽/i,
    painPoint: "Eye-Catching Sparkle", benefit: "Metallic Shimmer Finish", badge: "Shimmer" },
  { pattern: /lipstick|lip.?gloss|口红|唇膏|唇彩/i,
    painPoint: "Bold Lip Color", benefit: "Smooth Application", badge: "Creamy" },
  { pattern: /mascara|睫毛膏/i,
    painPoint: "Dramatic Lashes", benefit: "Volume & Length", badge: "Volumizing" },
  { pattern: /foundation|粉底/i,
    painPoint: "Flawless Coverage", benefit: "Lightweight Formula", badge: "Blendable" },
  { pattern: /eyeshadow|eye.?shadow|眼影/i,
    painPoint: "Vibrant Eye Color", benefit: "Highly Pigmented", badge: "Pigmented" },
  { pattern: /skincare|serum|moisturiz|cream|lotion|护肤|精华|面霜/i,
    painPoint: "Healthy Glow", benefit: "Nourishing Formula", badge: "Hydrating" },
  { pattern: /sunscreen|spf|防晒/i,
    painPoint: "Daily Sun Protection", benefit: "Lightweight SPF Shield", badge: "UV Shield" },
  { pattern: /makeup|cosmetic|beauty|化妆|美妆/i,
    painPoint: "Effortless Beauty", benefit: "Professional Finish", badge: "Pro Finish" },
  { pattern: /brush|applicator|刷子|化妆刷/i,
    painPoint: "Flawless Application", benefit: "Soft Bristle Design", badge: "Soft Touch" },

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

  // Match each selling point to a benefit
  const matched: BenefitMatch[] = [];
  const usedPatterns = new Set<string>();
  for (const sp of sellingPoints) {
    const m = matchBenefit(sp);
    if (m && !usedPatterns.has(m.painPoint)) {
      matched.push(m);
      usedPatterns.add(m.painPoint);
    }
  }
  // Also check materials for extra matches
  const matMatch = matchBenefit(materials);
  if (matMatch && !usedPatterns.has(matMatch.painPoint)) {
    matched.push(matMatch);
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
    const nailHeadlines = ["Salon-Quality Color", "Color That Pops", "Bold & Beautiful", "Flawless Finish"];
    return nailHeadlines[Math.floor(Math.random() * nailHeadlines.length)];
  }
  if (/lipstick|lip.?gloss|口红|唇膏/.test(ctx2)) return "Bold Lip, Bold You";
  if (/mascara|睫毛膏/.test(ctx2)) return "Lash Out Loud";
  if (/foundation|粉底/.test(ctx2)) return "Flawless All Day";
  if (/eyeshadow|eye.?shadow|眼影/.test(ctx2)) return "Eyes That Dazzle";
  if (/skincare|serum|moisturiz|cream|lotion|护肤|精华|面霜/.test(ctx2)) return "Glow From Within";
  if (/sunscreen|spf|防晒/.test(ctx2)) return "Sun-Ready Skin";
  if (/makeup|cosmetic|beauty|化妆|美妆/.test(cat)) {
    const beautyHeadlines = ["Effortless Beauty", "Look Your Best", "Beauty Made Simple", "Glow Up"];
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
      "getting ready for a night out — vanity mirror, warm lighting, elegant setting",
      "relaxing self-care evening at home — cozy bathroom, candles, soft light",
      "at a chic café showing off manicured nails while holding a coffee cup",
      "having a girls' night getting ready together — fun, cheerful atmosphere",
      "elegant dinner setting — table, wine glass, soft candlelight",
      "casual weekend brunch — bright natural light, stylish outfit",
    ];
    const chosenScene = beautyScenes[Math.floor(Math.random() * beautyScenes.length)];
    return `
🎬 SCENE DIRECTION (Beauty/Cosmetics):
- USE THIS SPECIFIC SCENE: ${chosenScene}
- Show the product being USED or the RESULT of using it (e.g., painted nails, applied makeup)
- Background: glamorous but approachable, warm tones, soft lighting
- Do NOT use: office/work scenes, gym, kitchen, industrial settings
- Do NOT use: construction/hardware language in any text overlays
- The model should look confident, stylish, and beautiful
- For nail polish: focus on the NAILS — show painted nails prominently with the bottle nearby
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
  if (/nail.?polish|nail.?lacquer|甲油|指甲油/.test(ctx)) return "Salon-Grade Formula";
  if (/lipstick|lip.?gloss|口红|唇膏/.test(ctx)) return "Rich Color Payoff";
  if (/mascara|睫毛膏/.test(ctx)) return "Dramatic Volume";
  if (/foundation|粉底/.test(ctx)) return "Smooth Coverage";
  if (/eyeshadow|eye.?shadow|眼影/.test(ctx)) return "Vivid Pigment";
  if (/skincare|serum|moisturiz|cream|lotion|护肤|精华|面霜/.test(ctx)) return "Nourishing Formula";
  if (/makeup|cosmetic|beauty|化妆|美妆/.test(ctx)) return "Professional Quality";

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
  "Use a cropped inset panel to show one meaningful detail up close",
  "Split the image: full product on the left, macro detail on the right",
  "Use shallow depth-of-field to draw the eye to one premium component",
];

const closeupBackgrounds = [
  "clean white marble surface with soft natural side lighting",
  "matte dark slate surface for high-contrast detail visibility",
  "light linen fabric with subtle texture — NOT white fur or fluffy fabric",
  "neutral concrete or stone surface with minimal texture",
  "warm wood grain surface with soft overhead lighting",
];

const lifestyleMoods = [
  "golden-hour warmth with soft natural light",
  "bright natural daylight with a clean airy feel",
  "warm editorial home lighting with gentle shadow depth",
];

const lifestyleCompositions = [
  "product in the foreground with a softly blurred environment behind it",
  "medium lifestyle composition with the product clearly readable in use",
  "wide scene with the product as the visual anchor",
];

const multiSceneLayouts = [
  "HERO + THUMBNAILS — one large main scene on top, 2-3 smaller scenes below",
  "TRIPTYCH — three clean vertical panels with consistent spacing",
  "TWO CLEAN PANELS — one hero lifestyle panel plus one supporting use-case panel",
  "DIAGONAL SPLIT — two elegant scenes divided by a clean diagonal line",
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
- Maximum badges per image: 2 (unless TEXT RULES specify fewer)
- If TEXT RULES say 2 badges, show exactly 2. If it says 0, show 0.
`;

  const humanAnatomyRule = `
🚨 HUMAN ANATOMY — CRITICAL:
- If people appear in the image, their hands and fingers MUST have correct anatomy
- Hands must have exactly 5 fingers each (no more, no less) with natural proportions and joints
- Each finger must have exactly 3 visible segments (phalanges) with natural bending
- Thumbs must be clearly distinct from other fingers — shorter, thicker, and opposable
- Do NOT show close-up hands holding/wearing the product if it risks deformed fingers
- PREFER: show people from a wider angle (waist-up, full body) to minimize hand detail issues
- PREFER: show the product in use WITHOUT focusing on hand/finger close-ups
- If the product is worn on hands (rings, bracelets, gloves), show from a distance where minor hand imperfections are less visible
- All human body proportions must look natural — no extra limbs, merged fingers, or distorted joints
- Fingernails must be natural shape and size — no missing or duplicated nails
`;

  // 产品颜色还原规则 — 基于分析结果中的颜色信息
  const colorAccuracyRule = (colors: string) => colors ? `
🎨 COLOR ACCURACY — CRITICAL:
- The product color MUST match the reference photos EXACTLY
- Product colors from analysis: ${colors}
- Do NOT shift, brighten, desaturate, or alter the product color
- If the reference shows deep blue, generate deep blue — not light blue or teal
- If the reference shows red/crimson, generate red/crimson — not orange or pink
- Color accuracy is MORE important than artistic style
- Background and lighting should NOT wash out or shift the product color
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
${colorRule}
🔒 Show ONE product only. Match the reference product exactly.

CONCEPT:
- This image addresses a CUSTOMER PROBLEM and shows the product as the SOLUTION
- The headline names the pain point the customer recognizes from daily life
- The customer should feel: "Yes, that's exactly my problem — and this product fixes it!"

VISUAL STORYTELLING:
- Show a subtle before/after or problem→solution contrast
- Product is the HERO — it's the answer to the problem
- Clean background, product as focal point
- Strong whitespace, premium feel

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.painPointHeadline}"
- EXACT badge texts (copy verbatim): "${strategy.painPointBadge1}", "${strategy.painPointBadge2}"
- ⚠️ Do NOT invent, rephrase, or expand the text above. Use ONLY these exact words.
- No paragraph text, no long descriptions

STYLE:
- Premium Amazon listing image
- Bold, clear headline typography
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
${colorRule}
🔒 Show ONLY ONE product. Keep the product identical to the reference.

CONCEPT:
- This image answers: "Why should I buy THIS one instead of the cheaper alternative?"
- Show the quality difference the customer can FEEL through the image
- The headline states a clear BENEFIT, not just a feature name
- Close-up detail proves the quality claim visually

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

TEXT RULES:
- EXACT headline text (copy verbatim, do not modify): "${strategy.resultHeadline}"
- ⚠️ Do NOT invent, rephrase, or expand the text above. Use ONLY these exact words.
- No subtitle, no extra labels

STYLE:
- Aspirational lifestyle photography
- Warm natural lighting
- Soft depth of field
- The customer should think: "I want that life"
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
${colorRule}
🔒 Show only the actual product from the reference.

GOAL:
- Show why THIS product beats the generic alternatives
- Highlight material quality, quantity/count value, or unique design advantage
- Make the customer feel they're getting MORE for their money

LAYOUT:
- Elegant top-down or structured display
- Product as visual hero
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

      case "lifestyle2":
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
🔒 Keep the product identical to the reference in every panel. Adults only.
${colorRule}
${diversityRule}
${humanAnatomyRule}

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
🔒 Left side: the REAL product from the reference. Right side: a GENERIC plain version (no real brand).

CONCEPT:
- Split the image into LEFT ("Ours" ✓) and RIGHT ("Ordinary" ✗)
- The customer instantly sees WHY our product is the better choice
- Use green checkmarks ✓ on the left, red crosses ✗ on the right
- Show 3-4 key differences that matter to the buyer

COMPARISON POINTS (pick 3-4 that apply):
- "${strategy.painPointHeadline}" — our product solves this, the generic doesn't
- "${strategy.comparisonBadges[0]}" vs generic equivalent
- "${strategy.comparisonBadges[1]}" vs generic equivalent
- "${strategy.comparisonBadges[2] || "Premium Quality"}" vs generic equivalent

LAYOUT:
- Clean white background
- Two columns: LEFT = our product (bright, premium), RIGHT = generic (dull, cheap-looking)
- Header: "Ours" / "Ordinary" or "Premium" / "Basic"
- 3-4 comparison rows with icons (✓ / ✗)
- Strong visual contrast: our side looks premium, their side looks cheap

TEXT RULES:
- Short labels only (2-3 words per comparison point)
- ⚠️ Do NOT use any real brand names — use "Ordinary" or "Basic" for the generic side
- No paragraphs or long descriptions

STYLE:
- Clean Amazon comparison infographic
- Bold, scannable on mobile
- High contrast between the two sides
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
