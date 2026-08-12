# 航线 v1.0 全站视觉重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持全站既有功能和 DOM 契约不变的前提下，建立统一、显著升级且可响应的航线 v1.0 视觉系统。

**Architecture:** 新增一个在全部页面末端加载的共享 CSS 覆盖层，复用现有 HTML 与 JavaScript 契约。首页和各业务模块通过页面已有类名获得不同密度，但共享同一组品牌、表单、焦点、状态和响应式规则。

**Tech Stack:** 静态 HTML、原生 CSS、原生 JavaScript、Node `node:test`、Playwright/Chrome、PowerShell 发布脚本。

## Global Constraints

- 不改变任何现有功能、路由、表单字段、`id`、`data-*`、Supabase 调用或权限行为。
- 用户可见版本只使用 `v0.x` 或 `v1.x`；本次版本为 `v1.0`。
- 不增加外部运行时依赖或 CDN。
- 只修改 MKJ 子站源码，不修改主站或 Nginx。
- 所有视口必须无横向溢出并支持 `prefers-reduced-motion`。

---

### Task 1: 锁定视觉层与公开版本契约

**Files:**
- Create: `tests/browser/visual-system.test.mjs`
- Modify: `tests/browser/changelog.test.mjs`

**Interfaces:**
- Consumes: 当前生产 HTML 页面清单和首页更新日志。
- Produces: 对统一视觉层 URL、公开版本格式和版本排序的回归保护。

- [x] 编写测试，要求全部生产 HTML 最后加载 `/MKJ/assets/css/visual-v1.css?v=20260812-v1.0`。
- [x] 编写测试，要求首页更新日志包含 `v1.0/v0.8/v0.7/v0.6` 且不含公开 `r` 版本。
- [x] 运行两个测试并确认因为实现尚不存在而失败。

### Task 2: 建立共享视觉系统

**Files:**
- Create: `assets/css/visual-v1.css`

**Interfaces:**
- Consumes: 现有 `--mkj-*`、`--forum-*`、`--task-*`、`--admin-*` token 和页面类名。
- Produces: 全站品牌 token、浏览器表面、控件、状态、页面模块和响应式覆盖规则。

- [x] 定义色彩、排版、间距、圆角、深度、焦点和动效 token。
- [x] 重构首页、社区、论坛、任务、商城、公告、通知和后台的视觉表现。
- [x] 增加 900px、760px 和 480px 响应式覆盖及减少动效规则。

### Task 3: 接入所有生产页面并迁移公开版本

**Files:**
- Modify: `index.html`
- Modify: `community/index.html`
- Modify: `forum/**/*.html`
- Modify: `tasks/**/*.html`
- Modify: `shop/index.html`
- Modify: `announcements/index.html`
- Modify: `admin/**/*.html`

**Interfaces:**
- Consumes: `/MKJ/assets/css/visual-v1.css?v=20260812-v1.0`。
- Produces: 每个生产路由一致的最终视觉层；首页公开版本 `v1.0`。

- [x] 在所有生产页面 `</head>` 前添加统一视觉层。
- [x] 将更新日志入口改为 `v1.0`。
- [x] 新增 `v1.0` 条目，将 `r8.1/r8` 公开标签迁移为 `v0.8/v0.7`。
- [x] 运行契约测试并确认通过。

### Task 4: 功能与视觉验收

**Files:**
- Modify: `HANDOFF.md`
- Modify: `TASK_PROGRESS.md`

**Interfaces:**
- Consumes: 完成的 v1.0 页面与现有 Node 测试。
- Produces: 可复核的测试、截图、控制台、响应式和交接记录。

- [x] 运行完整 Node 测试和全部 JavaScript 语法检查。
- [x] 在 375、768、1280、1920 对代表性页面截图并检查溢出、空白、重叠和运行时错误。
- [x] 执行 Impeccable detector 与 finish review，修复物质性问题并复验。
- [x] 更新交接与任务进度记录。

### Task 5: 构建发布候选

**Files:**
- Modify: `deployment/build-community-release.ps1`（仅在视觉文件未被自动包含时）
- Create: `deployment/MKJ-community-forum-tasks-20260812-static-v1.0.zip`

**Interfaces:**
- Consumes: 通过验收的 v1.0 静态源码。
- Produces: 静态 ZIP、后端 ZIP、相邻 SHA-256 和内部清单。

- [x] 使用 `ReleaseDate=20260812`、内部 `Revision=v1.0` 构建发布物。
- [x] 核对静态包文件数、禁止目录、manifest 和 ZIP SHA-256。
- [x] 比较发布包与当前生产基线，确认只包含预期源码变化。
