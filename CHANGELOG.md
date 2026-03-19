# 修改日志 (Changelog)

---

## 2026-03-19 — 图片质量全面优化（标签清晰度+裁切+场景+角度+色差+误匹配）

### 改了什么
- **产品标签文字清晰度** — 新增 PRODUCT LABEL TEXT 规则，要求品牌名/产品名保持可读和清晰
- **裁切/构图修复** — 新增 FRAMING & CROPPING 规则，要求产品完整可见，四边至少 5% 留白，产品填充 60-80%
- **美妆场景强化** — 明确禁止办公场景（laptop、keyboard、desk、notebook 等 12 个关键词），确保美妆只出现在梳妆台/咖啡馆/晚宴等场景
- **拍摄角度多样化** — closeup 从 3 种增加到 5 种（新增低角度英雄照、俯拍平铺），packaging 从固定角度改为 5 种随机
- **色差强化** — 颜色规则从 8 条增到 12 条，新增禁止暖光/冷光改变产品色、nude/beige 精确匹配
- **"Calming Energy" 误匹配修复** — heal/chakra 规则加美妆排除条件，美妆不再匹配到冥想文案
- **美妆/花卉品类 fallback** — 指甲油 fallback 改为 Quick Dry / Chip-Resistant / Vivid Color / Smooth

### 思路
用户反馈 4 个问题：(1)产品标签文字模糊变形 (2)产品被裁切到画面外 (3)美妆生成了办公桌场景 (4)closeup 和 packaging 角度太单一。标签模糊是 AI 文字渲染的固有限制，但可以通过 prompt 引导缓解。裁切问题通过强制 5% padding 和 60-80% 填充率解决。美妆场景通过显式 ban 12 个办公关键词解决。角度通过扩展随机池解决。

### 修改文件
- `src/lib/prompt-templates.ts` — productIdentityRule 扩展、美妆场景 ban list、closeupStyles 扩展、packaging 角度随机化、colorAccuracyRule 强化、getCategoryFallbacks 新增美妆/花卉、heal 规则排除美妆

---

## 2026-03-19 — 新增美妆/家居/电子品类文案系统

### 改了什么
- **美妆/化妆品品类** — 指甲油、口红、睫毛膏、粉底、眼影、护肤品各有专属标语和场景
  - 指甲油标语：`Salon-Quality Color`、`Bold & Beautiful`、`Color That Pops`（替代之前的 `Built Tough`、`Work Smarter`）
  - Lifestyle 场景：梳妆台、咖啡馆秀美甲、闺蜜聚会等 6 种随机
- **家居装饰/花卉品类** — 满天星、仿真花、花束、蜡烛、窗帘等各有专属文案
  - Lifestyle 场景：客厅花瓶、餐桌中心、卧室床头等 6 种随机
- **电子/科技品类** — 充电器、耳机、手机壳、键鼠、灯具各有专属文案
- **BENEFIT_MAP 扩展** — 新增 25+ 条美妆/家居/电子品类匹配规则
- **修复 "Home Upgrade" → "Elevate Your Space"** — 更适合家居品类

### 思路
之前指甲油生成出 "Built Tough, Won't Bend"、"Extra Sturdy" 等五金风格文案，因为 `deriveResultHeadline` 和 `BENEFIT_MAP` 缺少美妆品类判断，产品落入了通用文案池。通过在 4 个关键函数（`BENEFIT_MAP`、`deriveResultHeadline`、`deriveValueHeadline`、`getCategorySceneGuide`）中加入美妆/家居/电子品类的检测和专属文案，确保不同品类使用对应风格的标语和场景。

### 修改文件
- `src/lib/prompt-templates.ts` — BENEFIT_MAP +25 条规则，deriveResultHeadline +30 行品类判断，deriveValueHeadline +15 行，getCategorySceneGuide +2 个品类场景库

---

## 2026-03-18 — 安全修复 + 违禁词过滤 + 图片质量优化（大版本更新）

### 安全修复（严重）
- **路径遍历漏洞修复** — `history.ts` 添加 `isValidId()` 校验，防止通过 `../../` 读取服务器文件
- **速率限制** — 新增 `checkRateLimit()` 全局限流器，所有 API 端点已接入（generate 5次/分钟，analyze 10次/分钟等）
- **LLM 提示词注入防护** — 新增 `sanitize.ts`，用户输入在拼入 prompt 前自动清洗
- **SSE 断开连接处理** — 客户端断开后停止后台图片生成，不再浪费 API 额度
- **API 超时** — 所有 OpenAI 客户端添加超时（生图 2 分钟，分析 1 分钟，评分/标题 30 秒）

### 思路
之前所有 API 端点完全裸奔，任何人可以无限调用刷爆 AI 额度。history 接口存在路径遍历风险可读取服务器任意文件。SSE 连接断开后后台任务继续运行浪费资源。

### 亚马逊违禁词过滤系统
- **新增 `prohibited-words.ts`** — 80+ 违禁词库，覆盖虚假排名、医疗声明、绝对化用语、促销用语等
- **三层防护** — 源头过滤（BENEFIT_MAP）+ 代码过滤器 + AI prompt 指令
- **图片文案 + 标题双重过滤** — 所有生成的文案自动检测并替换违禁词
- 去掉 "Best Seller"、"5-Star Pick"、"Eco-Friendly"、"Healing"、"100%" 等虚假/未认证声明

### 思路
亚马逊对 listing 图片上的文字有严格限制，虚假声明（Best Seller）和未认证环保声明（Eco-Friendly）会导致下架。通过三层过滤确保文案合规。

### 图片生成质量优化
- **珠宝/宝石专属文案** — 14 种宝石专属标语（蓝晶石→"Calm Blue Energy"，红玛瑙→"Bold Red Elegance"，海蓝宝→"Ocean Blue Clarity" 等）
- **产品颜色还原** — 新增 `colorAccuracyRule`，把分析出的颜色信息注入 prompt
- **模特多样性** — 新增 `modelDiversityRule`，不再默认白人模特
- **Lifestyle 场景多样化** — 珠宝类 8 种场景随机选（约会、咖啡馆、花园等），禁止瑜伽/办公
- **close-up 背景多样化** — 5 种背景随机选（白大理石、深色石板、亚麻布等），禁止白色毛绒布
- **手部细节强化** — 明确 5 根手指、3 段指节、拇指独立
- **去掉放大镜道具** — `closeupStyles` 中移除 "magnifier effect"
- **Stackable → Layered** — 珠宝类使用 "Layered Design" 而非 "Stackable Design"

### 思路
之前所有珠宝都用 "Shine Every Day"，所有 close-up 都是白色毛绒布背景，模特全是白人，场景固定瑜伽/冥想。通过按品类/材质细分文案和场景，提升生成图片的针对性和多样性。

### 性能优化
- **OpenAI 客户端单例化** — 4 处 `getClient()` 改为单例模式，避免每次请求重新创建
- **白底处理优化** — `enforceWhiteBackground` 从逐像素 JS 循环改为 sharp `flatten()` 原生操作
- **PM2 内存限制** — 从 1G 提升到 2G
- **请求体大小限制** — `next.config.ts` 添加 `bodySizeLimit: "10mb"`
- **移除未使用 API Key** — 删除 `.env.local` 中的 `FAL_KEY` 和 `GOOGLE_API_KEY`

### 修改文件
- `src/lib/prohibited-words.ts` — 新增：违禁词库
- `src/lib/sanitize.ts` — 新增：输入净化工具
- `src/lib/api-auth.ts` — 新增速率限制器
- `src/lib/prompt-templates.ts` — 大幅更新：违禁词规则、珠宝文案、场景多样化、颜色还原
- `src/lib/image-gen.ts` — 单例客户端、sharp 白底优化、超时设置
- `src/lib/history.ts` — 路径遍历修复
- `src/lib/analyze.ts` — 单例客户端、超时
- `src/app/api/generate/route.ts` — SSE 断开处理、速率限制、try-catch
- `src/app/api/score/route.ts` — 单例客户端、速率限制、超时
- `src/app/api/title/route.ts` — 输入净化、速率限制、单例客户端
- `src/app/api/analyze/route.ts` — 速率限制
- `ecosystem.config.js` — 内存限制 2G
- `next.config.ts` — 请求体限制

---

## 2026-03-18 — 全面代码审查 & 7 项 Bug 修复

**改了什么**:

### BUG 1 (严重): 历史记录缩略图死代码 — `history.ts`
- **问题**: `listHistory()` 中生成缩略图的逻辑将 base64 截断到 200 字符并拼接 `...`，生成的是无效 data URL。且 `thumbnail` 变量生成后从未被使用，是死代码。
- **修复**: 删除整段无效的缩略图生成代码（约 10 行）。
- **思路**: 死代码增加维护负担且逻辑本身有错，直接清理。

### BUG 2 (严重): 历史记录图片 MIME 类型错误 — `history.ts`
- **问题**: 保存历史时所有图片固定用 `.png` 扩展名和 `image/png` MIME，但 `image-gen.ts` 中非主图输出的是 JPEG。导致读取历史记录时 JPEG 图片被错误标记为 PNG，浏览器可能无法正确渲染。
- **修复**: 保存时从 data URL 提取真实 MIME 类型（`image/jpeg` 或 `image/png`），用对应扩展名（`.jpg`/`.png`）。读取时从存储的 `mime` 字段还原，兼容旧数据用扩展名 fallback。
- **思路**: 跟踪数据的真实格式，而不是硬编码假设。

### BUG 3 (中等): MODEL 变量模块顶层求值 — `image-gen.ts`
- **问题**: `const MODEL = process.env.GENERATE_MODEL || "..."` 在模块加载时一次性求值。如果环境变量运行时变更不会反映。同文件的 `getClient()` 每次调用时读取 env，行为不一致。
- **修复**: 改为 `getModel()` 函数，每次调用时读取 `process.env`。
- **思路**: 与 `getClient()` 保持一致的懒读取模式。

### BUG 4 (中等): generate 路由缺少 try-catch — `generate/route.ts`
- **问题**: `formData` 解析和 `JSON.parse(plans)` 在创建 SSE stream 之前执行，没有 try-catch。如果请求格式错误会抛未捕获异常导致 500。其他路由（analyze、regenerate）都有 try-catch 保护。
- **修复**: 给 `req.formData()` 和 `JSON.parse()` 分别加 try-catch，并增加 `plans.length === 0` 的前置校验。
- **思路**: 防御性编程，在进入流式处理之前拦截所有可预见的输入错误。

### BUG 5 (中等): dimensions 类型图片误报 warning — `prompt-templates.ts` + `generation-guard.ts`
- **问题**: `validatePlan()` 检查 prompt 是否包含 "clean corners"、"product identity rule"、"structure lock rule" 文本。但 dimensions 类型的 prompt 模板没有包含这三条规则，导致每次生成 dimensions 图都会触发 3 条虚假 warning。
- **修复**: 在 dimensions prompt 模板中补上 `cleanCornerRule`、`productIdentityRule`、`structureLockRule`。
- **思路**: prompt 模板应包含验证器期望的所有规则，保持一致性。同时这三条规则对 dimensions 图片也确实有用（防水印、保持产品外观）。

### BUG 6 (安全): 历史记录路径遍历风险 — `history.ts`
- **问题**: `getHistoryEntry(id)` 中 `id` 直接来自 URL query 参数，拼接到文件路径后无校验。攻击者可传 `../../etc` 等路径读取服务器任意目录。
- **修复**: 新增 `isSafeId()` 函数，只允许 `[\w-]+`（字母数字下划线短横线）格式的 ID，不匹配则返回 null。
- **思路**: 输入校验在安全边界做，白名单比黑名单更安全。

### BUG 8 (低): saveToHistory 重复保存 — `page.tsx`
- **问题**: `useEffect` 监听 `[step, isGenerating, saveToHistory]`，而 `saveToHistory` 是 `useCallback`，依赖 `jobs`/`analysis`/`salesRegion`。每次这些状态变化都会创建新的函数引用，重新触发 effect，导致历史记录被重复保存多次。
- **修复**: 用 `useRef(false)` 标记是否已保存。进入 results 时只保存一次，离开 results 时重置标记。
- **思路**: ref 不会触发重渲染，是防止 effect 重复执行的标准模式。

**审查思路**:
按模块分层审查：API 路由 → 核心库 → 前端组件 → 主页面逻辑。重点关注：数据流一致性（MIME 类型跨层传递）、输入校验（安全边界防御）、状态管理（React effect 的依赖陷阱）、错误处理完整性。

---

## 2026-03-18 — 添加一键启动脚本

**提交**: `8b19daa`

**改了什么**:
- 新增 `start.cmd` 一键启动脚本
- 双击即可启动 PM2 + Next.js + Cloudflare Tunnel
- 自动显示外网访问链接

**思路**:
方便非技术用户使用。双击 `start.cmd` 就能启动整个服务并获得外网分享链接，不需要手动执行命令。

---

## 2026-03-18 — 移除多规格尺寸表功能

**提交**: `8cb8cb1`

**改了什么**:
- 从 `ImageType` 联合类型中删除 `sizeChart`
- 删除 `SizeVariant` 接口和 `AnalysisResult.sizeVariants` 字段
- 删除分析 prompt 中的尺寸变体检测逻辑
- 删除 AnalysisResult 组件中的尺寸编辑器 UI
- 删除 prompt-templates 中的 sizeChart prompt 模板
- 删除评分标准中的 sizeChart 条目
- 删除 ImageTypeSelector 中的 sizeChart 辅助文字

**思路**:
用户反馈不需要多规格尺寸表功能，认为该功能不实用。彻底移除而非仅隐藏，保持代码干净。涉及 7 个文件，共删除 143 行代码。

---

## 2026-03-17 — 大版本升级：评分、标题、尺寸表、lifestyle 优化

**提交**: `e21a1cb`

**改了什么**:
- **并发优化**: CONCURRENCY 从 3 提升到 8，所有图片并行生成
- **标题并行生成**: 标题和图片同时开始生成（fire-and-forget），不再需要单独点按钮
- **JPEG 输出**: 非主图输出 JPEG（quality=90），减小文件体积，主图保持 PNG
- **图片评分并行化**: `scoreAll` 从顺序改为 `Promise.all` 并行评分
- **移除三个功能**: 用户不要 ListingCopy、APlusCopy、CompetitorKeywords，从页面移除
- **手部畸形修复**: 添加 `humanAnatomyRule`，约束 AI 正确生成手部（5 指、正确关节）
- **lifestyle 场景优化**:
  - 添加 `getProductVisibilityRule()` — 小件商品（珠宝、手表等）强制近景拍摄
  - 添加 `getCategorySceneGuide()` — 按品类推荐场景（珠宝→约会/咖啡馆，宠物→公园/沙发等）
  - 修改 `deriveResultHeadline()` — 标题优先匹配品类而非场景
  - 添加场景-品类不匹配约束
- **多规格尺寸表**: 新增 sizeChart 图片类型（后来被移除）
- **手机预览**: 新增 MobilePreview 组件，模拟 iPhone 上的 Amazon 浏览效果
- **图片排序优化**: 新增 ImageOrderOptimizer 组件，AI 推荐最佳图片顺序

**思路**:
用户需要更快的生成速度和更智能的 prompt。核心思路是"并行一切"——图片并行生成、评分并行、标题和图片并行。lifestyle 图片问题集中在两个方面：AI 生成的手部畸形（通过 prompt 约束缓解）和场景与商品品类不匹配（通过品类感知的场景推荐解决）。

---

## 2026-03-16 — 销售地区系统

**提交**: `65149ab`

**改了什么**:
- 新增 `SalesRegion` 类型，支持 10 个地区（美国、欧洲、英国、日本、韩国、中国、东南亚、中东、拉美、巴西）
- 每个地区配置：语言、文字方向、拍摄风格、模特族裔、场景风格、色调偏好
- 图片 prompt 注入地区风格指导
- UI 添加地区选择器（带国旗图标）

**思路**:
亚马逊卖家在不同站点销售，需要匹配当地审美和语言。比如日本站需要精致 infographic 风格 + 日语文字，中东站需要 RTL 排版 + 奢华调性。之前只有语言选择，现在升级为完整的地区配置系统。

---

## 2026-03-16 — 图片语言选择器

**提交**: `922023d`

**改了什么**:
- 添加图片文字语言选择（12 种语言）
- 分析结果改为中英双语输出

**思路**:
解决跨境卖家需要不同语言图片的需求。分析用中文方便审核，生成用目标语言。

---

## 2026-03-16 — 修复中文出现在图片中

**提交**: `a9bf145`

**改了什么**:
- 修复生成图片意外出现中文文字的问题
- 添加多语言分析支持

**思路**:
AI 模型会从中文分析结果中"泄漏"中文到图片。解决方案是分析输出双语（中文供人看 + English 供 prompt 用）。

---

## 2026-03-16 — 图片裁剪模式优化

**提交**: `51ffc3f`

**改了什么**:
- 图片 resize 从 `contain`（留白）改为 `cover`（填充裁剪）

**思路**:
`contain` 模式会在图片周围留白边，不符合 Amazon listing 图片要求。改为 `cover` 填满整个 800x800 画布。

---

## 2026-03-16 — lifestyle prompt 增强（第三轮）

**提交**: `fe37706`

**改了什么**:
- lifestyle prompt 加入购买动机和多样化场景描述

**思路**:
让 lifestyle 图更有"购买欲"，场景更丰富多变，避免千篇一律。

---

## 2026-03-16 — prompt 随机化 + 去重文字

**提交**: `2548f98`

**改了什么**:
- 给 prompt 添加随机元素，避免每次生成雷同
- 修复图片上出现重复文字的问题
- 降低图片文字密度

**思路**:
用户反馈图片重复度高，文字太多太杂。随机化让每次生成有变化，减少文字让图片更清爽。

---

## 2026-03-16 — lifestyle prompt 增强（第二轮）

**提交**: `5314d8c`

**改了什么**:
- 添加氛围感、背景虚化（bokeh）、电影感打光等指令

**思路**:
提升 lifestyle 图的视觉质感，让生成的图片更接近专业商业摄影。

---

## 2026-03-14 — 强制 800x800 尺寸

**提交**: `a39c01d`

**改了什么**:
- 使用 sharp 库将所有生成图片强制 resize 到 800x800px

**思路**:
Amazon 主图要求正方形，AI 生成的图片尺寸不一致。统一 resize 确保合规。

---

## 2026-03-14 — 双语分析输出

**提交**: `f69b15b`

**改了什么**:
- 分析结果改为中英双语格式

**思路**:
中文方便卖家审核理解，英文用于喂给图片生成 prompt，避免中文泄漏到图片中。

---

## 2026-03-14 — 防止中文出现在图片中（多轮修复）

**提交**: `45a0eae`, `ddae7e1`

**改了什么**:
- 分析 API 返回英文结果
- 添加更强的"纯英文"规则 + 中文翻译示例

**思路**:
AI 模型顽固地在图片上生成中文。反复加强 prompt 约束，提供明确的翻译对照，最终配合双语输出彻底解决。

---

## 2026-03-14 — 品牌安全 + 商品保真

**提交**: `bca8513`, `b8b2bd5`

**改了什么**:
- 添加 no-brand-logo 规则，禁止在图片中出现商标
- 优化 prompt 提升商品还原度和正确使用方式

**思路**:
防止侵权风险（AI 可能随机生成知名品牌 logo）。同时确保生成图片中的商品外观与原图一致，使用方式正确。

---

## 2026-03-14 — 禁止未成年人

**提交**: `44a979b`

**改了什么**:
- 在所有 prompt 中添加禁止生成婴儿和未成年人的规则

**思路**:
合规要求 + 规避风险。AI 生成的儿童图片存在法律和伦理风险。

---

## 2026-03-14 — 单品/套装模式 + 包装保真

**提交**: `78e3c2c`

**改了什么**:
- 图片生成适配单品/套装两种模式
- 加强"不要捏造包装"规则

**思路**:
套装和单品的拍摄逻辑不同（套装需要展示所有组件）。AI 容易"想象"出不存在的精美包装盒，需要强约束。

---

## 2026-03-14 — Premium UI 重构

**提交**: `5a2a935`

**改了什么**:
- 全新 Premium UI 设计（渐变、玻璃拟态、动画）
- 单品/套装模式切换
- 可编辑的分析结果
- 英文图片生成

**思路**:
第一版 UI 太简陋，重新设计为专业工具级外观。添加分析结果可编辑功能，让用户能在 AI 分析基础上微调。

---

## 2026-03-13 — 项目初始化

**提交**: `a0b4170`, `fa7196d`, `786827c`

**改了什么**:
- Next.js 15 + React 19 + TypeScript + Tailwind CSS 项目搭建
- 多图上传 + 组合模式
- AI 分析 → prompt 生成 → 图片生成完整流程
- Gemini API 集成（通过 OpenAI 兼容接口）
- Vercel 部署适配（lazy init、env var fallback）

**思路**:
从零搭建亚马逊商品图片生成器。核心流程：上传商品图 → AI 分析商品特征 → 生成 7 种 Amazon listing 图片（主图、卖点、细节、尺寸、lifestyle 等）。选择 Next.js 做全栈，Gemini 做图片生成（性价比高）。
