# 任务发布系统共享契约

## 协作任务市场扩展

协作任务使用 `task_templates`、`task_publishing_rules`、`task_publishing_overrides`、`task_conversations`、`task_member_assignments` 和 `task_peer_reviews`。发布资格由 `get_task_publishing_eligibility` 返回，模板和治理写入只经 service-only RPC。

浏览器通过 `task-collaboration` 调用 `getCollaboration`、`getConsultation`、`sendMessage`、`assignMember`、`submitPeerReview` 和 `getAuditContext`；模板与资格 API 为 `getTemplates`、`getPublishingEligibility`、`saveTemplate`、`savePublishingRule`、`savePublishingOverride`。不实现支付、钱包、退款或提现流程。

状态：已按第 6.1 版本地共享实现适配。任务模块只消费这里列出的接口；不修改共享实现、规范 schema、论坛或部署文件。

## 1. 所有权与权限

第 6.2 版只维护 `tasks/`、`admin/tasks/`、`assets/js/tasks/`、`assets/css/tasks.css`、`supabase/functions/task-admin/`、`supabase/functions/task-complete/`、`supabase/modules/tasks.sql` 与 `docs/task-publishing/`。第 6.1 版维护 `/forum/`、`supabase/schema.sql`、`supabase/functions/_shared/`、核心页面、`/admin/index.html`、发布包和部署。

任务资源固定为 `tasks`。服务端动作是 `create`、`update`、`publish`、`close`、`archive`、`delete`、`apply`、`assign`、`submit`、`complete`、`manageCategories`、`manage`。前端展示能力字符串使用 `tasks:create` 等同名标记；服务端必须重新授权，不能信任该展示数据。

任务模块另有两个 UI/Edge 路由动作，但不新增共享能力：`reject` 映射到 `tasks:assign`，`cancel` 映射到 `tasks:submit`。映射必须在 Edge Function 内显式完成，浏览器不能选择实际鉴权动作。

| 动作 | 匿名 | USER | MODERATOR | ADMIN |
| --- | --- | --- | --- | --- |
| 读取 published | 是 | 是 | 是 | 是 |
| create/update/publish/close/archive/delete/manageCategories/manage | 否 | 否 | 否 | 是 |
| apply/submit | 否 | 是，未禁言 | 是，未禁言 | 是，未禁言 |
| assign/complete | 否 | 否 | 否 | 是 |

## 2. 可信身份与禁言

所有 Edge 写操作先调用实际共享鉴权接口：

```ts
type TrustedContext = {
  userId: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  mutedUntil: string | null;
};

auth.checkPermission(request, "tasks", action): Promise<TrustedContext>
auth.assertNotMuted(context): void
```

`checkPermission` 成功即返回可信 actor，并非 `{ allowed, userId, reason }` 形式的结果。每个写操作均在取得上下文后执行 `auth.assertNotMuted(context)`；因此浏览器传来的角色或禁言状态永远不参与授权。

## 3. 敏感词

任务 Edge Function 使用共享适配器，而浏览器和 task RPC 均不可直接调用敏感词表或处理器：

```ts
replaceSensitive(adminClient, { text, userId, enforceMute }): Promise<{
  text: string;
  severity: "NONE" | "WARN" | "MUTE";
  matches: string[];
  mutedUntil: string | null;
}>
```

- 管理员保存草稿：`enforceMute: false`。返回命中词警告，草稿写入过滤后的文本，不写入管理员禁言状态。
- 管理员发布：先读取已保存的草稿并再次以 `enforceMute: false` 检查；任何非 `NONE` 结果都阻止发布，不存在强制绕过。
- 用户申请与提交：以 `enforceMute: true` 调用。`WARN` 保存替换后的文本并返回 warnings；`MUTE` 会由共享适配器写入 24 小时禁言，再拒绝本次写入。
- 管理员核验时的评价：以 `enforceMute: false` 调用；任何非 `NONE` 结果都拒绝评价内容。管理员不会因任务或评价文本被自动禁言。

## 4. 声望事件

浏览器永不写声望。应用层调用全局 adapter 时，使用实际签名：

```ts
recordReputationEvent(client, {
  eventKey, userId, amount, reason, sourceResource, sourceId, actorId,
}): Promise<{ applied: boolean; eventId: string | null; reputation: number }>
```

任务核验必须保持数据库原子性，因此 `complete_task -> apply_reputation_event` 在同一个 service-only RPC 事务中执行：锁定任务和申请，读取锁定记录中的 `reward_points`，将申请更新为 `completed`，并传入：

```text
eventKey = task:{taskId}:user:{userId}:completion:v1
userId = application.applicant_id
amount = task.reward_points
reason = task_completion
sourceResource = tasks
sourceId = task.id
actorId = trusted actor_id
```

全局事件的幂等键确保重试只产生一次奖励。论坛投票和任务完成均写入同一全局事件流，界面随后从公开身份数据读取声望与等级。

## 5. Service-Only RPC

任务 SQL 草案中的 RPC 均为 `SECURITY DEFINER`、固定 `search_path`，接受已由 Edge Function 授权的 `actor_id` 和已经过滤的内容。浏览器、`anon` 与 `authenticated` 没有 `EXECUTE` 权限，只有 service role Edge Function 可以调用。

```sql
create_task(p_actor_id uuid, p_filtered_payload jsonb) returns uuid
update_task(p_actor_id uuid, p_task_id uuid, p_filtered_payload jsonb) returns uuid
publish_task(p_actor_id uuid, p_task_id uuid, p_filtered_payload jsonb) returns uuid
close_task(p_actor_id uuid, p_task_id uuid) returns uuid
archive_task(p_actor_id uuid, p_task_id uuid) returns uuid
delete_task(p_actor_id uuid, p_task_id uuid) returns uuid
apply_task(p_actor_id uuid, p_task_id uuid, p_filtered_application_note text) returns uuid
assign_applicant(p_actor_id uuid, p_application_id uuid) returns uuid
reject_applicant(p_actor_id uuid, p_application_id uuid) returns uuid
submit_task(p_actor_id uuid, p_application_id uuid, p_filtered_submission_note text) returns uuid
cancel_application(p_actor_id uuid, p_application_id uuid) returns uuid
complete_task(p_actor_id uuid, p_application_id uuid, p_filtered_review jsonb default null) returns uuid
upsert_task_category(p_actor_id uuid, p_payload jsonb) returns uuid
validate_task_taxonomy(p_category_id uuid, p_subcategory_id uuid) returns void
```

RPC 只验证任务领域关系和状态机，不能把浏览器变成直接 RPC 调用者，也不能自行进行内容过滤或身份认证。所有任务函数固定 `set search_path = ''`，且所有对象均使用 schema-qualified 名称。`create_task`、`update_task` 和 `publish_task` 必须调用 `validate_task_taxonomy`，确认大类启用、子类启用且子类属于所选大类。模块 SQL 幂等提供 active 默认大类 `career-actions`，使首次迁移后可创建任务。

## 6. 前端、论坛与后台协作

任务页面从第 6.1 版的 `assets/js/core/reputation.js` 导入：

```ts
createReputationBadge({ userId, reputation?, role?, compact? })
renderReputationBadge(container, { userId, reputation?, role?, compact? })
```

任务运行时只依赖 `MKJ_TASK_INTEGRATION` 的任务数据 transport；不会注入、实现或替代徽章。适配形状、读写 scope 和错误语义见 [EDGE_API.md](EDGE_API.md)。

`task_post_links` 仅保存任务 UUID 和论坛帖子 UUID，不建立跨模块外键。任务详情通过公开帖子详情契约展示链接；论坛详情可读取公开任务摘要。两个模块不 import 对方目录。

后台菜单由第 6.1 版统一接入 [menu-descriptor.js](menu-descriptor.js)，并以 `admin:access` 控制可见性。任务后台自身仍要以 `tasks:manage` 授权。

任务 transport 返回完整 `{ data, warnings? }` Edge envelope；任务 API wrapper 只在进入页面控制器前解包。`admin` scope 为每条任务补充 `application_count`。公开和后台搜索同时覆盖标题部分匹配与 `skill_tags` 完整标签匹配。

本版 UI 可达范围包括：管理员创建、编辑、发布、关闭、归档、查看申请、分配或拒绝 pending 申请、对 submitted 申请评分并评价后核验完成；用户申请、提交和取消 accepted 领取；管理员创建或更新大类与子类。帖子关联写入仍由论坛整合阶段另行决定，不在本轮任务 UI 写入范围。

分类读取 scope 只返回 active 项。分类或子类被停用后会从管理列表与任务编辑下拉框消失；当前 UI 不能直接选中停用记录，管理员必须使用原 slug 再次 upsert 并勾选启用才能恢复。

## 7. 交接条件

- [x] 任务专属 UI、领域状态机、SQL 草案、Edge Function 和本契约完成。
- [x] 已与本地共享鉴权、禁言、敏感词、声望和徽章 API 对齐。
- [x] 第 6.1 已审核并合并 `supabase/modules/tasks.sql` 到规范 schema；真实数据库验证留待迁移窗口。
- [x] 第 6.1 已接入后台任务入口与 `MKJ_TASK_INTEGRATION`；尚未部署 Edge Function 与静态目录。
- [ ] 整合方完成真实 Supabase 环境的端到端验收；第 6.2 不执行迁移、打包或部署。
