# Module 3 数据库与 Edge Functions Handoff

更新时间：2026-08-11

## 变更范围

- `supabase/migrations/20260811_module3.sql`：幂等迁移，覆盖多维任务评价、信誉汇总、通知/Realtime、解释性推荐、任务模板、积分商城、公告与能力矩阵。
- `supabase/schema.sql`：已合并同一迁移内容（保留既有任务/论坛/管理模块）。
- `supabase/functions/task-review/index.ts`：完成任务参与者评价，沟通/专业度/守时 1-5 分，统一敏感词过滤。
- `supabase/functions/notifications/index.ts`：通知列表、单条已读、全部已读。
- `supabase/functions/shop/index.ts`：商品列表、兑换、管理员商品写入与订单列表。
- `supabase/functions/announcements/index.ts`：公告公开读取与管理端 list/create/update/setPinned/delete，Markdown 危险 HTML/URI 拒绝。
- `tests/schema/module3-foundation.test.cjs`：数据库契约回归测试。

## 数据库契约

### 评价与推荐

- `task_reviews` 增加 `communication_rating`、`professionalism_rating`、`punctuality_rating`，保留 `(application_id, reviewer_id)` 唯一约束。
- service-only RPC：`submit_task_review(...)`；参与者只能评价已完成申请，重复评价返回 `23505`。
- `get_user_reputation_summary(user_id)` 仅返回聚合分数与数量，不暴露评价正文。
- `task_listings.min_reputation` 作为声望门槛；`recommend_task_listings(user_id, limit)` 仅允许当前用户调用，返回匹配岗位、历史分类、奖励排序的解释字段。
- `task_templates` 通过 `upsert_task_template`/`delete_task_template` 写入，公开模板与个人模板由 RLS 隔离。

### 通知

- `notifications` 以 `event_key` 幂等，收件人 RLS 只读自己的记录；客户端仅有 `read_at` 列更新权限。
- `create_notification`、`mark_notification_read`、`mark_all_notifications_read` 均 service-only；任务申请状态与新评价会自动生成通知。
- `notifications` 已加入 `supabase_realtime`（不存在该 publication 时迁移会跳过）。

### 商城

- `shop_products`、`shop_orders`、`shop_order_events`；商品公开只读，订单/审计只允许本人读取。
- `redeem_shop_product(user, product, quantity, order_key)` 先锁商品与用户声望，在同一事务内校验库存/积分、扣减、写订单/审计/声望负账；`(user_id, order_key)` 唯一支持重试幂等并防止跨账户幂等键复用。
- `upsert_shop_product` 仅管理员 service RPC。

### 公告

- `announcements` 支持 `draft/published/archived`、置顶、发布时间；公开 RLS 仅能读取 published。
- `upsert_announcement`、`set_announcement_pinned`、`delete_announcement` 仅 moderator/admin service RPC；数据库拒绝 `<script` 与 `javascript:`，Edge 额外拒绝事件处理器属性。

### 能力标记

`get_user_capabilities()` 已补充 `shop:view`、`shop:redeem`、`shop:manageProducts`、`shop:manageOrders` 与 `announce:read/create/update/delete/publish/pin`。Edge Functions 仍在服务端根据可信角色再次授权。

## 验证

```text
node --test tests/schema/module3-foundation.test.cjs  # 6/6
node --experimental-strip-types --check supabase/functions/task-review/index.ts
node --experimental-strip-types --check supabase/functions/shop/index.ts
node --experimental-strip-types --check supabase/functions/announcements/index.ts
node --experimental-strip-types --check supabase/functions/notifications/index.ts
```

## 集成假设与待办

- 前端调用路径：`task-review`、`notifications`、`shop`、`announcements`；商城动作使用 `redeem/listProducts/listOrders`，公告动作使用 `list/create/update/setPinned/delete`。
- 所有写入正文由 Edge Function 调用 `_shared/sensitive-filter.ts`；命中 MUTE 会沿用全局自动禁言。
- 尚未在目标 Supabase 项目执行真实迁移、Realtime 订阅断线恢复、角色/RLS/并发兑换 E2E 或部署 Edge Functions；上线前按社区 runbook 完成这些门禁。
- 当前环境无 Deno、Supabase CLI、psql，无法替代线上 SQL 解析和部署检查。
