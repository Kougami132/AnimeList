# Coding Standards

本项目（AnimeList）的编码规范与架构基线。新增、重构或审查代码时必须严格遵守。

## Architecture and Layer Boundaries

遵循单向分层依赖链：`domain` $\rightarrow$ `data` $\rightarrow$ `app` $\rightarrow$ `features` $\rightarrow$ `ui`。

- **Domain purity**: `src/domain/` 仅承载纯函数、数据结构、规范化（normalization）与业务不变式；严禁依赖任何上层模块（`src/data/`、`src/app/`、`src/features/`、`src/ui/`）。
- **Data abstraction**: `src/data/` 封装 Markdown 编解码器（codec）、Repository、Vault 文件读写与外部元数据客户端；上层模块只能通过类型化的 Data Service 访问持久化层。
- **Application composition**: `src/app/` 负责组合各子服务、管理 Feature Registry 与 Settings Store；统一编排生命周期，文件策略与具体序列化交由 Data Service 处理。
- **Feature modularity**: 特性定义统一置于 `src/features/` 并使用 `defineFeature()` 声明能力清单（`lifecycle`、`library`、`search`、`media-form`、`detail`、`workspace-page`、`workspace-action`），并在 `src/plugin-entry.ts` 中显式注册。
- **UI separation**: `src/ui/` 仅负责 DOM 渲染、交互视图、Modal 弹窗与用户输入；UI 组件通过轻量 Host Contract 调用数据服务。
- **Root containment**: `src/` 根目录仅允许入口与兼容垫片文件（`app-metadata.ts`、`legacy.ts`、`main.ts`、`plugin-entry.ts`、`types.ts`、`ui-text.ts`），严禁散落其他实现文件。
- **Frozen legacy barrel**: `src/legacy.ts` 为历史兼容垫片且已冻结（行数严格 $\le$ 25 行）；禁止向其追加任何类或函数实现，活跃代码禁止从中导入。
- **Acyclic dependency graph**: 所有源码依赖关系必须构成严格的有向无环图（DAG）；严禁引入模块循环依赖。

## Obsidian Platform and API Safety

严格遵从 Obsidian 社区插件安全准则与 DOM 操作规范：

- **Obsidian DOM helpers**: 创建 DOM 节点必须使用 Obsidian 原生辅助方法（`createEl()`、`createDiv()`、`createSpan()`、`empty()`）或项目封装的 `makeEl()`；严禁调用原生 `document.createElement()`、`document.createTextNode()` 或 `document.createDocumentFragment()`。
- **Zero raw HTML injection**: 填充文本或节点内容必须使用 `textContent` 或 Obsidian DOM 构建器；严禁对 `.innerHTML`、`.outerHTML` 赋值或调用 `insertAdjacentHTML()`，杜绝 XSS 风险。
- **Scoped vault traversal**: 文件检索必须使用 `getScopedMarkdownFiles(app, roots)` 仅扫描用户配置的媒体目录；严禁全库枚举（如直接调用 `app.vault.getMarkdownFiles()` 或 `app.vault.getFiles()`）。
- **Type-narrowing guards**: 遍历 Vault 文件树时必须使用 `instanceof TFile` 与 `instanceof TFolder` 进行运行时类型收窄；严禁使用未经验证的类型断言（如 `as TFile`）。
- **Workspace leaf preservation**: 插件卸载（`onunload`）时必须保留工作区已有 Leaf 实例；严禁调用 `detachLeavesOfType()` 破坏用户的工作区状态。
- **Host prototype integrity**: 必须通过标准 API 注册功能；严禁对宿主原型打补丁（如覆写 `Modal.prototype`、`fileManager.processFrontMatter`）或替换插件/渲染器实例方法。
- **Explicit lifecycle hooks**: 视图与组件注册必须挂载在插件标准生命周期上；严禁使用 `MutationObserver` 探测 DOM 挂载或销毁。
- **Network requests**: 所有外部 HTTP/GraphQL 请求必须调用 Obsidian 原生 `requestUrl()`，携带统一的 `USER_AGENT`、明确的超时保护（Timeout）与缓存控制机制。

## Data Persistence and Note Compatibility

保障用户 Markdown 笔记与 YAML Frontmatter 的完整性与可读性：

- **Markdown as source of truth**: 本地笔记与 YAML Frontmatter 是数据的唯一真源；严禁引入私有数据库（如 SQLite）或私有二进制格式存储状态。
- **Service-owned persistence**: Frontmatter 修改必须收敛在类型化的 Data Service（如 `MediaRepository`、`MediaUpdateService`、`ReleaseTrackingStateService`）内部；Feature 与 UI 层严禁直接调用 `fileManager.processFrontMatter`。
- **Additive, non-destructive updates**: 修改元数据或代码块（`animelist-images`、`animelist-moments`、`animelist-detail`）时，必须完整保留未托管的 YAML 字段、注释以及周围的正文 Markdown。
- **Reference-aware asset cleanup**: 删除或移至回收站（Trash）托管资源（封面/插图）前，必须调用 `MediaAssetGarbageCollector` / `MediaImageReferenceService` 进行全域引用检测；严禁删除仍被其他笔记或代码块引用的文件。
- **Strict tracking boundary**: 发行追踪（Release Tracking）元数据（`latest_chapter`、`latest_volume`、`release_tracking_*`）属于只增字段；严禁让外部抓取状态覆盖用户的个人阅读进度（`progress`、`volume_log`）、状态、评分或个人笔记正文。

## UI and Interaction Design

保障交互流畅、无状态泄漏与跨端稳定性：

- **Image fallback contract**: 每次创建面向用户的 `<img>` 元素，必须显式绑定失败回退契约（调用 `bindImageFallback()` 或监听 `error` 事件），杜绝浏览器破碎图裂痕。
- **In-place drag interactions**: 指针拖拽与排序必须保留原始 DOM 节点，通过轻量占位条（Drop Indicator）展示目标位置；严禁使用 `cloneNode()` 深度克隆整张卡片或媒体视图。
- **Mobile swipe isolation**: 自定义的横向滚动交互容器必须调用 `isolateHorizontalSwipeSurface()` 标记表面，防止触发移动端侧边栏的原生滑动手势。
- **Progressive list rendering**: 大量列表与瀑布流（如媒体库、评分看板）必须采用 `ProgressiveRenderWindow` 分批按需渲染，保障 60fps 滚动性能。
- **Durable order sessions**: 图片区等列表重排交互必须先在内存与 Journal 侧写文件中记录 Pending Order，待渲染器销毁后批量提交持久化；严禁在拖拽过程中同步覆写 Markdown。
- **Cancellable async operations**: 长耗时异步查询与交互操作必须接收并透传 `AbortSignal`，调用 `throwIfAborted()` 或 `abortable()`，在弹窗关闭或视图切走时立即中断在途请求。

## Styles and CSS Baseline

保证样式隔离并适配 Obsidian 最低浏览器内核基线：

- **Source organization**: 特性样式文件统一存放在 `styles/<feature>.css` 并在 `scripts/style-bundle.mjs` 中注册；根目录 `styles.css` 为构建产物，不可手动直接编辑。
- **Namespace scoping**: 所有自定义样式选择器必须统一使用 `.al-` 或 `.animelist-` 前缀命名空间。
- **Design tokens**: 优先使用 Obsidian 核心 CSS 变量（如 `--text-normal`、`--background-secondary`、`--interactive-accent`）搭配局部 `--al-*` 变量，自动适配深浅主题。
- **Zero `!important` overrides**: 严禁在样式表中使用 `!important` 或 `stylelint-disable`；若需提高显示优先级，采用复合选择器或 `:is(...):not(...)` 特异性分层。
- **Standard layout primitives**: 布局仅限使用 Flexbox 与 Grid；严禁使用 CSS 多列属性（`columns`、`column-count`、`column-width`）或断裂属性（`break-inside`）。
- **Native scrollbars**: 滚动容器使用原生 Overflow；严禁自定义滚动条样式（`scrollbar-width`、`scrollbar-color`、`::-webkit-scrollbar`）。

## Localization and UI Text

集中管理全部用户端展示文本：

- **Centralized text catalogs**: 所有展示文本必须注册在 `src/i18n/catalog.ts` 的类型化命名空间中，通过 `uiText()` 或特性 Facade 函数读取。
- **Four-locale parity**: 新增任何展示文案键，必须同步在 `src/i18n/locales/` 下提供 4 种语言翻译：`zh-TW`（繁体中文，默认基准）、`en`（英文）、`ja`（日文）、`ko`（韩文）。
- **English settings page**: 设置页面（Settings Tab）各模块文案必须统一保持英文，不随语言切换而变动。
- **Semantic test selectors**: DOM 测试或状态选择必须基于 Semantic Class、`data-*` 属性或角色定位；严禁依赖本地化翻译后的字符串做元素查找。
- **English internal baseline**: 源码、标识符、注释、Commit 信息及技术文档统一使用英文编写。

## TypeScript and Code Hygiene

推行零抑制的强类型约束：

- **Strict compiler compliance**: 源码必须同时通过标准 `tsconfig.json` 与 `tsconfig.strict.json` 编译，满足 `strict: true`、`noImplicitReturns`、`noUnusedLocals`、`noUnusedParameters`。
- **Zero suppression comments**: 严禁使用 `eslint-disable`、`@ts-ignore` 或 `@ts-expect-error`；所有类型冲突与 Lint 警告必须在源码层修复。
- **Avoid explicit `any`**: 避免使用 `any` 类型；优先使用领域接口、泛型或用 `unknown` 配合类型守卫收窄；`src/main.ts` 与 `types/obsidian.d.ts` 中绝对禁止出现 `any`。
- **Safe scalar handling**: 处理外部数据或弱类型输入时，必须使用领域辅助函数（`stringValue`、`numeric`、`asArray`、`sanitizePathPart`）做兜底清洗。

## Testing and Verification

通过自动化流水线守护核心逻辑：

- **Native test harness**: 单元与契约测试统一采用 Node.js 原生测试库（`node:test` + `node:assert/strict`）。
- **Catalog registration**: 新增测试文件必须在 `tests/test-catalog.mjs` 中登记，声明对应的测试套件（`unit`、`integration`、`contract`、`legacy-update`、`legacy`）与特性标签。
- **Mock boundaries**: 测试中必须使用 `tests/mocks/obsidian.ts` 隔离 Obsidian 运行环境；严禁在测试中引入未经模拟的 Obsidian 原生模块。
- **Quality preflight**: 提交前确保通过完整质量验证链：`npm run check`（涵盖编译、严格类型检查、Lint、架构边界检查、测试套件与社区规范预检）。
