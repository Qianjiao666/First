# 航线 MKJ 当前接手说明

更新时间：2026-08-14

## 现状

- 当前公开版本：`v1.2`。
- 线上地址：`https://dsxnb.com/MKJ/`。
- 部署位置：腾讯云 CVM `/var/www/MKJ`，不是 Lighthouse。
- 当前源码目录：`D:\桌面文件\任务\.worktrees\task-collaboration-v1-2`。
- 当前分支：`codex/task-collaboration-v1-2`。
- 线上首页已验证显示 `更新日志 · v1.2`、`当前 v1.2`，并包含 `v0.9` 历史条目和学习演示免责声明。
- 主站 `https://dsxnb.com/` 不加载 MKJ v1.1/v1.2 资源，发布边界保持在 `/MKJ/` 子路径。

## 目录怎么读

- `index.html`、`styles.css`、`script.js`：主测评站首页、求职测评、登录注册弹窗、主题、本地进度、更新日志等老核心功能。
- `supabase-config.js`：前端公开 Supabase 配置，只包含项目 URL 和 publishable key。
- `assets/css/visual-v1.css`：v1.0 以后全站视觉系统，覆盖首页、论坛、任务、商城、公告、后台等生产页面。
- `assets/js/core/`：公共运行时，包含 Supabase 客户端封装、会话监听、权限、声望、兑换码、任务集成入口。
- `assets/js/security/`：前端 XSS、防表单注入、DFA 敏感词过滤与词库。
- `assets/js/theme/`：三套主题和 localStorage 记忆逻辑。
- `assets/js/forum/`：论坛列表、帖子、评论、点赞、版主入口的前端控制器和渲染逻辑。
- `assets/js/tasks/`：任务广场、任务详情、发布任务、我的任务、后台任务管理的前端 API 与页面控制器。
- `assets/js/admin/`：后台菜单、用户、敏感词、兑换码、账号转移、论坛管理、任务管理等后台 UI 逻辑。
- `assets/js/profile/avatar.js`：已有头像显示、文字回退和头像相关前端逻辑；生产设置弹窗暂不开放上传入口。
- `community/`：社区入口页，分流到论坛和任务广场。
- `forum/`：论坛公开页、发帖页、分类页、帖子详情页。
- `tasks/`：任务广场、创建任务、任务详情、我的任务页面；`tasks/tests/` 是任务模块独立契约测试。
- `admin/`：后台页面集合。
- `announcements/`、`shop/`、`shared/`：公告、商城和公共组件页。
- `supabase/schema.sql`：数据库 canonical schema。
- `supabase/modules/tasks.sql`：任务模块 SQL，包含任务、申请、分配、提交、补充交付、完成、仲裁等 RPC。
- `supabase/functions/`：Edge Functions，前端写操作主要通过这些函数进入数据库。
- `tests/`：浏览器、函数、schema、release、安全测试。
- `deployment/`：当前 v1.2 静态包、后端包、发布脚本、腾讯云静态迁移脚本和发布说明。
- `output/playwright/`：保留的浏览器验收证据，不属于源码但可辅助复核。
- `tools/build-sensitive-lexicon.mjs`：生成/维护敏感词词库的工具脚本。

## 每个部分的大概逻辑

### 求职测评首页

主页面由 `index.html` 承载，核心交互在 `script.js`。用户可以做求职测评、选择目标岗位、维护行动任务、查看能力雷达和更新日志。登录前用 localStorage 保存演示进度，登录后通过 Supabase 保存账户资料和进度。

### 账户与会话

`assets/js/core/auth.js`、`runtime.js`、`session-coordinator.js` 负责 Supabase Auth 登录、注册、找回密码、会话恢复、跨页面登录状态同步和 token 失效重登提示。权限通过 `assets/js/core/permissions.js` 解析为前端能力点。

### 主题与头像

`assets/js/theme/theme-controller.js` 管理三套主题，并用 localStorage 记住用户选择。头像显示逻辑保留在 `assets/js/profile/avatar.js`：有头像显示头像，没有头像回退为文字标识。头像上传入口按产品决定延期，生产设置弹窗没有上传入口。

### 论坛

论坛页面 HTML 在 `forum/`，控制逻辑在 `assets/js/forum/`。前端读取帖子、分类、评论和账号状态；发帖、评论、投票、版主管理等写操作走 Supabase Edge Functions。前后端都接入了 XSS 和敏感词防护。

### 任务广场

任务页面 HTML 在 `tasks/`，控制逻辑在 `assets/js/tasks/`。读取任务列表和详情使用 Supabase 表查询；申请、提交、取消、补充交付、完成、仲裁等写操作通过 `assets/js/core/task-integration.js` 调用 `supabase/functions/task-complete` 或 `task-admin`，再由数据库 RPC 执行业务状态变更。

### 后台

后台 HTML 在 `admin/`，公共后台逻辑在 `assets/js/admin/`。后台页面依赖登录态和权限能力点，覆盖用户管理、论坛管理、任务管理、敏感词、兑换码、账号转移等入口。敏感操作通过 Edge Functions 进入数据库。

### 安全防护

前端安全逻辑在 `assets/js/security/`，后端共享逻辑在 `supabase/functions/_shared/`。XSS 防护和 DFA 敏感词过滤有前后端双重覆盖，已有自动化安全测试。不要把 service role key、数据库密码、SSH 私钥、邮件密码、token 写入仓库或对话。

### 发布

静态站发布包由 `deployment/build-community-release.ps1` 生成。当前生产切换目标是 CVM `/var/www/MKJ`。后端 Supabase schema 和 Edge Functions 不应复制到静态目录，需按 `docs/COMMUNITY_RELEASE_RUNBOOK.md` 单独部署或核验。

## 当前进度

- 已完成求职测评、论坛、任务模块源码回归。
- 已完成三套主题和 localStorage 记忆测试覆盖。
- 已完成已有头像显示和文字回退保留。
- 已完成跨页面登录状态监听、token 失效重登自动化覆盖。
- 已完成表格、弹窗、移动端布局契约覆盖。
- 已完成 XSS 前后端双重防护安全测试。
- 已完成 DFA 敏感词前后端覆盖安全测试。
- 已完成安全报告检查，无开放 High/Medium 代码漏洞。
- 已保持 `CHANGELOG.md` 从 `v0.1` 到 `v1.2` 连续。
- 已保持页面切换动画在 180-250ms 范围。
- 已完成生产浏览器矩阵检查，无溢出、无运行时错误。
- 已确认所有生产页面保留学习演示免责声明。
- 已确认主站未加载 MKJ v1.1/v1.2 资源。
- 已完成腾讯云 CVM 静态切换，回滚目录和备份已保留。
- 已补齐首页更新日志 `v0.9`，线上直接请求已验证。
- 已清理根目录临时截图和未完成诊断脚本，保留正式源码、发布包、测试和 Playwright 验收证据。

## 当前问题

- 用户在线上申请任务时，点击“提交申请”后提示：`任务操作未完成，请检查当前状态后重试`。
- 已定位到这不是前端按钮文案，而是 `supabase/functions/task-complete/index.ts` 调用数据库 RPC 后，将 RPC 错误统一包装成通用提示。
- 前端申请链路：`tasks/detail/index.html` 表单 -> `assets/js/tasks/task-detail.js` -> `services.api.apply(taskId, applicationNote)` -> `assets/js/tasks/task-api.js` -> `assets/js/core/task-integration.js` -> Edge Function `task-complete` 的 `apply` action。
- 后端申请 RPC：`supabase/modules/tasks.sql` 的 `public.apply_task`。可能触发失败的状态包括：用户资料不存在、任务不是 `published`、任务已截止、名额已满、该用户已申请过、生产 schema/RPC 与本地不一致。
- 已公开只读核验线上任务列表：当前有 published 任务，截止时间为 `2026-08-20T16:35:00+00:00`，所以“任务全部已截止/未发布”不是最明显原因。
- 尚未最终确认是哪一个具体业务条件导致失败。下一步需要拿到用户申请的具体任务 URL/任务 ID，以及当前登录用户是否已申请过；或在 Supabase SQL/日志中查 `task_applications`、`user_public_profiles` 和 `apply_task` 报错。

## 下次建议先做

1. 复现任务申请问题，记录具体任务 ID 和当前账号。
2. 在 Supabase 查询该账号是否存在 `user_public_profiles` 记录。
3. 查询该任务的 `status`、`deadline_at`、`application_limit`，以及该账号在 `task_applications` 是否已有记录。
4. 根据根因决定修复方式：若是重复申请，考虑改成幂等返回已有申请；若是状态/截止/名额问题，前端应禁用申请按钮并展示明确原因；若是资料缺失，修复注册/资料初始化流程。
5. 同步优化 Edge Function 错误映射，把数据库已知错误转成更明确的中文提示。

## 常用验证

```powershell
node --test tests\browser\changelog.test.mjs
node --test tasks\tests\*.test.mjs
node --test tests\browser\*.test.mjs
node --test tests\functions\*.test.mjs
node --test tests\schema\*.test.cjs
```

完整验证耗时更久，发布前还要跑生产浏览器矩阵和 release manifest 校验。若涉及 Supabase schema 或 Edge Functions，需额外做数据库/RLS/函数部署核验。
