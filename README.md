# 航线 MKJ 网站接手入口

这是 `https://dsxnb.com/MKJ/` 子站源码。当前工作目录是：

```text
D:\桌面文件\任务\.worktrees\task-collaboration-v1-2
```

下次用 Codex 接手时，优先读：

1. `docs/CURRENT_HANDOFF.md`：当前代码结构、业务逻辑、进度、遗留问题。
2. `CHANGELOG.md`：公开版本从 `v0.1` 到当前 `v1.2` 的连续记录。
3. `docs/COMMUNITY_RELEASE_RUNBOOK.md`：发布、回滚、Supabase 与腾讯云操作流程。

线上边界：

- 子站：`https://dsxnb.com/MKJ/`
- 主站：`https://dsxnb.com/`
- 腾讯云 CVM Web 根目录：`/var/www/MKJ`
- 回滚/备份目录：`/var/www/.mkj-community-releases`
- Supabase 项目：`hzxvmrbztbyapqnwttjq`

只更新 `/MKJ/` 子站，不覆盖主站根路由，不把 Supabase `service_role`、数据库密码、SSH 私钥、邮件密码或任何 token 写入仓库。
