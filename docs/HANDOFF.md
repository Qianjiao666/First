# 航线 MKJ 项目接手文档

更新时间：2026-08-09

## 0. v0.3 最新接手状态

用户要求的 7 项功能已在本地实现并通过 Playwright 验收，但尚未发布到线上：

- 多色主题和自定义背景/强调色
- 36 个目标岗位，支持分类与搜索
- 学历及本科、硕士、博士学校搜索
- 自定义任务及旧状态迁移
- “能力证据”不拆行
- 三条更新日志
- Supabase 账户留言板

浏览器验收宽度为 375/768/1280/1920，均无横向溢出，控制台 0 错误；截图在
`output/playwright/mkj-*.png`。

当前两个发布阻塞：

1. 本机连接腾讯云 `119.45.253.94` 时无可用 SSH 密钥，服务器返回
   `Permission denied (publickey,...)`，所以 `https://dsxnb.com/MKJ/` 仍是旧版。
2. Supabase 必须重新执行最新版 `supabase/schema.sql`，否则学历云端字段和留言表不存在。

GitHub 已完成推送：`11f3012 feat: add personalized planning and feedback`。推送后检查
线上公开 `script.js`，未发现 `themePresets`，证明服务器没有自动从 GitHub 同步。

不要将“本地功能完成”写成“线上完成”。发布包路径是 `deployment/MKJ.zip`；部署时仍然
只复制 `index.html`、`styles.css`、`script.js`、`supabase-config.js` 和 `assets/`。
当前 v0.3 压缩包 SHA-256：`B16F9F936EDC08908C91205F6214F40ADCF2C89D8165F41C66F7AF838890F945`。

大学数据源选定 `https://github.com/xioajiumi/Chinese_Universities`（MIT）。当前本地有
离线索引，完整 582 校 CSV 下载被本机审批服务中断，详情见
`assets/data/UNIVERSITY_DATA_SOURCE.md`。

## 1. 新对话先做什么

工作目录：

```text
D:\桌面文件\任务
```

新对话第一条消息可直接使用：

> 请先读取 `D:\桌面文件\任务\HANDOFF.md` 和 `TASK_PROGRESS.md`，继续航线 MKJ 项目。先核对 GitHub、线上 CVM 与本地发布包版本，再部署最新前端并完成 Supabase Gmail SMTP 排障。仅修改 `https://dsxnb.com/MKJ/`，绝不能影响主站 `https://dsxnb.com/`。涉及 Supabase、浏览器测试、Nginx 或 SSH 前，先读取文档列出的对应 skill。不要索取、显示或提交任何邮箱密码、应用专用密码、验证码、token、数据库密码、service_role key 或 SSH 私钥。

接手后按以下顺序行动：

1. 读取本文件、`TASK_PROGRESS.md`、`README.md`。
2. 在 `deployment/github-sync` 检查 `git status` 和最新提交。
3. 验证线上 MKJ 是否已经部署源码提交 `dff95b8` 对应文件及 `assets/`。
4. 若未部署，只更新 CVM `/var/www/MKJ`，不要改主站 Nginx 根路由。
5. 在 Supabase Auth Logs 定位 Gmail SMTP 的服务端错误。
6. 完成 QQ/163 邮箱投递、密码恢复和云端状态持久化验收。

## 2. 项目与边界

“航线”是面向大学生和准大学生的就业确定性工作台，帮助用户选择目标岗位、判断能力缺口并完成每周行动。

```text
子站        https://dsxnb.com/MKJ/
主站        https://dsxnb.com/
CVM 目录    /var/www/MKJ
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
Supabase Postgres   profiles、career_progress
RLS                 用户只能访问自己的数据
localStorage        未登录演示模式
```

数据库脚本：

```text
D:\桌面文件\任务\supabase\schema.sql
```

## 4. 当前准确状态

### GitHub

最新两个提交已推送：

```text
8f880d1 chore: refresh complete MKJ backup
dff95b8 feat: improve auth and mobile experience
```

同步克隆：

```text
D:\桌面文件\任务\deployment\github-sync
```

完整备份：

```text
backups/MKJ-2026-08-09/
```

备份包含网页源码、`assets/`、许可证、README、数据库脚本和 `BACKUP_MANIFEST.md`。清单中的文件 SHA-256 已与根目录逐项核对。

### 最新前端改进

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
D:\桌面文件\任务\deployment\MKJ.zip
SHA-256 B230BC92C8E946D041E94CA6A58D07C6037804C59FEBF4DAA1B5EA2DF40BE883
```

部署时只复制以下内容：

```text
index.html
styles.css
script.js
supabase-config.js
assets/
```

### 线上版本

旧版 MKJ 曾验证为 HTTP 200，且主站未受影响。完成 `dff95b8` 后尚未取得可靠的线上哈希确认，因此新对话必须先检查线上是否已有 `assets/vendor/supabase-2.111.0.js`，不能默认新版已经部署。

### Supabase 与邮件

已经完成：

- `profiles`、`career_progress` 表和 RLS。
- Site URL 和 Redirect URL 均为 `https://dsxnb.com/MKJ/`。
- 原有已验证账户可以登录。
- Gmail Custom SMTP 已保存。
- 前端能把 SMTP 空错误对象转换成可读提示。

当前阻塞：

- Gmail SMTP 发送验证邮件仍可能失败，QQ/163 投递尚未最终验收。
- 必须从 Supabase Dashboard 的 Logs -> Auth Logs 获取最新服务端错误。

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
webapp-testing
web-design-reviewer
frontend-design
nginx-ops
ssh
secrets
security-review
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

本次尝试通过官方 `skill-installer` 查询 OpenAI GitHub curated 清单时，本机审批服务连接中断，未返回清单。由于本项目所需 skills 已全部存在，没有重复安装或覆盖现有目录。需要增加新 skill 时，必须使用系统自带：

```text
C:\Users\梁惠\.codex\skills\.system\skill-installer\SKILL.md
```

## 6. 下一步实施清单

### A. 部署最新前端

在 CVM 中先备份现有 `/var/www/MKJ`，再复制四个网页文件和整个 `assets/`。不要把 README 或 `supabase/schema.sql` 放入网站目录。

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

1. 访客状态点击后打开登录弹窗。
2. 注册提交加载态、成功/错误提示和重发冷却。
3. 恢复邮件回跳后设置新密码。
4. 移动底部导航滚动并更新激活状态。
5. 岗位和任务在 localStorage 及登录云端模式下保持。
6. 控制台无错误；网络中无 Google Fonts 和 jsDelivr 请求。

目前只完成了新版 375px 布局和访客入口检查；其余尺寸及模拟认证成功响应仍待补验。

## 7. 完成标准

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
