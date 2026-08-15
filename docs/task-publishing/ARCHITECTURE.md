# 任务发布系统架构说明

状态：第 6.2 版任务专属实现已完成，第 6.1 版已在本地合并 SQL 并接入共享运行时。论坛仍完全由第 6.1 版负责；数据库迁移、Edge Function 部署和正式上线尚未执行。

## 目标与路由

任务模块提供管理员创建、保存草稿、发布、关闭、归档和删除；登录用户申请、提交或取消已领取任务；管理员受理、分配或拒绝申请、核验完成和评价，并管理任务分类。核验完成后，以一次性全局事件奖励任务设定的声望值。

```text
/MKJ/tasks/                 公开任务广场
/MKJ/tasks/detail/?id=<uuid> 任务详情、申请和关联论坛帖子
/MKJ/tasks/my/              当前用户申请、提交和完成状态
/MKJ/admin/tasks/           管理员任务列表、申请分配与核验
/MKJ/admin/tasks/edit/?id=  新建或编辑任务草稿
```

所有任务 DOM 与 class 均以 `task-` 开头。论坛使用 `forum-` 前缀并在其独占目录内实现。

## 模块边界

```text
浏览器
  -> MKJ_TASK_INTEGRATION (公开读取与带会话的 Function 调用)
  -> task-admin 或 task-complete Edge Function
  -> auth.checkPermission(request, "tasks", action)
  -> auth.assertNotMuted(context)
  -> replaceSensitive(adminClient, { text, userId, enforceMute })
  -> service-only task RPC (trusted actor_id + filtered payload)
  -> task tables and, at completion, global event transaction
```

Edge Function 取得的 `TrustedContext` 是唯一可信 actor 来源。任务 RPC 由 service role 调用，浏览器没有执行权限。RLS 仅开放已发布任务与当前用户自己的申请/评价读取；所有写入均经过状态机。

## 数据模型与状态机

| 表 | 责任 |
| --- | --- |
| `task_categories` | 活跃任务大类与排序 |
| `task_subcategories` | 类别下的活跃子类 |
| `task_listings` | 任务内容、奖励、容量、截止时间和生命周期 |
| `task_applications` | 申请、分配、提交、核验状态及奖励事件键 |
| `task_reviews` | 管理员对已完成申请的单次评价 |
| `task_post_links` | 任务 UUID 与论坛帖子 UUID 的显式关联 |

任务状态：`draft -> published -> closed -> archived`，以及 `draft -> archived`、`published -> archived`。申请状态：`pending -> accepted -> submitted -> completed`，`pending -> rejected`，或 `accepted -> cancelled`。`reject` 在 Edge 映射到 `tasks:assign`，`cancel` 映射到 `tasks:submit`；当前全局权限矩阵只授予 ADMIN `tasks:complete`，SQL 仍额外确认执行者是任务创建者或 ADMIN。

## 全局协作

### 身份、禁言与敏感词

服务端以 `checkPermission` 取得 `{ userId, role, mutedUntil }`，并在所有写入前调用 `assertNotMuted`。管理员草稿允许命中词但返回 warning；发布任务时任何命中词都会阻止发布。用户申请或提交命中 `WARN` 后保存替换文本，命中 `MUTE` 时共享适配器会写入禁言并拒绝本次操作。详见 [CONTRACT.md](CONTRACT.md)。

### 声望与徽章

`complete_task` 锁定任务的 `reward_points`，生成 `task:{taskId}:user:{userId}:completion:v1`，并在同一事务调用全局事件契约。它不写公开身份或声望字段。页面通过 6.1 维护的 `renderReputationBadge(container, { userId, reputation?, role?, compact? })` 显示结果。

### 论坛

第 6.1 版维护论坛页面、帖子、评论、投票、论坛敏感词接线及论坛声望事件。论坛导航由 6.1 提供任务广场链接；任务端只在详情中消费公开帖子摘要和链接。`task_post_links` 暂无跨模块外键，后续由 6.1 决定是否加约束。

### 后台

`/admin/index.html` 及其导航由 6.1 维护。第 6.2 版仅提供任务后台页面与菜单 descriptor。菜单可见性由 `admin:access` 决定，页面动作则重新以 `tasks:manage` 和每个精确 action 授权。

## 故障处理与部署边界

共享 transport 未接入时，任务运行时返回明确的不可用错误且不发出写请求。任务后台在读取任何管理数据前验证 `tasks:manage`，失败时隐藏并禁用写区域。敏感词、禁言、权限或状态机失败均由 Edge Function 映射为可读错误。任务模块不调用生产数据库，不部署 Function，不创建发布包；SQL 保留在 `supabase/modules/tasks.sql` 作为审阅副本，新增 RPC 与 taxonomy 校验需由 6.1 再次审核合入 `supabase/schema.sql`。
