# 航线 MKJ 项目接手文档

更新时间：2026-08-09

## 0. v0.3 最新接手状态

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
当前 v0.3 纯网页压缩包 SHA-256：`7387CFF2C8B78152B992BF3FBD901A10A066AD6FAA4E29AAD99C3A3B66975159`。

大学数据源选定 `https://github.com/xioajiumi/Chinese_Universities`（MIT）。当前本地有
离线索引，完整 582 校 CSV 下载被本机审批服务中断，详情见
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
5. 在 Supabase Auth Logs 定位 Gmail SMTP 的服务端错误。
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
离线数据            assets/data/chinese-universities.json（当前 134 校）
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
SHA-256 7387CFF2C8B78152B992BF3FBD901A10A066AD6FAA4E29AAD99C3A3B66975159
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

v0.3 已部署。正式站、大学数据文件与主站均返回 HTTP 200；线上三个核心文件哈希与本地源码一致。线上 Playwright 四尺寸验收通过，控制台 0 错误。

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

v0.3 已完成 375/768/1280/1920 四种宽度线上检查；真实账户下的留言发布与跨设备同步仍应在后续日常验收中持续观察。

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
