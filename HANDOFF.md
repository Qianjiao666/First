# 航线 MKJ 项目接手文档

更新时间：2026-08-11

## 12. r8.1 生产收尾状态（2026-08-11）

- r8.1 以已上线的 r8 为唯一基线，仅修复论坛账号状态同步、更新日志内容和资源缓存版本标记。
- 论坛真实控制器为 `forum/forum-events.js`；登录状态显示“已登录 · 昵称 · 管理员/版主/账户”，公开资料不可用时回退为“航线同学”，不显示邮箱。
- 首页更新日志已包含 `r8.1`、`r8`、`v0.6`，入口文字显示为“更新日志 · r8.1”。
- 首页与四个论坛路由的受影响资源使用 `?v=20260811-r8.1`；商城、公告、通知、任务、后台、共享组件、数据库和 Edge Functions 未修改。
- 静态包：`deployment/MKJ-community-forum-tasks-20260811-static-r8.1.zip`
- 静态包 SHA-256：`C72730353582D49C05B65A4E41967137CB51EF942199B4871EBC937156459901`
- 静态包清单 `79/79` 校验通过；与 r8 比对仅 6 个预期文件内容变化。
- WebShell 已完成 `/var/www/MKJ` 原子切换，旧站备份保存在 `/var/www/.mkj-community-releases/20260811-r8.1.previous`，不得删除，直到下一版完成独立验收。
- 本地完整 Node 回归 `84/84` 通过，JavaScript 语法检查通过，375/768/1280/1920 浏览器冒烟无横向溢出和运行时异常。
- 本地恢复提交：`1502293 fix: polish r8.1 forum identity and changelog`。

## 13. 后续版本变更纪律（长期有效）

每次修改网站功能、用户可见文案或修复线上问题，必须按以下顺序完成：

1. 同步更新根目录 `index.html` 的更新日志；版本条目必须置于历史版本之前，并同步更新 `tests/browser/changelog.test.mjs`。
2. 在当前生产基线之上做增量修改，运行完整 Node 测试、语法检查、清单校验和浏览器冒烟；禁止用旧版本包覆盖新功能。
3. 生成完整静态包，核对 SHA-256 和 `RELEASE-MANIFEST.txt`，不得把后端、schema 或测试文件复制到静态目录。
4. 将相关源码、测试、交接文档一起 `git add`，提交清晰的版本 commit，并执行 `git push origin <当前分支>` 同步 GitHub；不提交密码、token、service role key、数据库密码或 SSH 私钥。
5. 生产部署只切换 `/var/www/MKJ`，部署前创建带时间戳的 tar 备份，保留 `.previous` 回滚目录，不修改主站根路由或 Nginx。
6. 部署后检查首页、论坛、任务、商城、公告、共享组件和代表性静态资源；确认登录态、更新日志和控制台无异常后，才可标记版本完成。

## 0b. 2026-08-11 社区发布候选状态

论坛与任务发布已完成本地整合，原版首页只保留一个 `社区` 入口，未改变原有评估、账户、进度、兑换和反馈流程。

- 静态发布包：`deployment/MKJ-community-forum-tasks-20260811-static-r5.zip`
- 静态包 SHA-256：`6751A7C89DC4891E5D76B4EB1132861EB3705422F3855CFE2FCC5B7BF9A0F0AE`
- 后端发布包：`deployment/MKJ-community-forum-tasks-20260811-backend-r5.zip`
- 后端包 SHA-256：`648D0C85B729822DC04B04D2C94E92FF2E60709AEF6D686095C99EF32907F1D0`
- 静态包含 58 个条目；后端包含 canonical schema、全部 Edge Functions 和发布手册，共 21 个条目；两包均使用 Linux 兼容的 `/` 路径。
- 本地全量 Node 测试 `103/103` 通过；任务/论坛相关 JavaScript 与 r5 静态包内 `26` 个 JavaScript 文件语法检查通过；敏感词全角 WARN/MUTE 替换、任务完成 warnings envelope、父帖公开读取策略和 Linux checksum 行尾已补回归测试。
- 真实 Supabase 迁移、数据库 advisors、Deno type check、Edge Function 部署、角色/RLS/敏感词/幂等奖励 E2E 和线上静态部署仍未执行。必须按 `docs/COMMUNITY_RELEASE_RUNBOOK.md` 完成这些门禁后，才可宣告正式上线。

部署边界仍为只更新 `/var/www/MKJ`，不修改主站根路由、Nginx 配置，也不把后端包或 `supabase/schema.sql` 放进静态目录。

## 0. v0.5 最新接手状态

2026-08-10 已将“航线”求职竞争力评估页 v0.5 正式部署到 `https://dsxnb.com/MKJ/`：

- 保留品牌原名“航线”和“航”图标，保留登录、注册、验证邮件重发、找回密码、更新密码、退出登录及 Supabase 会话逻辑。
- 保留原有 10 道题、选项文本、评分规则和结果展示逻辑，新增单题渐进、进度保存/恢复、六维雷达图、能力名片、流程区及完整内容模块。
- 页面内更新日志已增加 `v0.5 视觉升级与体验增强`。
- 发布包：`deployment/MKJ-v0.5.zip`，SHA-256 为 `9CA6B19E52A7B19784B022AD0CF57A5FF065920ACF8D93862B0629E26AC77478`。
- 服务器部署前备份：`/root/MKJ-site-before-v0.5-20260810-171648.tar.gz`。
- 线上 `index.html`、`styles.css`、`script.js`、`supabase-config.js` 与本地发布源 SHA-256 完全一致；`/MKJ/`、核心资源及主站 `/` 均返回 HTTP 200。
- 线上浏览器烟雾测试通过：登录弹窗、v0.5 更新日志、测评进度保存/恢复、10 题报告、3 条建议、雷达图、能力名片、FAQ、客服菜单和移动端导航均正常，桌面/移动端无横向溢出且无运行时异常。
- 本次临时 SSH 公钥、服务器上传包及本地临时私钥均已清理；仅保留服务器回滚备份。

后续部署仍只允许更新 `/var/www/MKJ`，不得修改主站根路由、Nginx 配置或部署 `supabase/schema.sql`。

## 0a. v0.3 历史接手状态

用户要求的 7 项功能已实现、部署到正式子站并通过 Playwright 线上验收：

- 多色主题和自定义背景/强调色
- 36 个目标岗位，支持分类与搜索
- 学历及本科、硕士、博士学校搜索
- 自定义任务及旧状态迁移
- “能力证据”不拆行
- 三条更新日志
- Supabase 账户留言板

浏览器验收宽度为 375/768/1280/1920，均无横向溢出，控制台 0 错误；线上截图在
`output/playwright/online-mkj-*.png`。

2026-08-09 已通过腾讯云 Lighthouse WebShell 将纯网页包部署到 `/var/www/MKJ`，部署前备份
保存在服务器 `/root/MKJ-site-before-v0.3-*.tar.gz`。正式站首页、大学数据和主站均返回
HTTP 200。线上 `index.html`、`styles.css`、`script.js` 的 SHA-256 与本地/GitHub 源码一致。

Supabase 最新 `schema.sql` 已执行：`profiles.education` 可通过 Data API 识别；匿名请求
`feedback_messages` 返回 401，确认表存在且匿名访问被拒绝。

GitHub `main` 已包含功能提交 `11f3012 feat: add personalized planning and feedback` 及后续
部署文档更新。发布包路径是 `deployment/MKJ.zip`；部署时仍然
只复制 `index.html`、`styles.css`、`script.js`、`supabase-config.js` 和 `assets/`。
原 v0.3 纯网页压缩包 SHA-256：`7387CFF2C8B78152B992BF3FBD901A10A066AD6FAA4E29AAD99C3A3B66975159`。
2026-08-10 已补全 582 校离线索引并重建待发布包，新的本地发布包 SHA-256 为
`5E889FEE0A0FE7658446A9242BF400FD5B764B952C236CE78EF935CC496A30E2`；582 校索引已部署，
线上与本地索引 SHA-256 均为 `829BE346D742908F6791D65EF1F9775919D7A1BC98E2374535A0F481D2814A4F`。

大学数据源选定 `https://github.com/xioajiumi/Chinese_Universities`（MIT）。当前本地已生成
包含 582 个唯一学校名称的离线索引，详情见
`assets/data/UNIVERSITY_DATA_SOURCE.md`。

## 1. 新对话先做什么

工作目录：

```text
D:\桌面文件\任务
```

新对话第一条消息可直接使用：

> 请先读取 `D:\桌面文件\任务\HANDOFF.md` 和 `TASK_PROGRESS.md`，继续航线 MKJ 项目。先核对 GitHub、线上 Lighthouse 与本地发布包版本，再处理后续功能或 Supabase Gmail SMTP 排障。仅修改 `https://dsxnb.com/MKJ/`，绝不能影响主站 `https://dsxnb.com/`。涉及 Supabase、浏览器测试、Nginx 或 SSH 前，先读取文档列出的对应 skill。不要索取、显示或提交任何邮箱密码、应用专用密码、验证码、token、数据库密码、service_role key 或 SSH 私钥。

接手后按以下顺序行动：

1. 读取本文件、`TASK_PROGRESS.md`、`README.md`。
2. 在 `deployment/github-sync` 检查 `git status` 和最新提交。
3. 验证线上 MKJ 是否仍与 v0.3 功能提交 `11f3012` 对应文件及 `assets/` 一致。
4. 后续若需重新部署，只更新 Lighthouse `/var/www/MKJ`，不要改主站 Nginx 根路由。
5. Gmail SMTP、验证回跳和找回密码邮件已完成用户验收；后续只需日常观察。
6. 完成 QQ/163 邮箱投递、密码恢复和云端状态持久化验收。

## 2. 项目与边界

“航线”是面向大学生和准大学生的就业确定性工作台，帮助用户选择目标岗位、判断能力缺口并完成每周行动。

```text
子站        https://dsxnb.com/MKJ/
主站        https://dsxnb.com/
Lighthouse  /var/www/MKJ
GitHub      https://github.com/Qianjiao666/First
分支        main
Supabase    项目引用 hzxvmrbztbyapqnwttjq
```

绝对边界：

- 只修改 `/MKJ/`，不能覆盖或重写主站。
- 主站 `location /` 仍反向代理到 `http://localhost:3000`，不要修改。
- 不创建新的 COS bucket；当前架构是 CVM + Nginx 静态子路径。
- 只允许浏览器公开 Supabase Project URL 和 Publishable key。
- `supabase/schema.sql` 不属于网站静态文件，不要部署到 `/var/www/MKJ`。

## 3. 技术架构

前端是无构建流程的静态项目：

```text
index.html
styles.css
script.js
supabase-config.js
assets/fonts/
assets/vendor/
```

后端：

```text
Supabase Auth       注册、登录、验证邮件、找回密码、会话保持
Supabase Postgres   profiles、career_progress、feedback_messages
RLS                 私有资料只归本人；留言仅登录可读写且只能删除自己的内容
localStorage        未登录演示模式
离线数据            assets/data/chinese-universities.json（本地与线上均为 582 校）
```

数据库脚本：

```text
D:\桌面文件\任务\supabase\schema.sql
```

## 4. 当前准确状态

### GitHub

v0.3 功能与部署文档已推送：

```text
11f3012 feat: add personalized planning and feedback
c62da70 docs: correct web release checksum
e07a64f docs: record successful v0.3 deployment
```

同步克隆：

```text
D:\桌面文件\任务\deployment\github-sync
```

完整备份：

```text
backups/MKJ-2026-08-09-v0.3/
```

备份包含网页源码、`assets/`、许可证、README、数据库脚本和 `BACKUP_MANIFEST.md`。清单中的文件 SHA-256 已与根目录逐项核对。

### 最新前端改进

- 5 组主题预设及自定义背景/强调色，刷新后保持。
- 36 个目标岗位，支持 6 类筛选和关键词搜索。
- 最高学历及本科、硕士、博士学校搜索与云端同步。
- 自定义任务创建、完成、删除及旧任务状态迁移。
- 三期更新日志和 Supabase 账户留言板。

- 登录、注册、找回密码有提交中禁用与稳定按钮文案。
- 成功提示为绿色，错误提示为红色，不再显示 `{}`。
- 注册表单可重新发送验证邮件，并有 60 秒冷却。
- `PASSWORD_RECOVERY` 会打开新密码表单，再调用 `auth.updateUser({ password })`。
- 未登录状态显示“登录 / 注册”和“访客模式”。
- 820px 以下提供固定底部导航。
- 静态岗位趋势明确标注“示例数据”。
- Supabase JS 2.111.0 和 DM Mono 字体已本地托管。
- 页面运行时不再依赖 Google Fonts 或 jsDelivr。

### 发布包

```text
D:\桌面文件\任务\deployment\MKJ-v0.3-web\
D:\桌面文件\任务\deployment\MKJ.zip
SHA-256 5E889FEE0A0FE7658446A9242BF400FD5B764B952C236CE78EF935CC496A30E2
```

`MKJ-v0.3-web` 是解压后的纯网页目录；`MKJ.zip` 是同内容上传包。两者均只包含可部署文件。

部署时只复制以下内容：

```text
index.html
styles.css
script.js
supabase-config.js
assets/
```

### 线上版本

原 v0.3 已部署。2026-08-10 线上首页、主站和核心静态文件均可访问；582 校索引已部署并与本地哈希一致。Playwright 四尺寸验收通过，控制台 0 错误。

### Supabase 与邮件

已经完成：

- `profiles`、`career_progress`、`feedback_messages` 表和 RLS。
- `profiles.education` 学历字段、留言表长度约束及索引。
- Site URL 和 Redirect URL 均为 `https://dsxnb.com/MKJ/`。
- 原有已验证账户可以登录。
- Gmail Custom SMTP 已保存。
- 前端能把 SMTP 空错误对象转换成可读提示。

当前阻塞：

- Gmail SMTP 发送验证邮件仍可能失败，QQ/163 投递尚未最终验收。
- Auth Logs 已记录 `/signup | request completed`，用户确认邮件流程无异常。

只记录错误类型和错误文字，不记录邮箱、密码、应用专用密码、验证码或 token。

常见处理：

```text
535 / Username and Password not accepted
  重新生成 Google 应用专用密码，去掉显示空格；Sender 与 Username 必须一致。

rate limit / HTTP 429
  停止重复请求，等待限制窗口恢复后只测试一次。

timeout / connection failed
  核对 smtp.gmail.com、端口 587 和 TLS 配置。
```

## 5. 已安装 Skills

以下 skills 已经安装在 `C:\Users\梁惠\.codex\skills\`，新对话会自动发现，无需重复下载同名目录：

```text
supabase
supabase-postgres-best-practices
playwright
playwright-explore-website
playwright-interactive
webapp-testing
web-design-reviewer
frontend-design
nginx-ops
ssh
secrets
security-review
security-best-practices
shipping-and-launch
```

建议触发顺序：

1. Supabase Auth、SMTP、会话或数据库任务：先读 `supabase/SKILL.md`。
2. 改数据库结构、RLS、SQL 或性能：再读 `supabase-postgres-best-practices/SKILL.md`。
3. 浏览器操作与截图：读 `playwright/SKILL.md`；探索核心流程时再读 `playwright-explore-website/SKILL.md`。
4. UI 检查和源码修复：读 `web-design-reviewer/SKILL.md` 与 `frontend-design/SKILL.md`。
5. Nginx 配置：读 `nginx-ops/SKILL.md`。
6. 连接 CVM：读 `ssh/SKILL.md`，不得索取或输出私钥。
7. 上线前：读 `shipping-and-launch/SKILL.md`；处理敏感配置时读 `secrets/SKILL.md`。

本次已通过官方 `skill-installer` 从 OpenAI GitHub curated 清单安装 `playwright-interactive` 与 `security-best-practices`。其他所需 skills 已存在，没有重复覆盖。需要增加新 skill 时，必须使用系统自带：

```text
C:\Users\梁惠\.codex\skills\.system\skill-installer\SKILL.md
```

## 6. 后续发布与验收流程

### A. 未来版本重新部署

当前 v0.3 已部署。未来更新时，在 Lighthouse 中先备份现有 `/var/www/MKJ`，再复制四个网页文件和整个 `assets/`。不要把 README 或 `supabase/schema.sql` 放入网站目录。

部署后至少检查：

```text
https://dsxnb.com/MKJ/
https://dsxnb.com/MKJ/styles.css
https://dsxnb.com/MKJ/script.js
https://dsxnb.com/MKJ/supabase-config.js
https://dsxnb.com/MKJ/assets/vendor/supabase-2.111.0.js
https://dsxnb.com/MKJ/assets/fonts/dm-mono-regular.woff2
https://dsxnb.com/
```

子站资源和主站均应返回 HTTP 200。确认主站正常后再继续认证测试。

### B. SMTP 排障

1. 打开 Supabase Auth Logs。
2. 发起一次注册测试。
3. 根据最新日志修复 Gmail SMTP。
4. 等待至少一分钟后只重试一次。
5. 分别测试 QQ 和 163 邮箱，检查收件箱与垃圾邮件。

### C. 浏览器验收

必须检查 375、768、1280、1920 四种宽度并保存截图到：

```text
D:\桌面文件\任务\output\playwright\
```

核心流程：

1. 访客点击头像可打开资料菜单，点击“登录账户”后打开登录弹窗。
2. 注册提交加载态、成功/错误提示和重发冷却。
3. 恢复邮件回跳后设置新密码。
4. 移动底部导航滚动并更新激活状态。
5. 岗位和任务在 localStorage 及登录云端模式下保持。
6. 控制台无错误；网络中无 Google Fonts 和 jsDelivr 请求。

v0.3 已完成 375/768/1280/1920 四种宽度线上检查；用户已确认真实账户下的留言发布与跨设备同步正常。

## 7. 项目整体完成标准

只有同时满足以下条件才可宣布正式完成：

- GitHub、CVM 和本地发布文件版本一致。
- `/MKJ/` 所有本地 assets 返回 200，主站不受影响。
- QQ 和 163 邮箱可稳定收到验证及找回密码邮件。
- 验证链接和恢复链接都回到 `https://dsxnb.com/MKJ/`。
- 新密码保存后可以登录。
- 目标岗位和任务状态能跨刷新、退出和重新登录保存。
- 375/768/1280/1920 浏览器验收通过，无重叠、溢出或控制台错误。

## 8. 安全禁区

永远不要在代码、文档、终端输出或对话中暴露：

```text
Gmail 登录密码或应用专用密码
QQ/163 邮箱密码或授权码
验证码、access token、refresh token
Supabase service_role key 或数据库密码
腾讯云密码或 SSH 私钥
```

如果日志包含敏感字段，只提取错误码和非敏感错误文字。

## 9. 社区 r8 WebShell 部署约定（2026-08-11）

腾讯 Lighthouse WebShell 对多行 heredoc 粘贴不稳定，未来部署统一采用“文件上传 + 单行执行”流程：

1. 本地准备静态 ZIP、相邻 `.zip.sha256` 和独立脚本 [deployment/mkj-r8-cutover.sh](deployment/mkj-r8-cutover.sh)。
2. 通过 WebShell 文件上传将三个文件放到服务器 `/root/`；本次实际上传路径为 `/root/MKJ-community-forum-tasks-20260811-static-r8.zip`。
3. 在 WebShell 先运行 `sha256sum -c /root/MKJ-community-forum-tasks-20260811-static-r8.zip.sha256`，必须显示 `OK`，再检查 ZIP 内包含 `shop/index.html`、`announcements/index.html`、`shared/community-widgets.js`、`forum/index.html` 和 `tasks/index.html`。
4. 只执行一行：`chmod 700 /root/mkj-r8-cutover.sh && /bin/bash /root/mkj-r8-cutover.sh`。脚本会再次校验 ZIP 与 manifest，检测 r8 标志文件，备份 `/var/www/MKJ` 到带时间戳的 `.previous` 目录，并原子移动新目录；已是 r8 时直接退出，不重复移动。
5. 切换后检查 `/MKJ/`、`/MKJ/forum/`、`/MKJ/tasks/`、`/MKJ/shop/`、`/MKJ/announcements/` 和代表性静态资源；确认主站 `/` 未受影响。

不要把多行部署脚本直接粘贴进 WebShell；不要删除已有 `.previous` 回滚目录；不要修改主站 Nginx 根路由。Supabase token、service role key、数据库密码和 SSH 私钥只在本地安全输入，不得写入文件或对话。

## 10. r8 checksum verification record (2026-08-11)

- The uploaded artifact `/root/MKJ-community-forum-tasks-20260811-static-r8.zip` was verified with:
  `sha256sum -c /root/MKJ-community-forum-tasks-20260811-static-r8.zip.sha256`
- Result: `MKJ-community-forum-tasks-20260811-static-r8.zip: OK`.
- The fixed `deployment/mkj-r8-cutover.sh` was uploaded over `/root/mkj-r8-cutover.sh`, passed its own checksum check, and completed the static cutover.

### r8 cutover CRLF incident

- The first cutover stopped after the ZIP checksum printed `OK`. A `bash -x` trace showed that paths read from `RELEASE-MANIFEST.txt` ended with `\r`, for example `admin/account-transfer/index.html\r`.
- Root cause: Windows PowerShell `Set-Content` generated a CRLF manifest, while the Linux cutover script treated the trailing carriage return as part of each path.
- `deployment/mkj-r8-cutover.sh` now strips the trailing `\r` before checking and hashing each manifest entry. Its fixed SHA-256 is `38D869728855ABCFD9DBECCC766CFF3D25D286E2D9665566DA2C7B8B46E542E3`.
- `deployment/build-community-release.ps1` now writes UTF-8 without BOM and explicit LF line endings, preventing the same issue in future release artifacts.
- For this incident, keep the verified r8 ZIP unchanged and upload only the fixed cutover script over `/root/mkj-r8-cutover.sh`. Failed timestamped `.stage` directories are not rollback copies and are ignored by the next run; existing `.previous` directories must still be preserved.

## 11. r8 production deployment completed (2026-08-11)

- Supabase SQL migrations and Edge Functions were deployed before the static cutover. The corrected `task-admin` function deployed successfully with the rest of the function set.
- Tencent Lighthouse now serves the r8 static release from `/var/www/MKJ`. The main site root `/` and the existing Nginx configuration were not changed.
- Static artifact SHA-256: `438B9D009091FFA6827E2A33C91AA1B6DA0731D818416F33B191EF865F01D687`.
- Backend artifact SHA-256: `ABAFEC80DDE49BC63E819EF11A6B62CE304ACAE1AEDE3B97B741BAF29814F0C8`.
- Live `https://dsxnb.com/MKJ/RELEASE-MANIFEST.txt` matches the manifest bytes inside the local r8 ZIP and reports `Release: 20260811`, `Revision: r8`, and `Files: 79`.
- Live SHA-256 checks matched the r8 manifest for `index.html`, `admin/index.html`, `forum/index.html`, `tasks/index.html`, `shop/index.html`, `announcements/index.html`, and `shared/community-widgets.js`.
- `https://dsxnb.com/`, `/MKJ/`, `/MKJ/forum/`, `/MKJ/tasks/`, `/MKJ/shop/`, `/MKJ/announcements/`, and the representative shared JavaScript asset all returned HTTP 200 after cutover.
- The r8 release is the current production baseline. Preserve every `.previous` rollback directory under `/var/www/.mkj-community-releases/` until a later release has been independently verified.
