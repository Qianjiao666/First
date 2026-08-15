# 论坛与管理员后台模块交接

## 变更

- `/forum`：帖子、评论、投票、标签、最新/热度/最高分排序、标签与关键词筛选；发帖和评论提交前调用统一敏感内容封装，Edge Function 再次执行 `replaceSensitive`，命中 `MUTE` 沿用全局自动禁言并拒绝写入。
- `/forum` 帖子详情：按 `get_user_capabilities()` 显示投票、置顶/取消置顶、锁定/解锁、删除帖子按钮；精确权限同时支持 `forum:pin_post` 与 canonical `forum:pinPost`。
- `/admin`：按 `admin:*` 能力显示导航和管理面板，覆盖用户列表、角色、声望、禁言/解禁、精确权限授予与撤销、礼包码生成/停用、角色/权限奖励、敏感词库、论坛内容管理和账号数据转移。
- `supabase/migrations/20260811_forum_admin_enhancements.sql`：新增精确权限表、权限审计、后台审计、能力规范化、service-role-only 管理 RPC、礼包码幂等兑换与账号转移审计；同一 SQL 已同步到共享 canonical schema 工作区。
- `supabase/functions/_shared/auth.ts`：Edge 鉴权在可信用户上下文后调用数据库 `has_capability()`，服务端不再只依赖角色映射。

## SQL/API 契约

- `public.user_granted_permissions(user_id, capability, revoked_at, expires_at)` 保存唯一精确权限；用户仅能读取自己的未撤销权限，写入仅限 `service_role`。
- `public.admin_set_user_permission(p_actor_id, p_user_id, p_capability, p_active, p_reason)` 由 `admin:manageUsers` 复核 actor，规范化 capability，原子授予/撤销并写入 `permission_grant_audit` 与 `admin_audit_log`。
- `public.get_user_capabilities()` 合并角色能力和有效精确权限并返回 canonical capability；`public.has_capability()` 是 Edge Functions 的服务端复核入口。
- `admin-users` action `setPermission` 接收 `userId`、`capability`/`permission`、`active`、可选 `reason`；`admin-redeem-codes` 同时兼容 `rewardPermission` 和前端历史字段 `grantPermission`。
- `forum-post`、`forum-comment` 成功响应包含 `warnings`；敏感命中和禁言错误由全局 HTTP 错误契约返回。

## UI 契约

- DOM/CSS 类名使用 `forum-`、`admin-` 前缀；前端操作按钮只依据 `get_user_capabilities()` 的结果渲染或隐藏。
- 论坛管理动作调用 `forum-moderation`，服务端以 `has_capability()` 再授权；后台所有管理 Edge Function 继续使用共享 `auth/http/permissions/sensitive-filter/supabase` 约定。

## 验证

- `node --test admin/tests/*.mjs admin/tests/*.cjs forum/tests/*.mjs forum/tests/*.cjs`（PowerShell 展开路径后）：`11/11` 通过。
- `node --test tests/schema tests/functions`（展开文件路径）：`42/42` 通过。
- `node --check`：`admin`、`forum` 下 6 个 JavaScript 文件全部通过。
- 当前环境没有 Deno、Supabase CLI 或 `psql`，未执行真实迁移、数据库 advisor、Edge type-check 或线上 RLS 查询。

## 集成假设与待办

- 生产发布前必须先应用 `20260811_forum_admin_enhancements.sql`，再部署依赖 `has_capability()` 的 Edge Functions；迁移失败时不要部署静态前端。
- canonical `supabase/schema.sql` 与其他社区模块共享且由其他线程维护，当前工作区已有未提交/staged 变更；本模块提交不独占或覆盖该文件。
- 腾讯云静态发布沿用共享 `deployment/TENCENT_CLOUD_STATIC.md` 和构建脚本；本模块未在本次收尾中改写部署根路由或注入密钥。
- 目标 Supabase 环境仍需补做一次真实重复兑换、权限撤销、MUTE 写入拒绝和账号转移回滚演练。
