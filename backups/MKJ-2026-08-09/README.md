# 航线

面向大学生和准大学生的就业确定性工作台。

- 子站：`https://dsxnb.com/MKJ/`
- 主站：`https://dsxnb.com/`
- CVM 静态目录：`/var/www/MKJ`

## 网站部署

只需要部署以下浏览器文件：

```text
index.html
styles.css
script.js
supabase-config.js
```

不要修改主站 Nginx 的 `location /`，也不要把 `supabase/schema.sql` 复制到网站目录。

## Supabase

1. 在 Supabase SQL Editor 中执行 `supabase/schema.sql`。
2. 把 Project URL 和 Publishable key 写入 `supabase-config.js`。
3. 在 Authentication -> URL Configuration 中设置：

```text
Site URL       https://dsxnb.com/MKJ/
Redirect URLs  https://dsxnb.com/MKJ/
```

注册、登录、找回密码、会话保持、目标岗位和任务状态云端同步均由 Supabase 提供。

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
backups/MKJ-2026-08-09/
```

备份目录中的 `BACKUP_MANIFEST.md` 记录来源提交和 SHA-256。

只允许在前端公开 Project URL 和 Publishable key。不要提交数据库密码、`service_role` key、SMTP 凭据、腾讯云密码或 SSH 私钥。
