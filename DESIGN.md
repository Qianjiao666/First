---
name: "航线 v1.0"
description: "面向求职校准、社区协作与管理操作的职业校准台视觉系统"
colors:
  calibration-ink: "#111820"
  ink-soft: "#24313c"
  paper: "#f3f6f7"
  paper-deep: "#eaf0f2"
  surface: "#ffffff"
  surface-soft: "#f8fafb"
  route-blue: "#165dff"
  route-blue-deep: "#0f49cc"
  route-blue-soft: "#e8efff"
  signal-green: "#087f5b"
  signal-green-soft: "#e4f4ed"
  reward-orange: "#c96318"
  reward-orange-soft: "#fff0e3"
  danger-red: "#b53c43"
  danger-red-soft: "#fff0f1"
  text-muted: "#596875"
  text-subtle: "#788692"
  line: "#d6dfe4"
  line-strong: "#b8c5cc"
typography:
  display:
    fontFamily: '"Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1.03
    letterSpacing: "0"
  headline:
    fontFamily: '"Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "52px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0"
  title:
    fontFamily: '"Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: '"Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "0"
  data-label:
    fontFamily: '"DM Mono", Consolas, monospace'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  control: "5px"
  surface: "8px"
  dialog: "12px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "18px"
  lg: "24px"
  xl: "34px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.route-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.route-blue-deep}"
    textColor: "{colors.surface}"
  input:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.calibration-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 11px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.calibration-ink}"
    rounded: "{rounded.surface}"
    padding: "22px"
---

# Design System: 航线 v1.0

## Overview

**Creative North Star: "职业校准台"**

航线像一套安静、精密、可信的校准工作台：用户能看清目标、差距、下一步和当前状态，而不是被装饰或宣传语言分散注意力。墨色建立重心，纸白与冷灰提供长时间阅读所需的低噪声背景，蓝、绿、橙分别承担定位、完成与奖励的明确语义。

首页允许更强的品牌张力和明暗节奏；论坛、任务、商城、公告与后台保持紧凑、可扫描、可重复操作。细边界、测量轨迹、状态点和数据字体是共同语言，但不模拟真实仪器，不使用装饰性面板堆叠。

**Key Characteristics:**

- 冷静的黑白灰骨架，局部高纯度功能色。
- 首页有视觉峰值，操作页强调密度与扫描效率。
- 中文系统字体负责阅读，DM Mono 只负责数据与状态。
- 细边界、克制阴影、短促状态动效和明确键盘焦点。
- 同一品牌系统覆盖公开页面与管理后台。

## Colors

调色板以冷纸面和深墨色建立长期可读性，三种功能色必须按语义使用。

### Primary

- **航线蓝**：主要动作、当前位置、当前分页、链接和关键进度。
- **深航线蓝**：蓝色控件的悬停与高对比文本状态。
- **浅航线蓝**：导航选中、筛选悬停、聚焦邻近表面和信息状态。

### Secondary

- **信号绿**：完成、成功、声望、在线与已登录状态。
- **奖励橙**：任务奖励、商城积分、库存提醒和需要注意但非错误的状态。

### Tertiary

- **危险红**：错误、危险操作与拒绝状态；浅红只作为错误背景。

### Neutral

- **校准墨**：标题、深色工作区、品牌标记与高权重文字。
- **纸面与深纸面**：页面背景及相邻章节的层级切换。
- **白色与柔白表面**：输入、卡片、表格、对话框与工具栏。
- **冷灰文字**：正文辅助信息、时间与元数据。
- **边界灰**：分隔线、输入边框和静态表面边界。

### Named Rules

**The Semantic Signal Rule.** 蓝色只表达定位和动作，绿色只表达完成与成功，橙色只表达奖励与注意，颜色不能互相代替。

**The Never-Color-Alone Rule.** 权限、成功、错误、奖励和选中状态必须同时保留文字、图标或结构提示。

## Typography

**Display Font:** Segoe UI Variable 与中文系统字体回退

**Body Font:** Segoe UI Variable 与中文系统字体回退

**Label/Mono Font:** 本地托管 DM Mono 与 Consolas 回退

**Character:** 中文字体保持直接、紧凑和高可读；等宽字体只为版本、时间、编号、计量值与状态提供精密感，不承担长段正文或展示标题。

### Hierarchy

- **Display**：只用于首页或社区入口的首要标题，桌面端形成清晰品牌峰值，移动端在离散断点缩小。
- **Headline**：论坛、商城、公告等模块的页面标题，尺度明显低于首页首屏。
- **Title**：帖子详情、卡片组、面板与对话框标题，保持紧凑行高。
- **Body**：默认正文与表单说明，长文本控制在约 65 至 75 个中文字符的可读宽度。
- **Data label**：时间、版本、状态、计数和表头，不使用负字距或全屏连续缩放。

### Named Rules

**The Content Leads Rule.** 标题自身承担层级，不在标题上方重复添加纯分类式英文眉标；动态分类值可以作为真实数据标签保留。

**The Mono Measures Rule.** DM Mono 只用于可测量、可比较或可枚举的信息。

## Layout

公开模块使用约 1180 至 1200px 的内容上限，桌面端页头保持约 72px 的稳定高度。首页以两列首屏和大章节节奏建立品牌张力；论坛使用分类栏、讨论流、工具栏三列信号板；任务使用主列表与侧栏；后台使用侧栏、表格与紧凑表单。

布局在 1100、900、780 和 480px 使用离散断点重排。移动端变为连续单列，导航与操作按钮拥有稳定触控高度；表格在必要时由明确的横向容器承载，不允许页面级横向溢出。成品中反复出现的 6、10、18、24、34 和 48px 间距形成紧凑到章节级的节奏；这些是应用节奏，不是要求每个页面逐级使用的通用比例尺。

## Elevation & Depth

系统以边界和色面分层为主，阴影只用于悬浮工具、对话框、核心表单、任务卡和交互悬停。静态信息流默认扁平；同一表面不叠加浓边框与浓阴影。

### Shadow Vocabulary

- **Ambient surface**：低对比双层柔和阴影，用于任务卡、商城商品和紧凑工具面。
- **Raised dialog**：更大范围的柔和阴影，用于模态框、通知面板与核心校准卡。
- **Interactive lift**：悬停仅上移约 2px，并从 ambient 过渡到 raised；高密度后台行只改变背景。

### Named Rules

**The Flat-by-Default Rule.** 信息流和表格静止时优先使用边界或色面，阴影必须对应真实的悬浮、层级或交互状态。

## Shapes

控件使用紧凑的 5px 圆角，普通表面使用 8px，对话框和核心工具使用 12px。标签、状态与筛选值在确有短文本状态语义时可使用胶囊形；普通命令按钮不得变成胶囊。品牌标记保持小型方形轮廓，图标统一使用 1.8px 左右的圆端线性 SVG。

## Components

### Buttons

- **Shape:** 稳定的紧凑矩形，最小高度约 40px，5px 圆角。
- **Primary:** 航线蓝底、白字，沿用中文系统字体；用于提交、创建、发布和主要页面动作。DM Mono 不用于普通按钮文案。
- **Hover / Focus:** 悬停变为深航线蓝；键盘焦点使用 3px 半透明蓝色轮廓与 3px 偏移。
- **Secondary / Ghost:** 白色或柔白底、强边界灰；悬停进入浅航线蓝，而不是改变为奖励色。

### Chips

- **Style:** 纸面底、细边界、短数据字体；仅标签、筛选与状态使用胶囊形。
- **State:** 选中状态同时改变底色、边界和文字，不只依赖颜色。

### Cards / Containers

- **Corner Style:** 普通内容 8px，核心表单或对话框 12px。
- **Background:** 白色表面承载内容，柔白表面承载输入和工具区。
- **Shadow Strategy:** 信息卡扁平或 ambient 二选一，交互时才提升。
- **Border:** 1px 冷灰边界；相邻卡片组可共享边界避免重复线条。
- **Internal Padding:** 紧凑卡约 18 至 24px，首页核心表面可更宽松。

### Inputs / Fields

- **Style:** 柔白底、强边界灰、5px 圆角；占位符在白色和柔白背景上均满足 4.5:1 对比度。
- **Focus:** 边界切换为航线蓝，并保留独立可见的 focus-visible 轮廓。
- **Error / Disabled:** 错误使用红色文字和浅红表面；禁用降低强调但保留可读标签与轮廓。

### Navigation

- 默认文字使用冷灰；悬停与当前位置统一进入浅航线蓝并使用深航线蓝文字。
- 页头高度和品牌标记在首页、论坛、任务、商城、公告和后台保持一致。
- 移动端导航可换行或形成稳定网格，不用动态文字撑开工具栏。

### Calibration Status

校准分数、进度、在线点和声望是系统的签名状态组件。深墨核心承载关键数值，航线蓝承担轨迹和进度，信号绿只表示完成或在线；数值与文字标签必须同时存在。

## Do's and Don'ts

### Do:

- **Do** 让用户在首屏看到当前目标、主要动作或真实工作区，而不是功能说明页。
- **Do** 用航线蓝统一主要动作、当前位置和当前分页。
- **Do** 用信号绿表达完成、成功、声望和在线，用奖励橙表达积分与奖励。
- **Do** 在 375、768、1280、1920 宽度验证文字换行、触控目标与页面溢出。
- **Do** 为动画提供 `prefers-reduced-motion` 降级，让内容默认可见。

### Don't:

- **Don't** 添加纯分类式 kicker、eyebrow 或重复标题的英文眉标。
- **Don't** 使用 Unicode 字符充当功能图标；使用同一线宽的本地或内联 SVG。
- **Don't** 使用紫色渐变、装饰性光球、玻璃拟态、卡片套卡片或无意义的大胶囊按钮。
- **Don't** 用奖励橙或信号绿代替主要动作和导航定位的航线蓝。
- **Don't** 通过连续视口字号缩放、负字距或过度留白制造展示感。

## v1.2 视觉扩展：导航数据地图

v1.2 采用用户确认的 B「Navigation Data Map」信息结构，并融合 C 的深色信号面板。浅色页面是精密、留白充足的路线工作台；深色面板只承载核心分数、进度、状态和粒子轨道，不扩展成满页游戏 HUD。该扩展覆盖首页、论坛、任务、商城、公告和后台的表现层，不改变业务入口、数据契约或权限逻辑。

### v1.2 色彩令牌

- 页面背景 `#f1f6f5`，主表面 `#ffffff`，柔和表面 `#e9f3f0`。
- 主文字 `#0b171b`，次级文字 `#526b70`，边界 `#c8d9d6`。
- 路线主色 `#00a88f`，深路线色 `#007a6a`，仅用于主要操作、当前位置和导航轨迹。
- 能量高光 `#baff32` 只用于粒子核心、在线状态和短进度强调；信息不可只靠该颜色表达。
- 深色信号面板使用 `#071317` 与 `#0c2024`，面板文字 `#eefcf8`，弱文字 `#9dbab5`。
- 蓝色 `#1866ff` 与橙色 `#ff9b21` 仅作局部信息和奖励强调，紫蓝不得成为主导色。

### v1.2 形状与纵深

- 控件圆角 `7px`，内容卡 `12px`，核心信号面板 `16px`；不使用无语义的超大胶囊。
- 常规浮层阴影 `0 16px 42px rgba(12, 45, 46, .1)`，抬升面板阴影 `0 24px 64px rgba(7, 30, 32, .18)`。
- 路线网格只可出现在 Hero、论坛头部或数据校准区域，并保持低对比度；正文、表单和列表不铺装饰网格。

### v1.2 动效与性能

- 粒子画布只作为视觉增强，必须 `aria-hidden`、`pointer-events: none`，不得遮挡按钮或影响布局。
- 设备像素比上限为 `1.5`，粗指针设备减少粒子数量；离开视口时暂停，尺寸变化时按容器重算。
- 所有轨道动画和粒子效果必须支持 `prefers-reduced-motion` 降级，静态内容仍需完整可读。
- 移动端首屏必须完整展示主要操作和信号面板，并露出下一章节的视觉提示；页面宽度不得超过视口。
