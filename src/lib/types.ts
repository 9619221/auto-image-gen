export type ImageType =
  | "main"
  | "features"
  | "closeup"
  | "dimensions"
  | "lifestyle"
  | "packaging"
  | "lifestyle2"
  | "comparison";

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  main: "主图（Hero）",
  features: "痛点/卖点图",
  closeup: "功能/结构图",
  dimensions: "尺寸规格图",
  lifestyle: "场景结果图",
  packaging: "差异化价值图",
  lifestyle2: "A+ 收束图",
  comparison: "对比优势图",
};

export const IMAGE_TYPE_ORDER: ImageType[] = [
  "main",
  "features",
  "closeup",
  "dimensions",
  "lifestyle",
  "packaging",
  "comparison",
  "lifestyle2",
];

export interface AnalysisResult {
  productName: string;
  category: string;
  sellingPoints: string[];
  materials: string;
  colors: string;
  targetAudience: string[];
  usageScenes: string[];
  estimatedDimensions: string;
}

export interface ImagePlan {
  imageType: ImageType;
  title: string;
  description: string;
  prompt: string;
  validationNotes?: string[];
}

// ===== Sales Region System =====

export type SalesRegion = "us" | "eu" | "uk" | "jp" | "kr" | "cn" | "sea" | "me" | "latam" | "br";

export interface RegionConfig {
  label: string;
  flag: string;
  language: string;         // Language name in English
  languageNative: string;   // Language name in native script
  textDirection: "ltr" | "rtl";
  styleGuide: string;       // Detailed style instructions for image generation
  modelEthnicity: string;   // What kind of models to show
  sceneStyle: string;       // Interior/scene aesthetic
  colorTone: string;        // Color palette preference
}

export const REGION_CONFIGS: Record<SalesRegion, RegionConfig> = {
  us: {
    label: "🇺🇸 美国 / USA",
    flag: "🇺🇸",
    language: "English",
    languageNative: "English",
    textDirection: "ltr",
    styleGuide: "American commercial photography style. Clean, bright, aspirational. Think Amazon bestseller listings — bold headlines, high contrast, professional studio lighting.",
    modelEthnicity: "Diverse American models (mix of ethnicities: Caucasian, African American, Hispanic, Asian American)",
    sceneStyle: "Modern American home: open-concept living rooms, farmhouse kitchens, suburban bedrooms, home offices with large desks. Spacious, bright, natural light from large windows.",
    colorTone: "Bright, warm, high-contrast. White backgrounds for main shots. Warm golden-hour lighting for lifestyle.",
  },
  eu: {
    label: "🇪🇺 欧洲 / Europe",
    flag: "🇪🇺",
    language: "English",
    languageNative: "English",
    textDirection: "ltr",
    styleGuide: "European minimalist photography style. Elegant, understated, sophisticated. Clean lines, muted tones, editorial quality.",
    modelEthnicity: "European models (diverse European ethnicities)",
    sceneStyle: "European interiors: Scandinavian minimalism, Parisian apartments with high ceilings and herringbone floors, Mediterranean villas with terracotta and white walls. Elegant, curated, less cluttered.",
    colorTone: "Muted, sophisticated. Soft whites, warm greys, natural wood tones. Soft diffused lighting.",
  },
  uk: {
    label: "🇬🇧 英国 / UK",
    flag: "🇬🇧",
    language: "English",
    languageNative: "English",
    textDirection: "ltr",
    styleGuide: "British refined photography style. Classic yet modern, understated luxury. Heritage meets contemporary.",
    modelEthnicity: "British models (diverse UK ethnicities)",
    sceneStyle: "British home interiors: cozy living rooms with fireplaces, traditional-meets-modern kitchens, garden conservatories. Warm, inviting, slightly traditional.",
    colorTone: "Warm, rich tones. Deep greens, navy, warm wood. Cozy ambient lighting.",
  },
  jp: {
    label: "🇯🇵 日本 / Japan",
    flag: "🇯🇵",
    language: "Japanese",
    languageNative: "日本語",
    textDirection: "ltr",
    styleGuide: "Japanese commercial photography style (Rakuten/Amazon.co.jp aesthetic). Extremely detailed info-graphics, cute design elements, pastel accents, meticulous product presentation. Japanese consumers expect dense information and kawaii design touches.",
    modelEthnicity: "Japanese models",
    sceneStyle: "Japanese home interiors: compact but beautifully organized spaces, tatami rooms, minimalist wooden furniture, small but elegant kitchens, organized genkan (entryway). Clean, zen-inspired, space-efficient.",
    colorTone: "Soft pastels, clean whites, natural wood. Gentle, even lighting. Slightly warm tone.",
  },
  kr: {
    label: "🇰🇷 韩国 / Korea",
    flag: "🇰🇷",
    language: "Korean",
    languageNative: "한국어",
    textDirection: "ltr",
    styleGuide: "Korean e-commerce photography style (Coupang/Naver aesthetic). Trendy, youthful, K-beauty/K-lifestyle inspired. Clean but with a fashion-forward edge. Modern typography.",
    modelEthnicity: "Korean models",
    sceneStyle: "Korean home interiors: modern apartment living rooms (officetel style), minimalist with trendy accents, Instagram-worthy cafe-style spaces, clean white kitchens with pastel accents.",
    colorTone: "Clean, bright whites with soft pastels (blush pink, mint, lavender). Bright even lighting, slightly cool tone.",
  },
  cn: {
    label: "🇨🇳 中国 / China",
    flag: "🇨🇳",
    language: "Chinese",
    languageNative: "中文",
    textDirection: "ltr",
    styleGuide: "Chinese e-commerce photography style (Taobao/Tmall/JD aesthetic). Rich, vibrant, information-dense. Bold red/gold accents for premium feel. Strong value proposition messaging. Dramatic product presentations.",
    modelEthnicity: "Chinese models",
    sceneStyle: "Chinese home interiors: modern Chinese apartments, bright living rooms with warm lighting, organized kitchens, cozy bedrooms. Mix of modern minimalist and warm family-oriented spaces.",
    colorTone: "Vibrant, rich, warm. Red and gold accents for premium products. Bright studio lighting for main shots. Warm ambient for lifestyle.",
  },
  sea: {
    label: "🇹🇭 东南亚 / Southeast Asia",
    flag: "🇹🇭",
    language: "English",
    languageNative: "English",
    textDirection: "ltr",
    styleGuide: "Southeast Asian e-commerce style (Shopee/Lazada aesthetic). Bright, colorful, value-focused. Fun, energetic, deal-oriented presentation.",
    modelEthnicity: "Southeast Asian models (Thai, Vietnamese, Filipino, Indonesian mix)",
    sceneStyle: "Southeast Asian home interiors: tropical modern homes, bright airy spaces with natural ventilation, tropical plants, warm climate living. Colorful but not cluttered.",
    colorTone: "Bright, tropical, warm. Vibrant greens, natural light, cheerful atmosphere.",
  },
  me: {
    label: "🇸🇦 中东 / Middle East",
    flag: "🇸🇦",
    language: "Arabic",
    languageNative: "العربية",
    textDirection: "rtl",
    styleGuide: "Middle Eastern luxury e-commerce style. Opulent, premium, sophisticated. Gold accents, rich textures. Arabic text reads RIGHT to LEFT — layout must accommodate RTL text direction.",
    modelEthnicity: "Middle Eastern models (modest fashion considerations — no revealing clothing)",
    sceneStyle: "Middle Eastern home interiors: luxurious villas with marble floors, ornate majlis (sitting rooms), gold and cream color schemes, grand entryways, desert-modern architecture.",
    colorTone: "Rich, luxurious. Gold, cream, deep burgundy, emerald. Warm dramatic lighting with golden undertones.",
  },
  latam: {
    label: "🇲🇽 拉美 / Latin America",
    flag: "🇲🇽",
    language: "Spanish",
    languageNative: "Español",
    textDirection: "ltr",
    styleGuide: "Latin American e-commerce style (MercadoLibre/Amazon MX aesthetic). Warm, vibrant, family-oriented. Bold colors, energetic presentation.",
    modelEthnicity: "Latin American models (diverse: mestizo, indigenous, European descent)",
    sceneStyle: "Latin American home interiors: colorful living spaces, warm family kitchens, outdoor patios with tropical plants, hacienda-inspired decor mixed with modern elements.",
    colorTone: "Warm, vibrant. Terracotta, turquoise, warm yellows, bright natural sunlight.",
  },
  br: {
    label: "🇧🇷 巴西 / Brazil",
    flag: "🇧🇷",
    language: "Portuguese",
    languageNative: "Português",
    textDirection: "ltr",
    styleGuide: "Brazilian e-commerce style. Energetic, diverse, tropical modern. Bold and confident presentation with a warm, friendly feel.",
    modelEthnicity: "Brazilian models (diverse: mixed race, Afro-Brazilian, European descent)",
    sceneStyle: "Brazilian home interiors: modern apartments in São Paulo style, beach houses, tropical gardens, bright open spaces with natural wood and plants.",
    colorTone: "Bright, tropical, warm. Greens, warm yellows, natural wood tones. Abundant natural light.",
  },
};

export const REGION_ORDER: SalesRegion[] = ["us", "eu", "uk", "jp", "kr", "cn", "sea", "me", "latam", "br"];

// Legacy compatibility
export type AnalysisLanguage = "zh" | "en" | "ja" | "ko" | "es" | "fr" | "de" | "pt" | "it" | "ru" | "ar" | "th";

export const LANGUAGE_LABELS: Record<AnalysisLanguage, string> = {
  zh: "🇨🇳 中文",
  en: "🇺🇸 English",
  ja: "🇯🇵 日本語",
  ko: "🇰🇷 한국어",
  es: "🇪🇸 Español",
  fr: "🇫🇷 Français",
  de: "🇩🇪 Deutsch",
  pt: "🇧🇷 Português",
  it: "🇮🇹 Italiano",
  ru: "🇷🇺 Русский",
  ar: "🇸🇦 العربية",
  th: "🇹🇭 ไทย",
};

export const LANGUAGE_ENGLISH_NAMES: Record<AnalysisLanguage, string> = {
  zh: "Chinese",
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
  th: "Thai",
};

// Map region to language code
export function regionToLanguage(region: SalesRegion): AnalysisLanguage {
  const map: Record<SalesRegion, AnalysisLanguage> = {
    us: "en", eu: "en", uk: "en", jp: "ja", kr: "ko",
    cn: "zh", sea: "en", me: "ar", latam: "es", br: "pt",
  };
  return map[region];
}

export type ProductMode = "single" | "bundle";

export interface GenerationJob {
  imageType: ImageType;
  status: "pending" | "generating" | "done" | "error";
  finalImageUrl?: string;
  error?: string;
}

export interface ImageScore {
  clarity: number;
  composition: number;
  textQuality: number;
  compliance: number;
  appeal: number;
  overall: number;
  suggestions: string[];
}
