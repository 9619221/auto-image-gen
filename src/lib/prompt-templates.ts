import type { AnalysisResult, ImageType, ImagePlan, SalesRegion } from "./types";
import { IMAGE_TYPE_LABELS, REGION_CONFIGS, regionToLanguage, LANGUAGE_ENGLISH_NAMES } from "./types";

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
  // Cleaning / disposable
  { pattern: /dispos|one.?time|throw.?away|no.?clean|no.?wash|skip.?clean/i,
    painPoint: "Hate Doing Dishes?",  benefit: "Zero Cleanup", badge: "Use & Toss" },
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
    painPoint: "100% Food Safe", benefit: "Safe for Your Family", badge: "Food-Safe" },
  // Non-stick
  { pattern: /non.?stick|easy.?release|no.?stick|food.?release/i,
    painPoint: "Food Slides Right Off", benefit: "Non-Stick Surface", badge: "Non-Stick" },
  // Eco-friendly
  { pattern: /eco.?friend|recyclable|sustain|green|biodegradable|compostable/i,
    painPoint: "Better for the Planet", benefit: "Eco-Friendly Choice", badge: "Eco-Friendly" },
  // Stackable / storage
  { pattern: /stackab|nest|compact.?stor|space.?sav|flat.?pack/i,
    painPoint: "Saves Cabinet Space", benefit: "Stackable Design", badge: "Stackable" },
  // Premium / quality
  { pattern: /premium|high.?quality|profession|commercial.?grade/i,
    painPoint: "Restaurant Quality at Home", benefit: "Premium Grade", badge: "Pro Quality" },
  // With lid / cover
  { pattern: /with.?lid|lid.?includ|cover|seal.?tight/i,
    painPoint: "Keep Food Fresh", benefit: "Lid Included", badge: "With Lid" },
  // Aluminum specific
  { pattern: /aluminum|aluminium|foil/i,
    painPoint: "Cook, Serve & Toss", benefit: "Premium Aluminum", badge: "Aluminum" },
  // Design / aesthetic
  { pattern: /design|pattern|print|style|fashion|aesthetic|cute|decorat|beautiful/i,
    painPoint: "Style Meets Function", benefit: "Eye-Catching Design", badge: "Stylish" },
  // Easy / convenient
  { pattern: /easy|convenient|simple|hassle.?free|effortless|quick/i,
    painPoint: "Life Made Easier", benefit: "Effortless to Use", badge: "Easy Use" },
  // Waterproof / water resistant
  { pattern: /waterproof|water.?resist|moisture|splash.?proof/i,
    painPoint: "Rain or Shine Ready", benefit: "Waterproof Protection", badge: "Waterproof" },
  // Anti-slip / grip
  { pattern: /anti.?slip|non.?slip|grip|rubber.?feet|no.?skid/i,
    painPoint: "Stays in Place", benefit: "Anti-Slip Grip", badge: "Non-Slip" },
  // Gift / gifting
  { pattern: /gift|present|occasion|birthday|holiday|christmas/i,
    painPoint: "Perfect Gift Idea", benefit: "Gift-Ready Packaging", badge: "Great Gift" },
  // Set / complete
  { pattern: /complete.?set|everything.?you.?need|all.?in.?one|full.?kit/i,
    painPoint: "Everything You Need", benefit: "Complete Set Included", badge: "Full Set" },
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

  // Fallback benefits if we didn't match enough
  const fallbacks: BenefitMatch[] = [
    { pattern: /^$/, painPoint: "Upgrade Your Routine", benefit: "Premium Quality", badge: "Top Rated" },
    { pattern: /^$/, painPoint: "Smart Choice", benefit: "Great Value", badge: "Best Seller" },
    { pattern: /^$/, painPoint: "Life Made Easier", benefit: "Effortless Design", badge: "5-Star Pick" },
  ];
  while (matched.length < 3) {
    matched.push(fallbacks[matched.length] || fallbacks[0]);
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
  const resultHeadline = deriveResultHeadline(scene1, audience1, category);

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

  return {
    productName,
    category,
    sellingPoints,
    usageScenes,
    targetAudience,
    materials,
    painPointHeadline,
    painPointBadge1,
    painPointBadge2,
    functionHeadline,
    functionBadge1,
    functionBadge2,
    resultHeadline,
    valueHeadline,
    aPlusLabels,
    comparisonBadges,
    scene1,
    scene2,
    audience1,
  };
}

function deriveResultHeadline(scene: string, audience: string, category: string): string {
  // Use CATEGORY (product type) as primary signal, not scene context
  const cat = category.toLowerCase();

  // Jewelry / accessories — emphasize style & beauty
  if (/ring|jewel|necklace|bracelet|earring|pendant|charm|accessori|饰品|戒指|项链|手链|耳环/.test(cat)) return "Shine Every Day";
  if (/watch|手表/.test(cat)) return "Time in Style";
  if (/bag|purse|wallet|clutch|tote|包|钱包/.test(cat)) return "Carry in Style";
  if (/hat|cap|scarf|glove|帽|围巾|手套/.test(cat)) return "Style Essential";
  if (/cloth|dress|shirt|jacket|coat|服装|衣/.test(cat)) return "Wear With Confidence";
  if (/shoe|boot|sneaker|sandal|鞋|靴/.test(cat)) return "Step Up Your Style";

  // Pet products
  if (/pet|dog|cat|puppy|kitten|宠物|猫|狗/.test(cat)) return "Pet-Approved";

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
  if (/home|house|room|living|bedroom/.test(ctx)) return "Home Upgrade";
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
    return `
🎬 SCENE DIRECTION (Jewelry/Accessories):
- BEST scenes: getting ready for a date, café moment, garden party, sunset walk, brunch with friends
- Show the product being WORN in a stylish, aspirational context
- Background: soft bokeh, warm tones, elegant but not corporate
- Do NOT use: office/work scenes, gym, kitchen, industrial settings
- The model should look happy, confident, and stylish — NOT working at a desk
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
  if (/aluminum|steel|metal|iron/.test(ctx)) return "Built to Last";
  if (/food.?grade|bpa.?free|safe|non.?toxic/.test(ctx)) return "Food-Safe Quality";
  if (/bamboo|wood|natural|organic|eco/.test(ctx)) return "Eco-Friendly Choice";
  if (/premium|luxury|high.?end/.test(ctx)) return "Premium Choice";
  if (/pack|set|count|piece/.test(ctx)) return "Best Value Pack";
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
  "Use a circular zoom inset to show one meaningful detail",
  "Split the image: full product on the left, macro detail on the right",
  "Use a refined magnifier effect to highlight one premium component",
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

  const strictSingleProductRule = `
🔒 SINGLE PRODUCT RULE:
- Show only the real product from the reference
- Do not generate comparison products, exploded parts, or duplicates
- Do not invent accessories, filler props, or fake package contents
- Do NOT add fictional props (magnifying glasses, rulers, pointers, etc.)
`;

  const humanAnatomyRule = `
🚨 HUMAN ANATOMY — CRITICAL:
- If people appear in the image, their hands and fingers MUST have correct anatomy
- Hands must have exactly 5 fingers each with natural proportions and joints
- Do NOT show close-up hands holding/wearing the product if it risks deformed fingers
- PREFER: show people from a wider angle (waist-up, full body) to minimize hand detail issues
- PREFER: show the product in use WITHOUT focusing on hand/finger close-ups
- If the product is worn on hands (rings, bracelets, gloves), show from a distance where minor hand imperfections are less visible
- All human body proportions must look natural — no extra limbs, merged fingers, or distorted joints
`;

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
🔒 Show the exact product from the reference in realistic use. Adults only.
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
🔒 Keep the product identical to the reference in every panel. Adults only.
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
