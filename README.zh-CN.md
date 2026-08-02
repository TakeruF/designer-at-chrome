# UI Lens — Design Inspector

[日本語](./README.md) | [English](./README.en.md) | [简体中文](./README.zh-CN.md)

UI Lens 是一款本地优先的 Chrome 扩展，可帮助你通过真实网站学习 UI 设计。选择页面上的元素后，即可在 Chrome 侧边栏中查看其 UI 模式、排版、颜色、间距、外观、布局和 HTML 结构。你还可以为喜欢的元素添加截图和笔记并保存，建立可搜索、可浏览的个人 UI 参考库。

## 主要功能

- Chrome 侧边栏中的 `Inspect` 和 `Bookmarks` 标签页
- 悬停高亮、点击选择，以及按 `Escape` 退出检查模式
- 从选中元素移动到父元素，并通过选择历史返回子元素
- 在普通页面跳转或 SPA 跳转导致 URL 变化时，自动清除选区和轮廓
- 提取 Basic、Typography、Colors、Spacing、Appearance、Layout 和 Structure 信息
- 列出选区内包含文本的元素所使用的字体
- 使用 HTML、ARIA、CSS、位置和子元素在本地进行基于规则的 UI 模式识别
- 将选中元素的可见区域以支持高 DPI 的 WebP 截图保存
- 对 `video` 元素或包含视频的区域，可选择记录当前帧、整个播放器或选中范围
- 保存视频时间码、分辨率、字幕、控件信息及截图限制
- 推测自定义播放器范围、在父子层级间调整截图范围、按需暂停视频并恢复原始状态
- 检测疑似受保护的黑色或透明视频帧，并改为保存周边 UI 或占位图
- 带标题、分类、标签和笔记的本地书签
- 搜索、分类筛选、新旧排序、详情查看、编辑和删除
- 通过 ZIP 导出和导入书签、原图及缩略图
- 可在设置中选择跟随系统、浅色或深色主题
- 跟随浏览器或操作系统 `AccentColor` 的强调色，不支持时回退为 Chrome 蓝色
- 支持日语、英语和简体中文界面；首次使用时跟随 Chrome 的界面语言
- 可在设置中切换按网站授权（默认）或一次性授权所有网站
- 从 Inspect 或设计库中复制包含已提取结构和样式的 AI 复现提示词
- 面向初学者的 CSS 术语说明和 UI 判定理由日英本地词典

## 技术栈

- Chrome Extension Manifest V3
- React 19 / TypeScript（strict mode）
- Vite（侧边栏）+ esbuild（Service Worker / Content Script 独立打包）
- Chrome Side Panel API / Content Scripts / Service Worker
- `chrome.storage.local`（元数据和 UI 状态）
- IndexedDB（原始截图和缩略图 Blob）
- JSZip（ZIP 导出和导入）
- Vitest / jsdom / ESLint / Prettier

## 安装

建议使用 Node.js 20 或更高版本。

```bash
npm install
```

## 开发服务器

```bash
npm run dev
```

Vite 开发服务器用于开发侧边栏 UI 样式。若要测试依赖 Chrome API 的元素选择、截图和保存等集成功能，请按下方步骤将构建后的扩展加载到 Chrome 中。

## 构建

```bash
npm run build
```

构建完成后，`dist/` 中会生成可解压加载的 Manifest V3 扩展。

## 加载到 Chrome

1. 运行 `npm run build`。
2. 在 Chrome 中打开 `chrome://extensions`。
3. 启用右上角的“开发者模式”。
4. 选择“加载已解压的扩展程序”。
5. 选择此仓库的 `dist/` 目录。
6. 打开普通的 `http://` 或 `https://` 页面，然后点击工具栏中的 UI Lens 图标。
7. 如有需要，点击“允许此网站”。权限仅适用于当前网站，并在 Chrome 确认后保存。
8. 在侧边栏中点击“选择元素”，然后选择页面上的元素。

修改代码后，请再次运行 `npm run build`，并在 `chrome://extensions` 中重新加载扩展。

## 测试与质量检查

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

单元测试覆盖以下内容：

- RGB / RGBA / CSS Color 4 到 HEX 的转换及透明度处理
- 基于规则的 UI 模式识别
- CSS 选择器生成
- 书签和导入数据校验
- 导入时的 ID 冲突处理
- 视频帧时间显示、播放器范围评分和受保护内容候选像素判断
- 根据选中元素和已保存书签生成日英 AI 复现提示词

## 权限及用途

| 权限                     | 用途                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `sidePanel`              | 从扩展图标打开 Chrome 侧边栏                                 |
| `storage`                | 在本地保存书签元数据、设置和 UI 状态                         |
| `activeTab`              | 仅在用户打开扩展后检查和截图当前标签页                       |
| `scripting`              | 在用户操作后向当前标签页注入 Inspector Content Script        |
| `tabs`                   | 获取活动标签页、截取可视区域，并在新标签页中打开书签来源页面 |
| `<all_urls>`（可选权限） | 临时 `activeTab` 权限失效后，在用户明确保存时继续进行截图    |

`optional_host_permissions` 声明了 `<all_urls>`，但安装时不会请求访问所有网站。该声明允许扩展仅请求所需的 origin。通常情况下，UI Lens 使用用户点击工具栏图标后获得的临时 `activeTab` 权限。如果用户保持侧边栏打开并跳转到其他域名，只有在点击“允许此网站”时，扩展才会请求仅限当前 origin 的权限。希望一次授权的用户也可在设置中允许访问所有网站。默认采用按网站授权。

根据 Chrome 的规则，`captureVisibleTab()` 需要临时 `activeTab` 权限或字面意义上的 `<all_urls>` 权限。如果用户在页面跳转等导致临时权限失效后保存元素，UI Lens 会先说明原因，再请求用于截图的可选权限。用户可以拒绝，并改为在目标标签页中再次点击 UI Lens 工具栏图标以重新获得临时权限。即使已获得授权，截图也只会在用户明确执行“保存”操作时进行。

扩展不会永久获取任何 `host_permissions`。Content Script 不会通过 manifest 常驻所有页面，而只会在用户操作后注入当前标签页。可选权限和已授权网站都可以随时在 Chrome 的扩展设置中撤销。

## 本地存储机制

### `chrome.storage.local`

- 书签元数据
- 提取的样式、结构和 UI 模式识别结果
- 主题、显示语言和最后打开的标签页

### IndexedDB（`ui-lens-images`）

`screenshots` 对象存储区中保存：

- `fullImageBlob`：`image/webp`、质量 0.85 的原图
- `thumbnailBlob`：最大宽度 400 px 的列表缩略图
- 图片尺寸、MIME 类型、保存时间和书签 ID

图片不会转换为 Base64 并存入 `chrome.storage.local`。截图过程中临时生成的 PNG data URL 仅用于在 Service Worker 中通过 Canvas 载入图片，并会在保存前转换为 WebP Blob。

删除书签时，会同时删除 IndexedDB 中的图片和 `chrome.storage.local` 中的元数据。导出的 ZIP 结构如下：

```text
bookmarks.json
images/{bookmarkId}.webp
thumbnails/{bookmarkId}.webp
```

导入时会校验 JSON；如果 ID 与现有书签或同一压缩包内的其他记录重复，将生成新的 UUID。缺少图片的记录会被跳过，无效 JSON 不会替换现有数据。MVP 将 ZIP 限制为 250 MB，每次最多导入 1,000 条记录。如果导入中途失败，该次操作已添加的图片会被回滚。

## 截图流程

1. Content Script 获取选中元素的 `getBoundingClientRect()` 和 `devicePixelRatio`。
2. 如果选区包含视频，则记录截图范围和当前播放位置，并根据设置暂停正在播放的视频。
3. 暂时隐藏选择和悬停遮罩。
4. 使用 `chrome.tabs.captureVisibleTab()` 截取当前视口。
5. Service Worker 使用 `OffscreenCanvas`，根据 DPR 进行裁剪。
6. 生成质量 0.85 的 WebP 图片和最大宽度 400 px 的缩略图。
7. 将 Blob 保存到 IndexedDB，恢复遮罩及视频原始播放状态。

如果元素超出视口，只保存可见部分，并记录 `clippedToViewport` 标记及 UI 提示。对于视频，可以选择当前帧、整个播放器 UI 或选中的区块。仅为截图而暂停的视频会在截图完成后恢复原来的播放状态。

视频截图也不会将 `video` 直接绘制到 Canvas。它与普通元素一样，先截取整个标签页再裁剪，因此可以按显示效果保存当前帧、字幕、自定义控件和周边布局。“Include player controls”不会修改 DOM 属性，只会通过鼠标移动事件尝试显示现有控件。UI Lens 不保存视频 URL 或视频文件。

如果视频截图区域大部分为黑色或透明，UI Lens 会提示内容可能受到保护，并允许选择仅保存播放器周边 UI、用占位图替换视频区域，或取消操作。扩展不会尝试绕过 DRM 或 Encrypted Media Extensions。

## 隐私

- 不会将浏览页面的内容发送到浏览器外部。
- 截图仅保存在用户的浏览器中。
- 无需注册账户。
- 不使用外部分析工具、广告 SDK 或云端 API。
- 扩展自身不会发起外部网络请求。
- AI 复现提示词根据已提取的数据在本地生成，只在用户操作后复制到剪贴板，不会发送给任何 AI 服务。
- 页面 favicon URL 会作为元数据记录，但扩展 UI 不会重新获取或显示它。

## 当前限制

- MVP 不支持选择 iframe 内的元素，仅检查顶层 frame。
- 在可行范围内，通过事件 composed path 和以 Shadow Root 为单位的选择器表达式支持 open Shadow DOM。受 Web 平台限制，无法完整访问 closed Shadow DOM 内部。
- 不会通过多次滚动截图拼接完整元素或完整页面。
- 无法检查 `chrome://`、Chrome 应用商店、浏览器内部页面、其他扩展页面等禁止注入脚本的页面。侧边栏会显示原因。
- 对于普通 HTML 视频，会保存当前帧、时间码、视频分辨率、显示尺寸、播放和静音状态、字幕检测结果等信息。当选区包含多个视频时，以第一个可见视频为主要对象。
- DRM 保护视频、Encrypted Media Extensions、硬件叠加层或 WebGL 合成视频可能无法获取画面。黑屏检测基于启发式规则，因此可能将较暗的画面误判为受保护内容。
- 隐藏的原生或自定义控件可能因网站实现方式而无法显示。扩展不会强行修改页面 DOM，而是继续保存视频帧。
- 暂停前不会更改 `currentTime`、音量或静音状态。如果浏览器自动播放限制导致截图后无法恢复播放，该限制会记录在保存的元数据中。
- 基于规则的识别使用启发式方法返回最可能的候选结果。对于含义不明确的元素，会显示较低的置信度。
- 不进行浏览器间同步，数据按 Chrome 配置文件保存。迁移时请使用 ZIP 导出。
- SPA 的 URL 变化不会重新注册 Content Script，而会继续检查当前 DOM；如果选中元素因重新渲染而被销毁，则需要重新选择。

## 后续扩展设想

- 拼接截图以支持需要滚动的大型元素
- 支持 iframe，并增强跨 Shadow DOM 边界的选择器
- 比较两个书签的样式
- 自动聚类 CSS token 并显示调色板
- 以 JSON 或 Markdown 格式导出学习笔记
- 完全使用键盘导航元素树
- 完全本地运行的相似设计搜索

## 许可证

本项目基于 [MIT License](./LICENSE) 发布。

## 主要文件结构

```text
src/
  background/
    service-worker.ts       # 侧边栏协调、权限边界和 Content Script 注入
    screenshot.ts           # 视口截图、DPR 裁剪和 WebP 生成
    protected-content.ts    # 推测黑色或透明视频区域是否为受保护内容
  content/
    inspector.ts            # 选择模式、事件、父子历史和消息处理
    overlay.ts              # Shadow DOM 内的悬停和固定轮廓
    element-analyzer.ts     # Basic 信息和 computed style 提取
    pattern-detector.ts     # 基于规则的 UI 模式识别
    selector-generator.ts   # CSS 选择器生成
    video-analyzer.ts       # 视频元数据提取和播放器范围推测
  sidepanel/
    App.tsx                 # 标签页、主题、语言和选择事件协调
    i18n.tsx                # 日语、英语和简体中文本地词典及 Context
    host-permissions.ts     # 仅限当前网站的可选权限请求
    components/             # Summary、详情、卡片和保存表单
    pages/                  # Inspect / Bookmarks / Settings
    hooks/                  # IndexedDB Blob 的 Object URL
    styles.css              # 设计 token 和响应式 UI
  storage/
    bookmark-storage.ts     # chrome.storage.local CRUD
    screenshot-db.ts        # IndexedDB CRUD
    export-import.ts        # ZIP 导入和导出
    validation.ts           # 防御性数据校验和 ID 冲突处理
  shared/
    types.ts                # 类型定义和可辨识联合消息
    messages.ts             # 类型安全的消息发送
    color-utils.ts          # CSS 颜色转换
    media-utils.ts          # 视频时间码格式化
    reproduction-prompt.ts  # 在本地生成日英 AI 复现提示词
    glossary.ts             # 面向初学者的本地词典
```
