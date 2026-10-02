# AnimeList Enhanced (动漫笔记增强版)

[![GitHub Release](https://img.shields.io/github/v/release/Kougami132/AnimeList?color=blue)](https://github.com/Kougami132/AnimeList/releases)
[![Obsidian Downloads](https://img.shields.io/badge/Obsidian-Community%20Plugin-7C3AED)](https://obsidian.md/plugins?id=animelist-enhanced)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English Documentation](./README_EN.md) | 简体中文文档

**AnimeList Enhanced** 是一个本地优先（Local-first）的 Obsidian 动漫、漫画与轻小说媒体库管理插件。所有数据均保存在你自己的普通 Markdown 笔记中，提供集**收藏库（Library）**、**完成时间轴（Timeline）**、**评分看板（Score Dashboard）**与**插画展柜（Images）**于一体的 Material 3 风格工作台。

本项目基于 [cwh555/AnimeList](https://github.com/cwh555/AnimeList) 进行深度二次开发与增强。你的 Markdown 笔记永远是权威的数据源，即使停用或卸载插件，所有笔记、评分、记录与图片依然完好无损。

> [!NOTE]
> **What's new** (1.6.0 最新特性)
>
> - **Bangumi 双向同步**：支持拉取与比对 Bangumi 上的追番状态、观看进度与个人评分，提供时间窗口过滤与差异预览弹窗。
> - **编辑自动回写**：在编辑动画笔记时通过智能脏检查自动将变动回写至 Bangumi，同时支持笔记手动推送指令与详情面板操作。
> - **原生简体中文覆盖**：完整内置 `zh-CN` 语言包，设置页面彻底重构为全简体中文与原生 Tab 分页交互。
> - **番组放送档期校准**：优先遵循番组官方档期与标签，彻底纠正以往单纯按公历月份计算导致的季度偏差。
> - **评分看板全量筛选**：评分看板支持与媒体库完全一致的制作公司、放送季度与标签组合筛选。
> - **平滑升级无缝兼容**：保持对现有笔记代码块语法 100% 兼容，初次启用自动无损继承原版配置。

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/library-card.png" alt="AnimeList library in card view" width="100%"><br>
      <sub><b>收藏库 (Library)</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/score-dashboard.png" alt="AnimeList Score Dashboard"><br>
      <sub><b>评分看板 (Score Dashboard)</b></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/image-session.png" alt="AnimeList note with reusable image and Moment sections" width="100%"><br>
      <sub><b>笔记插画与名场面 (Note Media)</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/timeline.png" alt="AnimeList completion timeline"><br>
      <sub><b>完成时间轴 (Timeline)</b></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/image-library.png" alt="AnimeList image library"><br>
      <sub><b>插画展柜 (Image Library)</b></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/tracking.png" alt="AnimeList latest tracking"><br>
      <sub><b>追更追踪 (Tracking)</b></sub>
    </td>
  </tr>
</table>

---

## 相比原版（cwh555/AnimeList）的增强特性

| 增强特性 | 说明 |
| :--- | :--- |
| **Bangumi 双向同步** | 支持双向拉取和比对 Bangumi 上的追番状态、观看话数进度与个人评分。提供时间窗口过滤（默认 30 天滚动窗口）、批量差异预览弹窗（Diff Preview）与直观的冲突解决方案。 |
| **编辑自动回写 (Push on Edit)** | 在 Obsidian 编辑或完成动画笔记时，可自动回写进度、状态和评分至 Bangumi（内置智能脏检查，仅当进度/评分变动时触发），并提供笔记内手动推送指令与详情操作按钮。 |
| **原生简体中文全覆盖** | 全面补齐 `zh-CN` 语言包，设置页面彻底重写为全简体中文与原生 Tab 分页交互，解决原版设置项全英文且中文搜索不友好的问题。 |
| **番组档期（放送季度）算法校准** | 优先遵循番组官方档期与标签，彻底纠正以往单纯按公历月份计算导致的季度偏差（如 6 月下旬首播的夏番准确识别为 Q3 夏季番，12 月下旬首播的冬番准确识别为 Q1 冬季番）。 |
| **评分看板全量筛选** | 评分看板（Score Dashboard）补齐与主收藏库一致的动画制作公司、放送季度与用户自定义标签的多维组合筛选能力。 |
| **无缝平滑迁移** | 保持对既有笔记中 ```` ```animelist ```` 代码块的完整向后兼容；初次运行会自动检测并平滑继承原版 `animelist/data.json` 配置文件，老用户无感升级。 |

---

## 核心功能

- **三合一媒体库**：在一套系统中统一管理动画（Anime）、漫画（Manga）与轻小说（Novel）。
- **多数据源元数据检索**：集成 Bangumi（番组计划）、AniList 与 Open Library，自动导入封面、制作公司、STAFF、原作、放送档期与标签。
- **多种呈现视图**：支持卡片（Card）、列表（List）与海报（Poster）视图，支持 1–6 列密度自定义调节。
- **进度追踪与分卷记录**：支持集数、话数、卷数跟踪，可为小说的每一卷或漫画每一单行本记录独立的阅读日期与封面。
- **漫画/小说追更提醒**：可选接入 MangaDex 与 NDL/JPRO 数据源，自动比对并展示官方最新话数/出版卷数。
- **笔记插画墙与名场面**：纯 Markdown 代码块内嵌图片墙（`animelist-images`）与名场面片段（`animelist-moments`），支持瀑布流排版与长图折叠。
- **流式完成时间轴**：基于真实完成时间渲染的自适应流式时间轴，支持独立缩放、平移浏览、历史归档与 KDE 观看密度概览。
- **拖拽式评分看板**：0.5 分细粒度的可视化评分看板，支持单部或批量跨分段拖拽调分。
- **便携式数据导出**：支持安全导出为紧凑版 JSON 或带模板的格式化文本，不改动任何笔记源文件。
- **多语言界面**：原生支持简体中文、繁体中文、英语、日语与韩语，支持跟随 Obsidian 系统语言。

---

## 安装方法

### 方式一：Obsidian 官方社区市场安装（推荐）

1. 打开 Obsidian 的 **设置 → 社区插件**。
2. 点击 **浏览** 并搜索 **AnimeList Enhanced**。
3. 点击 **安装** 并 **启用**。

### 方式二：通过 BRAT 插件测试安装

如果你安装了 [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat)：
1. 打开 BRAT 设置，选择 **Add Beta plugin**。
2. 输入本仓库地址：`Kougami132/AnimeList`。
3. 安装完成后在社区插件列表中启用即可。

### 方式三：手动下载安装

1. 从 [Releases 页面](https://github.com/Kougami132/AnimeList/releases) 下载最新版本的 `main.js`、`manifest.json` 与 `styles.css`。
2. 在你的 Vault（库）根目录下进入 `.obsidian/plugins/`，新建名为 `animelist-enhanced` 的文件夹。
3. 将下载的 3 个文件复制到 `.obsidian/plugins/animelist-enhanced/` 目录下。
4. 重启或在 Obsidian 设置中重新加载插件，启用 **AnimeList Enhanced**。

---

## 快速上手

1. **打开工作台**：点击左侧功能区图标，或在命令面板运行 `AnimeList: 打开收藏库`。
2. **收录作品**：点击顶部操作栏的 **收录** 按钮，选择作品类型（动画 / 漫画 / 小说），输入标题搜索并一键创建 Markdown 笔记。
3. **管理进度与评分**：在收藏库卡片或笔记内修改观看/阅读进度、记录评分、调整状态（想看 / 在看 / 看过 / 搁置 / 抛弃）。
4. **配置 Bangumi 同步（可选）**：
   - 前往 **设置 → 功能特性 → Bangumi 同步**。
   - 填入你的 Bangumi Access Token（可在 Bangumi 设置 → 应用中免费生成）。
   - 开启后即可在工作台一键同步近期的追番进度，或在编辑动画笔记时自动回写。
5. **内嵌插画或片段**：在媒体笔记中右键，从上下文菜单中选择 **AnimeList → 插入图片区** 或 **插入名场面区**。

---

## 老用户升级说明

如果你此前正在使用原版 `AnimeList`（由 cwh555 维护）：
- **配置无缝继承**：首次启用 `AnimeList Enhanced` 时，插件会自动读取并迁移原版 `.obsidian/plugins/animelist/data.json` 中的设置（包括已配置的根目录、模板、Bangumi Token 等），你无需重新设置。
- **笔记语法完全通用**：所有笔记内既有的 ```` ```animelist ````、```` ```animelist-detail ````、```` ```animelist-images ```` 与 ```` ```animelist-moments ```` 语法保持 100% 原生支持，笔记无需做任何替换。

## 使用文档

关于工作台导航、媒体库视图、状态规则、进度单位、分卷封面、元数据与筛选、追更追踪、插画墙、名场面、数据导出、版本兼容清理工具、评分看板与时间轴的高级用法，请参阅完整使用手册：
👉 [User Guide](docs/USER_GUIDE.md)

---

## 隐私、网络访问与安全

- **数据绝对本地优先**：所有的评分、进度、笔记正文、图片与时间轴均保存在你的本地 Vault 中，不设立任何中心化数据库，无任何遥测或使用统计上传。
- **按需公开请求**：仅在用户主动搜索作品元数据、拉取追更信息或执行 Bangumi 同步时，使用 Obsidian 官方推荐的安全网络 API 向对应公网服务发送请求。
- **官方接口直连**：Bangumi 同步采用直接请求官方 API 规范，密钥保存在本地配置文件中，不经由任何第三方中转代理。

---

## 致谢

- 衷心感谢原作者 [cwh555](https://github.com/cwh555) 及其开源的 [AnimeList](https://github.com/cwh555/AnimeList) 插件，为本项目提供了优雅扎实的架构基础。
- 感谢 [Bangumi 番组计划](https://bgm.tv/) 与 [AniList](https://anilist.co/) 提供的开放数据接口。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。
