# 任务发布系统实施计划

状态：任务专属上线前补强已完成本地实现与验证。线上 Function 与部署仍由第 6.1 版或整合方执行。

## 已完成

1. 建立任务页面：公开广场、详情、个人任务、管理员列表和编辑页，所有 DOM 使用 `task-` 前缀。
2. 建立任务领域模块：申请状态机、静态路由解析、视图格式化、API wrapper 和未接入共享 runtime 时的失败闭环。
3. 建立 `task-admin` Edge Function：对 `create`、`update`、`publish`、`close`、`archive`、`delete`、`assign`、`manageCategories` 依次执行：
   - `auth.checkPermission(request, "tasks", action)`
   - `auth.assertNotMuted(context)`
   - 对内容调用 `replaceSensitive(adminClient, { text, userId, enforceMute })`
   - 调用 service-only RPC，并传递 `context.userId` 作为 `p_actor_id`。
4. 建立 `task-complete` Edge Function：对 `apply`、`submit`、`complete` 执行同样的可信身份和禁言检查。申请/提交使用 `enforceMute: true`；核验评价使用 `false` 并在任何命中时拒绝。
5. 提供 `supabase/modules/tasks.sql` 草案，其中有六张任务表、索引、RLS、禁止浏览器执行的 RPC 及一次性奖励事务。
6. 文档化论坛关联、后台菜单、`MKJ_TASK_INTEGRATION` transport 和整合检查清单。
7. transport 保留 Edge 顶层 warnings；管理员草稿显示敏感内容替换提示。
8. 后台使用 `tasks:manage` 页面守卫，管理列表补充 `application_count`，搜索覆盖标题和能力标签。
9. 补齐拒绝、取消、评价核验和大类/子类管理 UI，以及对应 Edge/RPC 状态迁移。
10. 模块 SQL 提供幂等默认分类，并在任务写 RPC 内验证 active taxonomy 归属。

## 待第 6.1 或整合方执行

1. 审核 `supabase/modules/tasks.sql` 的表、RLS、权限和 RPC，与当前 canonical schema 合并；不要由第 6.2 单独执行 SQL。
2. 在共享权限实现中确认 `tasks` 的 camelCase actions 均已映射到角色策略及能力展示标记。
3. 在核心 shell 注册 `MKJ_TASK_INTEGRATION`，其契约见 [EDGE_API.md](EDGE_API.md)，并通过当前会话调用两个 Edge Function。
4. 在 `/admin/index.html` 注册 [menu-descriptor.js](menu-descriptor.js)，在 `admin:access` 下显示任务管理入口。
5. 部署 schema、Function 和静态目录后，在真实项目测试匿名读取、权限拒绝、禁言、敏感词、重复完成和声望刷新。

## 验收顺序

1. 匿名用户只能列出或读取 `published` 任务，无法读取申请或草稿。
2. ADMIN 可以创建草稿；草稿命中词返回 warnings；发布命中词被拒绝。
3. 未禁言的登录用户可以申请，被接受后可以提交；`MUTE` 词导致禁言和本次写入失败。
4. 管理员仅能从 `submitted` 申请完成核验；重试不重复奖励。
5. 声望变化在任务与论坛的共同公开资料显示中一致。
6. 四种宽度下页面无横向溢出，键盘焦点可见，浏览器控制台无错误。

## 文件所有权检查

任务实施只修改第 6.2 专属目录。`forum/`、共享 Function、核心声望组件、`supabase/schema.sql`、根页面、后台壳层、发布包和部署不在本计划的写入范围内。
