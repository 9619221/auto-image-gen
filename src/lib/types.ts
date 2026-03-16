export type ImageType =
  | "main"
  | "features"
  | "closeup"
  | "dimensions"
  | "lifestyle"
  | "packaging"
  | "lifestyle2";

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  main: "主图",
  features: "功能卖点图",
  closeup: "细节特写图",
  dimensions: "尺寸规格图",
  lifestyle: "场景图",
  packaging: "包装配件图",
  lifestyle2: "场景图 2",
};

export const IMAGE_TYPE_ORDER: ImageType[] = [
  "main",
  "features",
  "closeup",
  "dimensions",
  "lifestyle",
  "packaging",
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
}

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

export interface GenerationJob {
  imageType: ImageType;
  status: "pending" | "generating" | "done" | "error";
  finalImageUrl?: string;
  error?: string;
}
