# Module 3 Handoff

更新时间：2026-08-11

## 变更

- `shop/`：积分商品浏览、幂等兑换、库存/积分展示、用户订单历史；按钮仅在 `shop:*` 能力存在时显示。
- `announcements/`：公告 Markdown CRUD、置顶、删除和安全渲染；管理控件仅在 `announce:*` 能力存在时显示，并导出 `mountAnnouncementBanner()`。
- `shared/notification-bell.js`：通知铃铛、未读数、单条/全部已读、Realtime recipient 过滤和断线重连。
- `supabase/migrations/20260811_module3.sql` 与 canonical `supabase/schema.sql`：三维评价与信誉汇总、通知/RLS/Realtime、解释性推荐、任务模板、商城原子兑换与审计、公告 RLS/CRUD、能力标记。
- `supabase/functions/task-review`、`notifications`、`shop`、`announcements`：统一 `_shared` auth/http/sensitive-filter/supabase 约定，服务端二次授权。
- `deployment/`：COS env 示例、COS 上传脚本、CDN 刷新脚本、静态发布手册；发布脚本已包含 `shop/` 与 `announcements/`，并排除测试文件。

## 契约

- Shop：匿名 `GET` 或 `POST { action: "listProducts" }`；登录用户 `redeem`（`productId`, `quantity`, `orderKey/idempotencyKey`）和 `listOrders`；管理员另有 `upsertProduct`/`orders`。
- Announcements：匿名 `GET` 或 `POST { action: "list" }` 读取已发布公告；管理端 `upsert`（兼容 `create/update` 字段）、`setPinned`、`delete`。
- Notifications：`GET` 列表；POST `read` / `readAll`；Realtime 订阅按 `recipient_id` 过滤。
- Reviews：`task-review` 接受沟通/专业度/守时 1-5 分及正文，重复评价由 `(application_id, reviewer_id)` 唯一约束拒绝。
- Recommendations：`recommend_task_listings(user_id, limit)` 只允许当前用户调用，按历史分类、目标岗位和奖励解释排序，并应用 `min_reputation` 门槛。

## 验证

- `node --test shop/tests/shop.test.mjs announcements/tests/announcements.test.mjs tests/browser/notification-bell.test.mjs`：通过。
- `node --test tests/schema/module3-foundation.test.cjs tests/schema/global-foundation.test.cjs tests/schema/forum-foundation.test.cjs`：通过。
- 四个新增 Edge Function `node --experimental-strip-types --check`：通过。
- `node --test tests/release/build-community-release.test.cjs tests/release/community-runbook.test.cjs`：通过。
- COS/CDN PowerShell 解析与 `-DryRun`：通过；凭据扫描无秘密。

## 集成假设与待办

- 尚未在真实 Supabase 项目执行迁移、Deno 部署、Realtime 断线 E2E、RLS/并发兑换线上验收；需按 `docs/COMMUNITY_RELEASE_RUNBOOK.md` 操作。
- 论坛与任务页未改动；调用方可在页面增加挂载槽后使用 `mountAnnouncementBanner()` 和 `mountNotificationBell()`。
- COS/CDN 脚本依赖本机/CI 已配置的 `coscli`、`tccli` 凭据 profile；仓库只保留无密钥 env 示例。
- 当前 Git 身份未配置，提交/推送未执行；部署文件已按责任路径暂存，其他工作树改动保持原状。
