# 任务管理 Mock 工作台发现

- 项目为无构建静态站点；现有任务路由使用 `TaskApi` 与 Supabase，不能替换为 mock，以免改变生产业务。
- 已有 `guardFormData`、`inspectXss`、主题控制器和公开头像渲染能力，可由新增 mock 模块复用。
- `admin/tasks/` 已有严格的 `tasks:manage` 门禁；新增 mock 管理页面应使用真实会话角色门禁，而非授予能力。
- 当前公开版本为 `v1.5`，本次更新应为下一顺序版本 `v1.6`。
- Git 远程 `origin` 指向 `https://github.com/Qianjiao666/First.git`。
