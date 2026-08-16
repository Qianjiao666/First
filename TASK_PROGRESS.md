# 航线 MKJ 任务进度

## 2026.08.16 v1.3 多人协作任务市场

- 已完成协作任务 SQL/RLS/RPC、`task-collaboration` Edge Function、任务浏览器 API/市场/发布/详情/我的任务/后台接入，以及模板、发布资格、咨询、分工、三维互评与管理员审计读取。
- 校园团购只作为多人协作任务；实现和发布门禁均明确排除价格、支付、钱包、退款和结算流程。
- 已生成本地 v1.3 静态/后端候选包并补齐切换脚本、发布手册、交付报告和首页/`CHANGELOG.md` 更新日志。当前代码在隔离工作树 `codex/collaborative-task-market-v1.3`。
- 2026-08-16 已在 Supabase `hangxian` 生产分支执行完整迁移，协作 schema/RLS/RPC 已用只读查询验证。
- 已将管理员审计 RPC 和三个协作触发器函数的直接执行权限收紧为仅服务端可用；ACL 探针显示 `public`、`anon`、`authenticated` 均为 `false`，Security Advisor 已复跑，v1.3 新增函数不再出现在其警告中。
- `9890dc9` 已推送，`task-admin` 已部署且未认证 POST 验收为 `401`。仍待 Dashboard 部署 `task-complete`、`task-collaboration`，并完成真实角色/RLS、Edge 与生产静态站验收；线上静态版本仍为 v1.2。

## 2026.08.12 v1.0 全站视觉重构

- 在不改变已有功能、路由、表单、Supabase 和权限逻辑的前提下，新增 `assets/css/visual-v1.css` 并接入 20 个生产页面。
- 首页、社区、论坛、任务、商城、公告、通知和后台现使用统一的航线“职业校准台”视觉系统，包含完整响应式、焦点、状态、加载骨架和减少动效支持。
- 公开版本号改为 `v0.x/v1.x`；本次为 `v1.0`，历史 `r8.1/r8` 对应公开 `v0.8/v0.7`。
- 完整 Node 自动测试收集 21 个 `*.test.mjs` 与 7 个 `*.test.cjs`，结果为 `87/87` 通过、0 失败；JavaScript 语法检查 `93/93` 通过。
- 冷启动浏览器矩阵覆盖 20 路由 × 375/768/1280/1920 四个视口，共 `80/80` 项；HTTP 失败、横向溢出、控制台错误、网络错误、视觉层缺失和 token 错误均为 0，本地报告与 14 张代表截图位于 `output/playwright/visual-v1-final/`。
- 冷启动发现并修复两个后台页面缺少空 favicon 声明导致的 `/favicon.ico` 404，视觉契约现保护全部 20 个生产页面。
- 独立 Impeccable finish review 为 `PASS WITH NOTES`：所有代码级问题均已关闭；唯一备注是没有真实登录/授权固定数据截图，因此未覆盖论坛长帖、密集列表与授权后台表格，这不是已识别的产品代码缺陷。
- 视觉系统已归档至 `DESIGN.md` 与 `.impeccable/design.json`，JSON 可正常解析。
- 本地发布候选已完成：静态包 SHA-256 为 `ED2492C3CDF3ADE887AE250DBB3454727DEF11ACF3B1F8C038881EA736E88BD4`，后端包 SHA-256 为 `50294A9F64C82B0B96C3F5079CD84E4E608EB808382418B66A6F99DF6C21304C`。静态 ZIP 共 81 个条目，manifest 记录 80 个部署文件且 0 mismatch、0 禁止目录；相对 r8.1 仅新增视觉 CSS，并修改 20 个生产 HTML 与 manifest。
- `v1.0` 已于 2026-08-12 正式部署到腾讯云 CVM `ins-6xonyz5y`（南京三区，公网 IP `119.45.253.94`），仅原子切换 `/var/www/MKJ`。线上 manifest 为 `Release: 20260812`、`Revision: v1.0`、`Files: 80`。
- 正式部署的静态包 SHA-256 为 `ED2492C3CDF3ADE887AE250DBB3454727DEF11ACF3B1F8C038881EA736E88BD4`，manifest SHA-256 为 `3D6FD011E18A3E53881E72153091B103AB934AD432A46DDFF555412C3DE32257`；HTTPS 逐文件核对结果为 `80/80` SHA-256 匹配、0 失败。
- 生产浏览器矩阵再次完成 20 路由 × 4 视口共 `80/80` 项，HTTP 失败、主内容缺失、横向溢出、控制台错误、网络错误、视觉层缺失和 token 错误均为 0；报告与 14 张截图位于 `output/playwright/visual-v1-production/`。
- 回滚目录为 `/var/www/.mkj-community-releases/20260812-053614.previous`，部署前 tar 备份为 `/var/www/.mkj-community-releases/20260812-053614.before-v1.0.tar.gz`。
- 主站 `https://dsxnb.com/` 保持 HTTP 200 且未加载 `visual-v1.css`；本次未修改 Nginx，未部署后端 ZIP，未执行 Supabase 变更。本次源码改动仍未提交或推送 GitHub。

## 2026.08.11 社区模块本地完成

- 原版界面仅新增一个 `社区` 入口，指向 `/MKJ/community/`；社区目录再分流至论坛和任务广场，原有评估、账户、进度和兑换流程保持不变。
- 论坛已完成分类/标签 seed、发帖/评论/赞踩、全局声望与敏感词接入、版主管理、作者编辑/删除入口和锁帖后隐藏评论表单。
- 任务发布已完成草稿/发布/关闭/归档、申请/分配/拒绝/取消/提交/评价核验、分类/子类维护、敏感词 warnings、任务后台 guard、全局声望幂等事件和 service-only RPC。
- `supabase/modules/tasks.sql` 已同步到 canonical `supabase/schema.sql`，同步测试会阻止后续任务模块改动遗漏；14 个任务 `SECURITY DEFINER` 函数使用空 `search_path`。
- 本地全量 Node 测试 `103/103` 通过；任务/论坛相关 JavaScript 与 r5 静态包内 26 个 JavaScript 文件语法检查通过。原版交互 smoke、论坛四尺寸、任务后台桌面/移动和原版首页 CDP 验收均无 runtime exception。
- 本地预览器已支持自定义端口和目录索引路由，当前工作树可通过 `http://127.0.0.1:4186/MKJ/` 预览。
- 尚未执行真实 Supabase schema 迁移、Deno type check、Edge Function 部署、真实角色/RLS/敏感词/幂等奖励 E2E、生产打包或线上发布；当前环境没有 Deno、Supabase CLI 和 `psql`。

## 2026.08.11 发布收口

- 已新增可重复生成发布物的 `deployment/build-community-release.ps1`。
- 静态包只包含浏览器可部署文件；后端包独立包含 `supabase/schema.sql`、全部 Edge Functions 和发布手册，不会被复制到 `/var/www/MKJ`。
- r5 静态包 SHA-256 为 `6751A7C89DC4891E5D76B4EB1132861EB3705422F3855CFE2FCC5B7BF9A0F0AE`，后端包 SHA-256 为 `648D0C85B729822DC04B04D2C94E92FF2E60709AEF6D686095C99EF32907F1D0`；静态包 58 条目、后端包 21 条目，外部 SHA、内部 manifest 与 Linux LF checksum 均已验证，ZIP 路径为 `/`。
- 6.2 复核发现的全角敏感词替换和 task-complete warnings envelope 已修复，并由全量测试覆盖。
- 发布顺序、首个 ADMIN 引导、分类 seed、RLS/RPC 检查、角色矩阵、敏感词与幂等奖励验收、静态回滚步骤见 `docs/COMMUNITY_RELEASE_RUNBOOK.md`。
- 本机仍不能伪造目标 Supabase 的真实迁移、Deno 检查、Edge 部署或账号矩阵结果；这些是部署窗口必须完成的最后验收，而不是静态代码测试可以替代的项目。

更新时间：2026-08-11

## 已完成

- 已完成 `v0.5` 视觉升级、正式部署与线上浏览器验收：
  - 保留“航线”原名、“航”图标以及完整登录注册与 Supabase 会话功能
  - 保留原有 10 题、选项、评分与结果逻辑，新增单题渐进和本地进度保存/恢复
  - 新增并优化流程区、统计、案例、FAQ、团队、文章、客服、福利弹窗、六维雷达图和能力名片
  - 页面内更新日志已加入 `v0.5 视觉升级与体验增强`
  - 已部署至 `https://dsxnb.com/MKJ/`，主站 `https://dsxnb.com/` 未受影响
  - 发布包 `deployment/MKJ-v0.5.zip` SHA-256：`9CA6B19E52A7B19784B022AD0CF57A5FF065920ACF8D93862B0629E26AC77478`
  - 服务器回滚备份：`/root/MKJ-site-before-v0.5-20260810-171648.tar.gz`
  - 线上四个核心文件哈希与本地发布源一致，HTTP 与桌面/移动端完整烟雾测试通过
  - 临时 SSH 公钥、服务器上传包和本地临时私钥已清理
- 已完成 `v0.3` 开发、正式部署与浏览器验收：
  - 5 组背景/强调色预设与自定义颜色，使用 `localStorage` 持久化
  - 36 个岗位，支持 6 类筛选和关键词搜索
  - 最高学历及本科、硕士、博士学校填写与本地院校搜索
  - 用户自定义任务的创建、完成、删除与旧任务数据迁移
  - “能力证据”标签强制保持单行
  - 3 条更新日志，包含前两次版本摘要
  - Supabase 留言板前端、访客限制、安全纯文本渲染
- 已扩展 `supabase/schema.sql`：
  - `profiles.education jsonb`
  - `feedback_messages`、长度约束、索引和 RLS
- 已通过 375、768、1280、1920 四种宽度验收：无横向溢出、控制台 0 错误。
- 已安装并保留项目所需 GitHub Skills：`playwright-interactive`、`security-best-practices`。
- 已在 Supabase 执行最新版 `schema.sql`：
  - `profiles.education` 查询返回 HTTP 200
  - 匿名访问 `feedback_messages` 返回 HTTP 401，符合权限设计
- 已通过腾讯云 Lighthouse WebShell 发布纯网页包到 `/var/www/MKJ`，并在服务器生成部署前备份。
- 线上核心文件 SHA-256 与本地/GitHub 一致，正式子站和主站均返回 HTTP 200。

- 完成 Apple 风格的大学生就业确定性工作台页面。
- 页面部署路径保持为 `/MKJ/`，不修改主网页 `/`。
- 已加入 Supabase Auth 前端逻辑：
  - 邮箱注册
  - 邮箱密码登录
  - 找回密码
  - 恢复链接打开后的新密码设置
  - 验证邮件重发与 60 秒冷却
  - 提交按钮加载态，以及成功/错误提示分色
  - 会话保持
  - 退出登录
- 已完成第二轮使用体验优化：
  - 未登录状态明确显示“登录 / 注册”和“访客模式”
  - 手机端增加固定底部导航
  - 静态岗位趋势明确标注为“示例数据”
  - Supabase SDK 与 DM Mono 字体改为本地托管
  - 页面运行时不再请求 Google Fonts 或 jsDelivr
- 已加入 Supabase 云端数据同步：
  - 目标岗位保存到 `profiles.target_role`
  - 任务完成状态保存到 `career_progress.mission_state`
  - 未登录时保留 localStorage 演示模式
- 已创建并执行 Supabase 数据库表与 RLS：
  - `public.profiles`
  - `public.career_progress`
- 已验证 Supabase Data API：
  - 两张表返回 HTTP 200
  - 匿名查询返回空数组，没有读取到用户数据
  - 无效登录请求被正确拒绝
- 已推送 GitHub：
  - 仓库：`Qianjiao666/First`
  - 分支：`main`
  - 基础功能提交：`8b2e408 feat: add Supabase authentication and cloud progress`
  - 邮箱回跳修复：`5e8d85f fix: redirect auth emails to MKJ`
  - 认证错误提示：`2c8e91f fix: show useful auth errors`
  - 最新备份更新：`005ab57 chore: refresh MKJ backup`
  - 生产与 SMTP 文档：`cefc5ba docs: update production setup and SMTP guide`
  - 认证与移动端体验：`dff95b8 feat: improve auth and mobile experience`
  - v0.3 功能：`11f3012 feat: add personalized planning and feedback`
  - 备份目录：`backups/MKJ-2026-08-09-v0.3/`
- 最新部署包：
  - 解压目录：`deployment/MKJ-v0.3-web/`
  - `deployment/MKJ.zip`
  - v0.3 纯网页包 SHA-256：`7387CFF2C8B78152B992BF3FBD901A10A066AD6FAA4E29AAD99C3A3B66975159`
- 已完成腾讯云 CVM 部署：
  - 线上目录：`/var/www/MKJ`
  - 页面地址：`https://dsxnb.com/MKJ/`
  - `index.html`、`styles.css`、`script.js`、`supabase-config.js` 与本地发布文件 SHA-256 完全一致
- 已完成线上浏览器冒烟测试：
  - 桌面端和手机端布局正常
  - 登录、注册、找回密码表单均可打开
  - Escape 可关闭弹窗
  - 目标岗位与任务状态在未登录模式下可通过 localStorage 跨刷新保存
  - 虚构账号登录请求到达 Supabase Auth，并按预期返回 HTTP 400 和友好错误提示
  - 浏览器正常使用时控制台无错误或警告
- 已确认主站 `https://dsxnb.com/` 与子页面均返回 HTTP 200。

## 当前状态

- `v0.3` 已部署到 `https://dsxnb.com/MKJ/` 并通过线上验收。
- GitHub `main` 已包含提交 `11f3012 feat: add personalized planning and feedback`，待本次状态文档提交后再次确认仓库干净。
- Supabase 最新 schema 已执行，学历字段和留言表均可从 Data API 识别。
- 大学搜索已补全为 582 校本地离线索引；来源、生成格式与许可证已写入 `assets/data/UNIVERSITY_DATA_SOURCE.md`。

- 基础版本已完成 GitHub、Supabase、腾讯云 CVM 和线上静态页面部署。
- 邮箱验证回跳问题已经修复。
- Supabase URL Configuration 已设置生产地址。
- Gmail Custom SMTP 已保存；用户已确认注册验证邮件、验证回跳、登录和找回密码邮件流程均正常。
- 前端已修复空错误对象显示，并完成认证、移动端和 v0.3 个性化体验增强。
- GitHub 根目录已推送最新源码和 `assets/`；完整备份目录也已补齐并通过提交 `8f880d1 chore: refresh complete MKJ backup` 推送。
- Auth Logs 的注册记录显示 `/signup | request completed`，未发现服务端错误。
- 582 校索引已部署，线上与本地索引 SHA-256 均为 `829BE346D742908F6791D65EF1F9775919D7A1BC98E2374535A0F481D2814A4F`；新发布包 SHA-256 为 `5E889FEE0A0FE7658446A9242BF400FD5B764B952C236CE78EF935CC496A30E2`。

## 下一步

1. 用户已确认真实账号的岗位、学历、任务和留言云端同步无异常。
2. 用户已确认注册验证、登录、找回密码及邮箱投递流程无异常。
3. 持续观察 582 校搜索数据质量；后续更新仍只修改 `/var/www/MKJ`，不得影响主站。

不要在对话中发送真实密码、验证码或私钥。

## 安全备注

- `supabase-config.js` 只应包含项目 URL 和 Publishable key。
- 不要把数据库密码、`service_role` key、SMTP 凭据、邮箱密码、应用专用密码、腾讯云密码或私有 SSH key 写入仓库。
- 主站 Nginx 配置不需要修改，更新范围限定为 `/var/www/MKJ`。
