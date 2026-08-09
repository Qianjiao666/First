# 航线

面向大学生和准大学生的就业确定性工作台。

当前版本 `v0.3` 新增：多色主题、36 个目标岗位、学历与学校搜索、
自定义任务、更新日志和账户留言板。学校搜索使用本地离线索引，数据源
与许可证见 `assets/data/UNIVERSITY_DATA_SOURCE.md`。

- 子站：`https://dsxnb.com/MKJ/`
- 主站：`https://dsxnb.com/`
- CVM 静态目录：`/var/www/MKJ`

## 网站部署

只需要部署以下浏览器文件与本地依赖目录：

```text
index.html
styles.css
script.js
supabase-config.js
assets/
```

`assets/` 中包含固定版本的 Supabase JS、DM Mono 字体、大学索引及对应开源许可证。网页运行时不依赖 Google Fonts、jsDelivr 或 GitHub，更适合国内网络环境。

不要修改主站 Nginx 的 `location /`，也不要把 `supabase/schema.sql` 复制到网站目录。

## Supabase

1. 在 Supabase SQL Editor 中执行 `supabase/schema.sql`。
2. 把 Project URL 和 Publishable key 写入 `supabase-config.js`。
3. 在 Authentication -> URL Configuration 中设置：

```text
Site URL       https://dsxnb.com/MKJ/
Redirect URLs  https://dsxnb.com/MKJ/
```

注册、登录、验证邮件重发、完整密码恢复、会话保持、目标岗位、学历、任务状态和留言板均由 Supabase 提供。验证邮件重发带 60 秒冷却，避免触发邮件频率限制。

`v0.3` 必须重新执行最新版 `supabase/schema.sql`，以创建：

```text
profiles.education
feedback_messages
对应 RLS 策略与索引
```

留言板仅允许已登录用户读取和发布；用户只能删除自己的留言，不能编辑他人的数据。

## 邮件服务

Supabase 默认 SMTP 只适合项目团队测试，并有很低的发送频率限制。面向 QQ、163 等真实用户时必须启用 Custom SMTP。

当前采用 Gmail SMTP：

```text
Host       smtp.gmail.com
Port       587
Username   完整 Gmail 地址
Password   Google 应用专用密码
Sender     与 Username 相同的 Gmail 地址
```

Gmail 必须开启两步验证。SMTP 密码、邮箱登录密码和授权码只保存在 Supabase 配置中，绝对不要提交到 GitHub。

## 备份

最新完整备份位于：

```text
backups/MKJ-2026-08-09-v0.3/
```

备份目录中的 `BACKUP_MANIFEST.md` 记录来源提交和 SHA-256。

只允许在前端公开 Project URL 和 Publishable key。不要提交数据库密码、`service_role` key、SMTP 凭据、腾讯云密码或 SSH 私钥。
