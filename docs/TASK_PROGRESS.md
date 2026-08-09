# 航线 MKJ 任务进度

更新时间：2026-08-09

## 已完成

- 已完成 `v0.3` 本地开发与浏览器验收：
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
  - 备份目录：`backups/MKJ-2026-08-09/`
- 最新部署包：
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

- `v0.3` 功能已在本地完成，但尚未部署到 `https://dsxnb.com/MKJ/`。
- GitHub `main` 已推送提交 `11f3012 feat: add personalized planning and feedback`，仓库状态干净。
- 本机没有可用的腾讯云 SSH 密钥登录权限，服务器拒绝 `publickey` 认证；不能宣称线上已更新。
- 留言板与学历云端同步需要在 Supabase SQL Editor 重新执行最新版 `supabase/schema.sql`。
- 大学搜索当前打包离线索引；完整 582 校上游 CSV 下载被本机审批服务中断，来源与替换方式已写入 `assets/data/UNIVERSITY_DATA_SOURCE.md`。

- 基础版本已完成 GitHub、Supabase、腾讯云 CVM 和线上静态页面部署。
- 邮箱验证回跳问题已经修复。
- Supabase URL Configuration 已设置生产地址。
- Gmail Custom SMTP 已保存，但注册验证邮件仍发送失败。
- 前端已修复空错误对象显示，并完成认证与移动端体验增强；待把新发布包同步到 CVM。
- GitHub 根目录已推送最新源码和 `assets/`；完整备份目录也已补齐并通过提交 `8f880d1 chore: refresh complete MKJ backup` 推送。
- 当前需要从 Supabase Auth Logs 获取 Gmail SMTP 的具体服务端错误。

## 下一步

1. 在 Supabase SQL Editor 执行最新版 `supabase/schema.sql`。
2. 把新发布包中的五项内容同步到 `/var/www/MKJ`：四个网页文件和整个 `assets/` 目录。
3. 在线验证主题、岗位、学历、任务、日志和留言板。
4. 在 Supabase Auth Logs 中继续排查 Gmail SMTP，并验证 QQ/163 投递。

不要在对话中发送真实密码、验证码或私钥。

## 安全备注

- `supabase-config.js` 只应包含项目 URL 和 Publishable key。
- 不要把数据库密码、`service_role` key、SMTP 凭据、邮箱密码、应用专用密码、腾讯云密码或私有 SSH key 写入仓库。
- 主站 Nginx 配置不需要修改，更新范围限定为 `/var/www/MKJ`。
