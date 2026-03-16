import type { AnalysisResult, ImageType, ImagePlan, AnalysisLanguage } from "./types";
import { IMAGE_TYPE_LABELS, LANGUAGE_ENGLISH_NAMES } from "./types";

// Extract English from bilingual "中文 (English)" format, or return original if no English found
function toEnglish(text: string): string {
  // Match content inside parentheses at the end: "中文文字 (English Text)"
  const match = text.match(/\(([^)]+)\)\s*$/);
  if (match) return match[1].trim();
  // Also try full-width parentheses: "中文（English）"
  const match2 = text.match(/（([^）]+)）\s*$/);
  if (match2) return match2[1].trim();
  // If no Chinese characters detected, return as-is (already English)
  if (!/[\u4e00-\u9fff]/.test(text)) return text;
  // Fallback: return original (will rely on prompt-level translation rules)
  return text;
}

// Convert all fields in analysis result to English
function toEnglishArray(arr: string[]): string[] {
  return arr.map(toEnglish);
}

// Randomization helpers to avoid template-like repetitive outputs
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

const featureLayouts = [
  "Arrange annotations in a CIRCULAR pattern around the product with curved connector lines",
  "Place annotations on the LEFT and RIGHT sides of the product with horizontal arrows pointing inward",
  "Use a TOP-DOWN flow: header at top, product in center, feature callouts radiating outward with dotted lines",
  "Place the product slightly left of center, with all feature annotations stacked neatly on the right side",
];

const closeupStyles = [
  "Use a MAGNIFYING GLASS effect hovering over the product to zoom into material detail",
  "Use a CIRCULAR ZOOM INSET in the corner showing an extreme close-up of the texture",
  "Split the image: full product on the left, extreme macro close-up on the right",
  "Use a diagonal split — upper portion shows the full product, lower portion is an extreme close-up of the surface texture",
];

const lifestyleMoods = [
  "GOLDEN HOUR — warm sunset light streaming through large windows, long soft shadows, honey-toned warmth",
  "BRIGHT MORNING — fresh, crisp daylight with white curtains gently diffusing sunlight, clean and airy",
  "COZY EVENING — warm lamp light, soft candlelight ambiance, intimate and inviting atmosphere",
  "NATURAL DAYLIGHT — bright, cheerful midday light with soft shadows, fresh and vibrant energy",
];

const lifestyleCompositions = [
  "Product as the hero in the foreground with the scene softly blurred behind (shallow DOF)",
  "Wide environmental shot showing the full room/space with the product naturally placed as the eye-catching centerpiece",
  "Over-the-shoulder perspective of someone enjoying the product in their space",
  "Tight medium shot focusing on the product in use with beautiful bokeh background",
];

const multiSceneLayouts = [
  "2x2 GRID layout — four equal scenes, each with a different mood and setting",
  "HERO + THUMBNAILS — one large main scene on top, 2-3 smaller scenes in a row below",
  "TRIPTYCH — three vertical panels side by side, each a different scenario",
  "DIAGONAL SPLIT — two large triangular scenes divided by a clean diagonal line",
];

// Pain-point marketing angles for lifestyle images — gives buyers a REASON to purchase
const painPointAngles = [
  "BEFORE vs AFTER: Show the contrast — the dull/boring/messy space WITHOUT the product vs the beautiful/upgraded space WITH the product. The viewer should immediately see the transformation.",
  "PROBLEM → SOLUTION: Show a common frustration the target customer faces (e.g., boring decor, uncomfortable experience, lack of style) and how THIS product is the perfect solution.",
  "GIFTING MOMENT: Show someone receiving or gifting this product — wrapped beautifully or being presented. Convey that this is a PERFECT GIFT that will delight the recipient.",
  "UPGRADE YOUR SPACE: Show a stylish, aspirational space where this product is the KEY element that ties everything together. Without it, the space would feel incomplete.",
];

// Diverse scene environments — prevents repetitive same-room shots
const sceneEnvironments = [
  "Modern minimalist living room with large windows and natural light",
  "Cozy bedroom with soft textiles, warm lamp light, and a relaxing atmosphere",
  "Bright, airy kitchen or dining area with fresh morning energy",
  "Stylish home office or study with plants and creative decor",
  "Outdoor patio or balcony with garden views and natural greenery",
  "Elegant entryway or hallway that sets the tone for the whole home",
  "Romantic dinner table setting with candles and warm ambiance",
  "Modern bathroom vanity or spa-like relaxation corner",
];

export function generatePlans(
  analysis: AnalysisResult,
  imageTypes: ImageType[],
  imageLanguage: AnalysisLanguage = "en"
): ImagePlan[] {
  const { sellingPoints, materials, colors, usageScenes, targetAudience, estimatedDimensions, category } = analysis;

  // Convert ALL fields to English first (used as base for prompts)
  const productName = toEnglish(analysis.productName);
  const enSellingPoints = toEnglishArray(sellingPoints);
  const enScenes = toEnglishArray(usageScenes);
  const enAudience = toEnglishArray(targetAudience);
  const enMaterials = toEnglish(materials);
  const enColors = toEnglish(colors);

  // Target language for text on generated images
  const targetLang = LANGUAGE_ENGLISH_NAMES[imageLanguage] || "English";
  const langRule = imageLanguage === "en"
    ? "ALL text on the image MUST be in ENGLISH."
    : imageLanguage === "zh"
    ? "ALL text on the image MUST be in CHINESE (中文). Write all headers, labels, and annotations in Chinese."
    : `ALL text on the image MUST be in ${targetLang.toUpperCase()}. Write all headers, labels, and annotations in ${targetLang}.`;

  const sp1 = enSellingPoints[0] || "Premium Quality";
  const sp2 = enSellingPoints[1] || "Durable Design";
  const sp3 = enSellingPoints[2] || "Easy to Use";
  const scene1 = enScenes[0] || "everyday use";
  const scene2 = enScenes[1] || enScenes[0] || "professional use";
  const audience1 = enAudience[0] || "everyday consumers";
  const audience2 = enAudience[1] || enAudience[0] || "professionals";

  return imageTypes.map((imageType) => {
    switch (imageType) {
      case "main":
        return {
          imageType,
          title: "核心主图 - 白底产品展示",
          description: `${productName}居中展示，纯白背景，产品占85%画面，展示完整外观和核心结构，专业摄影棚灯光。`,
          prompt: `Create a professional Amazon product listing main image for this exact product.

🔒 PRODUCT FIDELITY RULE: The generated product must be a FAITHFUL reproduction of the reference image(s). Match the EXACT shape, color, texture, material, stitching, edges, and proportions. Do NOT alter, stylize, or "improve" the product appearance.

CAMERA ANGLE: ${pickRandom(mainAngles)}
LIGHTING: ${pickRandom(mainLighting)}

REQUIREMENTS:
- Pure white background (RGB 255,255,255), absolutely clean
- Show ONLY ONE product — do NOT duplicate or show multiple copies
- Product centered, occupying 85% of the frame
- Sharp, crisp product edges
- NO text, NO logos, NO watermarks, NO annotations, NO props, NO dimension lines or measurements
- CRITICAL: Maintain the product's REAL-WORLD size proportions. Do NOT exaggerate or distort the product dimensions
- High-end commercial e-commerce photography quality
- 800x800px square format

This is the HERO image - it must be clean, professional, and make the product look premium.`,
        };

      case "features":
        return {
          imageType,
          title: "功能卖点图 - 核心功能标注",
          description: `展示${productName}的核心功能：${sp1}、${sp2}、${sp3}，带有功能标注箭头和图标说明。`,
          prompt: `Create a product FEATURE SHOWCASE image for this ${productName} for Amazon listing.

⚠️ ${langRule}

🔒 PRODUCT FIDELITY RULE: The product in this image must look EXACTLY like the reference photos — same shape, color, texture, material. Do NOT alter the product appearance. Show ONLY ONE product.

LAYOUT STYLE: ${pickRandom(featureLayouts)}
- Show ONLY ONE product on a clean, light gradient background
- Include ICON LABELS with SHORT feature descriptions IN ENGLISH

KEY FEATURES TO HIGHLIGHT (translate to English if not already):
1. "${sp1}" - with arrow pointing to the relevant product area
2. "${sp2}" - with arrow pointing to the relevant area
3. "${sp3}" - with arrow pointing to the relevant area

HEADER TEXT at top: English translation of "${sp1}" (main selling point as headline)
SUB-HEADER: ONE short sentence (max 8 words) IN ENGLISH

⚠️ TEXT DENSITY RULE — CRITICAL:
- Keep ALL text SHORT and CONCISE — maximum 3-5 words per label
- Header: max 6 words. Sub-header: max 8 words.
- Each feature label: max 5 words (e.g., "Lightweight & Breathable", "Durable Construction")
- Do NOT write full sentences or paragraphs on the image
- WHITE SPACE is important — leave breathing room between text elements
- Fewer words = more impact. If in doubt, use fewer words.

STYLE:
- Clean, modern infographic layout with plenty of white space
- Professional product photography with overlay annotations
- Use clean icons and thin annotation lines/arrows
- Colors: product-appropriate color scheme with ${enColors} tones
- CRITICAL: Maintain REALISTIC product size proportions - do not exaggerate dimensions
- Premium commercial quality, 800x800px
- ${langRule}

Do NOT add dimension lines, measurement annotations, or size specifications. Focus ONLY on features and selling points.`,
        };

      case "closeup":
        return {
          imageType,
          title: "细节特写图 - 材质与工艺",
          description: `${productName}材质特写，展示${enMaterials}的质感和工艺细节，配放大镜效果或局部截取。`,
          prompt: `Create a CLOSE-UP DETAIL image for this ${productName} for Amazon listing.

⚠️ ${langRule}

🔒 CRITICAL — SINGLE PRODUCT ONLY: Show ONLY ONE product. Do NOT show two or more copies of the product. If you want to show different sides/angles, use a MAGNIFYING GLASS or ZOOM CIRCLE overlay on the SAME single product — do NOT place multiple separate products side by side.

🔒 PRODUCT FIDELITY RULE: The product must look EXACTLY like the reference photos — same shape, color shade, texture, material, stitching pattern. Do NOT change the product color or appearance.

LAYOUT & CLOSE-UP STYLE: ${pickRandom(closeupStyles)}
- Show ONE product — the close-up detail should clearly reveal the ${enMaterials} texture, stitching, or craftsmanship

TEXT ELEMENTS (ALL IN ENGLISH):
- Header: "PREMIUM ${materials.toUpperCase()} QUALITY" or similar English text
- Sub-text highlighting durability and craftsmanship in English
- 2-3 small icon labels in English describing material properties
- ⚠️ CRITICAL: Every label must be UNIQUE — do NOT repeat the same text or phrase twice. Each label must describe a DIFFERENT property (e.g., one for material, one for durability, one for comfort). Double-check before finalizing.

STYLE:
- Dramatic side lighting to emphasize surface texture
- Shallow depth of field for professional feel
- Clean background (light gradient or subtle)
- The detail shot should convince customers of premium build quality
- CRITICAL: Maintain REALISTIC product size proportions
- 800x800px, commercial product photography quality
- ${langRule}
- Do NOT add dimension lines or measurement annotations`,
        };

      case "dimensions":
        return {
          imageType,
          title: "尺寸规格图 - 精确尺寸标注",
          description: `${productName}尺寸标注（${estimatedDimensions}），带测量线和数值，搭配实际使用参照物展示大小。`,
          prompt: `Create a DIMENSIONS & SIZE REFERENCE image for this ${productName} for Amazon listing.

⚠️ ${langRule}

🔒 PRODUCT FIDELITY RULE: The product must look EXACTLY like the reference photos. Show ONLY ONE product.

LAYOUT:
- Product shown clearly on a clean white/light gray background
- Add clear dimension annotation lines with arrows for all important measurements
- Dimension values: ${estimatedDimensions}
- Show measurement lines with arrows on both ends, clean technical style
- Mark length, width, height, and any other key dimensions clearly

OPTIONAL: Size reference
- If helpful, show a size reference (e.g., held in hand, next to common objects) to help customer understand real-world scale

TEXT ELEMENTS (ALL IN ENGLISH):
- Dimension values and units clearly labeled (e.g., "12.5 inches", "30 cm")
- Optional header: "DIMENSIONS" or "SIZE GUIDE"

STYLE:
- Clean, professional technical illustration style
- Technical but approachable design
- Precise measurement annotations with clear dimension values
- Professional quality, 800x800px
- ${langRule}`,
        };

      case "lifestyle":
        return {
          imageType,
          title: "使用场景图 - 痛点解决与购买理由",
          description: `面向${audience1}，展示${productName}如何解决客户痛点。场景：${scene1}。突出产品卖点：${sp1}，给客户必须购买的理由。`,
          prompt: `Create a LIFESTYLE SCENE image showing this ${productName} in a beautiful, aspirational setting for Amazon listing.

⚠️ ${langRule}

🔒 PRODUCT FIDELITY RULE: The product in this scene must look EXACTLY like the reference photos — same shape, color, texture, material. Do NOT alter, redesign, or change the product appearance. The product must be visually identical to the reference.

🔒 CORRECT USAGE RULE: Show the product being used in its CORRECT, INTENDED way. Study the reference images to understand HOW this product is meant to be used.

🎨 ATMOSPHERE & MOOD RULE — THIS IS CRITICAL:
This image must evoke EMOTION and DESIRE. It should look like a page from a high-end lifestyle magazine, NOT a generic product placement photo.

MOOD: ${pickRandom(lifestyleMoods)}
COMPOSITION: ${pickRandom(lifestyleCompositions)}
ENVIRONMENT: ${pickRandom(sceneEnvironments)}

- Apply SHALLOW DEPTH OF FIELD (bokeh) — the background should have a beautiful, creamy blur
- Color grading: warm tones, slightly desaturated shadows, luminous highlights
- If the product is decorative (flowers, art, decor): make it look STUNNING and ALIVE — render artificial flowers as if they were FRESH, REAL flowers with natural petal softness and organic beauty

SCENE: ${scene1}
TARGET AUDIENCE: ${audience1}

💰 PURCHASE MOTIVATION — WHY SHOULD THE CUSTOMER BUY THIS?
MARKETING ANGLE: ${pickRandom(painPointAngles)}

KEY SELLING POINT: "${sp1}" (translate to English if not already)
Additional benefits: "${sp2}", "${sp3}" (translate to English if not already)

The image must answer the customer's question: "Why do I NEED this?" Show them:
- How this product TRANSFORMS their space, experience, or daily life
- The EMOTIONAL BENEFIT — joy, comfort, pride, relaxation, style upgrade
- A clear BEFORE→AFTER feeling: life is BETTER with this product

Add a SHORT, punchy English text overlay (max 6 words) that communicates the key benefit — like a magazine headline that makes people stop scrolling. Examples: "Transform Your Space", "The Perfect Gift", "Effortless Elegance", "Make It Yours"

REQUIREMENTS:
- Show the product NATURALLY INTEGRATED into the scene
- The product must be the CLEAR FOCAL POINT
- CRITICAL: Maintain REALISTIC product size proportions
- Only show ADULTS (18+ years old) — NO children, babies, or minors
- ${langRule}

STYLE:
- HIGH-END editorial lifestyle photography (Architectural Digest, Elle Decor quality)
- Cinematic color grading with warm, rich tones
- Beautiful bokeh and shallow depth of field
- Soft, directional lighting that creates mood and depth
- 800x800px, premium editorial photography quality
- ${langRule}
- Do NOT add dimension lines or measurement annotations on this image`,
        };

      case "packaging":
        return {
          imageType,
          title: "包装配件图 - 开箱内容展示",
          description: `${productName}包装内容展示，仅展示参考图中可见的物品，整齐排列，鸟瞰角度。`,
          prompt: `Create a PACKAGE CONTENTS / WHAT'S INCLUDED image for this ${productName} for Amazon listing.

⚠️ ${langRule}

🚫🚫🚫 ABSOLUTE RULE — DO NOT ADD ANY ITEMS 🚫🚫🚫
You MUST ONLY show items that are CLEARLY VISIBLE in the reference product images provided.
- Do NOT invent, imagine, add, or fabricate ANY accessories, cables, manuals, user guides, boxes, bags, straps, tools, adapters, chargers, or ANY other items
- Do NOT add items that "typically come with" this type of product
- Do NOT assume what might be in the package
- If only the main product is visible in the reference images, show ONLY the main product — just ONE single item in the center
- Count the items in the reference images — the generated image must contain the EXACT SAME number of items, nothing more, nothing less

🔒 PRODUCT FIDELITY RULE: The product must look EXACTLY like the reference photos — same shape, color, texture, material.

LAYOUT:
- Overhead / bird's eye view flat-lay arrangement
- Main product prominently in CENTER
- ONLY arrange items that appear in the reference images — NOTHING ELSE
- Each item clearly visible and labeled IN ENGLISH
- Maintain REALISTIC size proportions between items

TEXT ELEMENTS (ALL IN ENGLISH):
- Header: "WHAT'S INCLUDED"
- Label each visible item with English text annotations

STYLE:
- Clean, light surface (white, light wood, or marble)
- Overhead flat-lay photography style
- Soft, even lighting from above
- Instagram-worthy organized layout
- Premium unboxing experience feel
- 800x800px, commercial photography quality
- ${langRule}
- Do NOT add dimension lines or measurement annotations on this image`,
        };

      case "lifestyle2":
        return {
          imageType,
          title: "多场景应用图 - 多元化使用展示",
          description: `${productName}在多种场景中的丰富应用，面向不同人群（${audience1}、${audience2}），展示多元化使用方式和购买价值。`,
          prompt: `Create a MULTI-SCENARIO LIFESTYLE image for this ${productName} for Amazon listing.

⚠️ ${langRule}

🔒 PRODUCT FIDELITY RULE: The product in EVERY scene must look EXACTLY like the reference photos — same shape, color, texture, material. Do NOT alter, redesign, or change the product appearance in any scene.

🔒 CORRECT USAGE RULE: In EVERY scene, the product must be used in its CORRECT, INTENDED way. Study the reference images to understand the proper usage method.

🎨 ATMOSPHERE & MOOD RULE — CRITICAL FOR EVERY SCENE:
Each scene must be EMOTIONALLY compelling and VISUALLY stunning:
- Use CINEMATIC LIGHTING in every scene — golden hour glow, soft window light, warm ambient tones
- Apply SHALLOW DEPTH OF FIELD (bokeh) — dreamy blurred backgrounds that make the product pop
- Each scene should feel like a MOVIE STILL or HIGH-END MAGAZINE PHOTO, not a generic stock image
- Color grading: warm, rich, slightly cinematic tones — think lifestyle influencer photography
- If the product is decorative (flowers, art, decor): render it as BEAUTIFUL and ALIVE as possible. Artificial flowers should look like FRESH, REAL blooms — lush, vibrant, with natural organic beauty
- Every scene should make the viewer think "I want that life"

💰 MARKETING STRATEGY — GIVE BUYERS MULTIPLE REASONS TO PURCHASE:
Each scene must answer a DIFFERENT version of "Why should I buy this?"

Target audiences: ${audience1}, ${audience2} (translate to English if not already)
Product strengths: ${sp1}, ${sp2}, ${sp3} (translate to English if not already)

LAYOUT: ${pickRandom(multiSceneLayouts)}

SCENES — each must show a UNIQUE purchase reason:
1. 🏠 "${scene1}" — Show the product enhancing daily life in a ${pickRandom(sceneEnvironments)}. Text overlay: a short benefit headline (max 5 words)
2. 🎁 GIFTING / SPECIAL OCCASION — Show the product as a thoughtful gift or in a celebration/holiday/birthday setting. This appeals to gift-buyers (a huge market). Text overlay: e.g., "The Perfect Gift"
3. 💼 "${scene2}" — Show a DIFFERENT person/demographic using the product in a completely different environment. Text overlay: a different benefit angle
4. ✨ VERSATILITY / MULTI-USE — Show the product used in an unexpected or creative way that expands its perceived value. Text: e.g., "More Than You Think"

Each scene MUST have:
- A SHORT English text overlay (max 5 words) highlighting that scene's unique purchase reason
- A DIFFERENT environment, lighting mood, and person/demographic
- The product used CORRECTLY

REQUIREMENTS:
- CRITICAL: Maintain REALISTIC product size proportions in every scene
- Show ADULT people (18+ only) — NO children, babies, or minors
- EVERY scene must look like a DIFFERENT photo shoot — different location, different model, different time of day
- ${langRule}

STYLE:
- Each scene: HIGH-END editorial lifestyle photography quality
- Rich, warm, cinematic color grading in every panel
- Beautiful bokeh and atmospheric lighting throughout
- 800x800px, premium editorial quality
- ${langRule}
- Do NOT add dimension lines or measurement annotations

The goal: after seeing this image, the customer should think "I can use this for SO many things — I need to buy it NOW."`,
        };

      default:
        return {
          imageType,
          title: IMAGE_TYPE_LABELS[imageType],
          description: `${productName}专业产品图`,
          prompt: `Create a professional product photography image for this ${productName}. Clean background, professional studio lighting. Premium commercial feel. 800x800px.`,
        };
    }
  });
}
