import type { AnalysisResult, ImageType, ImagePlan } from "./types";
import { IMAGE_TYPE_LABELS } from "./types";

export function generatePlans(
  analysis: AnalysisResult,
  imageTypes: ImageType[]
): ImagePlan[] {
  const { productName, sellingPoints, materials, colors, usageScenes, targetAudience, estimatedDimensions, category } = analysis;
  const sp1 = sellingPoints[0] || "Premium Quality";
  const sp2 = sellingPoints[1] || "Durable Design";
  const sp3 = sellingPoints[2] || "Easy to Use";
  const scene1 = usageScenes[0] || "everyday use";
  const scene2 = usageScenes[1] || usageScenes[0] || "professional use";
  const audience1 = targetAudience[0] || "everyday consumers";
  const audience2 = targetAudience[1] || targetAudience[0] || "professionals";

  return imageTypes.map((imageType) => {
    switch (imageType) {
      case "main":
        return {
          imageType,
          title: "核心主图 - 白底产品展示",
          description: `${productName}居中展示，纯白背景，产品占85%画面，展示完整外观和核心结构，专业摄影棚灯光。`,
          prompt: `Create a professional Amazon product listing main image for this exact product.

REQUIREMENTS:
- Pure white background (RGB 255,255,255), absolutely clean
- Product centered, occupying 85% of the frame
- Show the product from its best angle, clearly displaying its structure and design
- Professional studio lighting with soft, even illumination
- Sharp, crisp product edges
- NO text, NO logos, NO watermarks, NO annotations, NO props
- The product must look EXACTLY like the reference image - same shape, color, material, proportions
- High-end commercial e-commerce photography quality
- 1500x1500px square format

This is the HERO image - it must be clean, professional, and make the product look premium.`,
        };

      case "features":
        return {
          imageType,
          title: "功能卖点图 - 核心功能标注",
          description: `展示${productName}的核心功能：${sp1}、${sp2}、${sp3}，带有功能标注箭头和图标说明。`,
          prompt: `Create a product FEATURE SHOWCASE image for this ${productName} for Amazon listing.

LAYOUT:
- Product centered on a clean, light gradient background
- Add ANNOTATION ARROWS pointing to key features on the product
- Include ICON LABELS next to each arrow with feature descriptions

KEY FEATURES TO HIGHLIGHT:
1. "${sp1}" - with arrow pointing to the relevant product area
2. "${sp2}" - with arrow pointing to the relevant area
3. "${sp3}" - with arrow pointing to the relevant area

HEADER TEXT at top: "${sp1}" (main selling point as headline)
SUB-HEADER: key benefit description

STYLE:
- Clean, modern infographic layout
- Professional product photography with overlay annotations
- Use clean icons and thin annotation lines/arrows
- Colors: product-appropriate color scheme with ${colors} tones
- Premium commercial quality, 1500x1500px

Make the features visually clear and the annotations easy to read.`,
        };

      case "closeup":
        return {
          imageType,
          title: "细节特写图 - 材质与工艺",
          description: `${productName}材质特写，展示${materials}的质感和工艺细节，配放大镜效果或局部截取。`,
          prompt: `Create a CLOSE-UP DETAIL image for this ${productName} for Amazon listing.

LAYOUT:
- Show a dramatic close-up of the product focusing on material quality and craftsmanship
- Include a MAGNIFYING GLASS or ZOOM CIRCLE effect highlighting a key detail area
- The zoom area should clearly show the ${materials} texture

TEXT ELEMENTS:
- Header: "PREMIUM ${materials.toUpperCase()} QUALITY" or similar
- Sub-text highlighting durability and craftsmanship
- Icon labels: material type, quality certification if applicable

STYLE:
- Dramatic side lighting to emphasize surface texture
- Shallow depth of field for professional feel
- Clean background (light gradient or subtle)
- The detail shot should convince customers of premium build quality
- 1500x1500px, commercial product photography quality`,
        };

      case "dimensions":
        return {
          imageType,
          title: "尺寸规格图 - 精确尺寸标注",
          description: `${productName}尺寸标注（${estimatedDimensions}），带测量线和数值，搭配实际使用参照物展示大小。`,
          prompt: `Create a DIMENSIONS & SIZE REFERENCE image for this ${productName} for Amazon listing.

LAYOUT - TWO ZONES:
TOP ZONE: Product with precise dimension annotation lines
- Show measurement lines with arrows on both ends
- Label dimensions: ${estimatedDimensions}
- Clean, technical illustration style

BOTTOM ZONE: Size reference / fit demonstration
- Show the product in context to demonstrate actual size (e.g., held in hand, next to common objects, or in its intended placement)
- Help customer understand real-world scale

TEXT ELEMENTS:
- Header: "PRECISION FIT" or "PERFECT SIZE"
- Dimension values clearly labeled
- Sub-text about where it fits

STYLE:
- Clean white/light gray background with subtle grid lines
- Technical but approachable design
- Precise measurement annotations with dimension values
- Professional quality, 1500x1500px`,
        };

      case "lifestyle":
        return {
          imageType,
          title: "使用场景图 - 真实生活场景",
          description: `${scene1}场景中的${productName}，面向${audience1}，产品自然融入环境，暖色调生活感。`,
          prompt: `Create a LIFESTYLE SCENE image showing this ${productName} in real-world use for Amazon listing.

SCENE: ${scene1}
TARGET AUDIENCE: ${audience1}

REQUIREMENTS:
- Show the product being ACTIVELY USED in a realistic ${scene1} setting
- The product must be the CLEAR FOCAL POINT of the image
- Product must be NATURALLY INTEGRATED into the scene - correct perspective, matching lighting, realistic shadows
- Warm, inviting atmosphere with natural ambient lighting
- The scene should feel authentic and aspirational

OPTIONAL TEXT (subtle):
- Small lifestyle benefit text in corner if appropriate

STYLE:
- Lifestyle magazine quality photography
- Natural, warm color tones
- The product should look like it BELONGS in the scene, not photoshopped in
- Show the BENEFIT of using the product, not just the product itself
- 1500x1500px, editorial photography quality`,
        };

      case "packaging":
        return {
          imageType,
          title: "包装配件图 - 开箱内容展示",
          description: `${productName}完整包装内容物平铺展示，包含主品和所有配件，整齐排列，鸟瞰角度。`,
          prompt: `Create a PACKAGE CONTENTS / WHAT'S INCLUDED image for this ${productName} for Amazon listing.

LAYOUT:
- Overhead / bird's eye view flat-lay arrangement
- Main product prominently in CENTER
- All accessories and included items arranged neatly around the product
- Each item clearly visible and labeled

TEXT ELEMENTS:
- Header: "COMPLETE SET" or "WHAT'S INCLUDED"
- Label each item with text annotations
- Highlight any BONUS items or quantity (e.g., "x3", "60 pcs included")

STYLE:
- Clean, light surface (white, light wood, or marble)
- Overhead flat-lay photography style
- Soft, even lighting from above
- Instagram-worthy organized layout
- Premium unboxing experience feel
- 1500x1500px, commercial photography quality

Make customers feel they're getting great VALUE from the package contents.`,
        };

      case "lifestyle2":
        return {
          imageType,
          title: "多场景应用图 - 多功能展示",
          description: `${productName}在不同场景中的应用：${scene2}，展示产品的多功能性和广泛适用性。`,
          prompt: `Create a MULTI-USE / VERSATILE APPLICATION image for this ${productName} for Amazon listing.

LAYOUT:
- Show the product being used in MULTIPLE different scenarios or locations
- Can use a split-image layout or embedded scene thumbnails
- Each scenario should show a DIFFERENT use case

SCENARIOS TO SHOW:
1. ${scene1} - primary use
2. ${scene2} - secondary use
3. Any other creative application

TEXT ELEMENTS:
- Header: "VERSATILE & MULTI-USE" or "USE ANYWHERE"
- Label each scenario/location
- Icon labels for each use case

STYLE:
- Clean layout that clearly shows multiple applications
- Each mini-scene should be realistic and well-lit
- Product is clearly recognizable in each scene
- Demonstrates VALUE through versatility
- 1500x1500px, commercial quality

The goal is to show customers this product is useful in MANY situations, not just one.`,
        };

      default:
        return {
          imageType,
          title: IMAGE_TYPE_LABELS[imageType],
          description: `${productName}专业产品图`,
          prompt: `Create a professional product photography image for this ${productName}. Clean background, professional studio lighting. Premium commercial feel. 1500x1500px.`,
        };
    }
  });
}
