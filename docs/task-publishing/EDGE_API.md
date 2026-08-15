# 任务运行时与 Edge API

本文件定义 6.1 核心 shell 注入给任务静态页面的唯一前端接线。它不要求修改共享鉴权、徽章或数据库实现。

## `MKJ_TASK_INTEGRATION`

任务控制器从 `window.MKJ_TASK_INTEGRATION` 取得四个函数：

```ts
type TaskIntegration = {
  getCurrentUser(): Promise<null | {
    userId: string;
    role?: string;
    reputation?: number;
  }>;
  getCapabilities(): Promise<string[] | Record<string, boolean>>;
  queryTasks(request: TaskQuery): Promise<TaskQueryResult>;
  invokeTaskFunction(request: {
    functionName: "task-admin" | "task-complete";
    action: string;
    body: Record<string, unknown>;
  }): Promise<TaskFunctionEnvelope<Record<string, unknown>>>;
};
```

`getCurrentUser` 从已建立的 Auth session 和公开身份适配器返回展示数据。徽章不是此对象的一部分，任务页面直接导入核心 `renderReputationBadge`。

## 读取请求

```ts
type TaskQuery =
  | { scope: "published"; filters: { category?: string; query?: string; sort?: string; page?: number } }
  | { scope: "detail"; taskId: string }
  | { scope: "mine" }
  | { scope: "admin"; filters: { status?: string; query?: string } }
  | { scope: "adminDetail"; taskId: string }
  | { scope: "applications"; taskId: string }
  | { scope: "categories" };

type TaskQueryResult =
  | { items: TaskListing[]; total: number; page: number; limit: number }
  | { task: TaskListing | null; relatedPosts: Array<{ id: string; title: string }> }
  | { items: TaskApplicationWithTask[] }
  | { items: Array<TaskListing & { application_count: number }> }
  | { task: TaskListing | null }
  | { items: TaskApplicationWithApplicant[] }
  | { items: TaskCategoryWithSubcategories[] };

type TaskFunctionEnvelope<T> = {
  data: T;
  warnings?: string[];
};
```

适配器只能在 RLS 允许的范围读取任务表，且必须保持 scope 区分：`published` 允许匿名，`mine` 只返回当前申请人，`admin`、`adminDetail` 和 `applications` 仅允许具有任务管理能力的会话。`adminDetail` 用于预填已有草稿，不能降级为公开 detail 查询。不可用时抛出普通 `Error`；页面会显示可读状态。

`published` 与 `admin` 的 `filters.query` 同时匹配标题和 `skill_tags`：标题使用部分匹配，标签使用单个完整标签匹配。`admin` 返回的每个任务必须包含 `application_count`，其值为该任务所有申请记录数量。

## 写入请求

`invokeTaskFunction` 使用当前用户 Bearer session 调用 Supabase Edge Function。函数名与动作的映射固定：

| Function | 动作 |
| --- | --- |
| `task-admin` | `create`、`update`、`publish`、`close`、`archive`、`delete`、`assign`、`reject`、`manageCategories` |
| `task-complete` | `apply`、`submit`、`cancel`、`complete` |

浏览器只传输 action 与页面输入，绝不能传递 `actor_id`、角色、禁言时间、敏感词处理结果或声望金额。Function 会从可信 `TrustedContext` 取得 actor，并负责全部写入决定。

Edge 成功响应保留完整 `{ data, warnings? }` envelope。`MKJ_TASK_INTEGRATION.invokeTaskFunction` 不得丢弃顶层 `warnings`；任务模块 `task-api` 将 `data` 字段与可选 warnings 解包为页面结果。管理员保存草稿时，页面根据 warnings 数量显示敏感内容替换提示。

`reject` 复用全局 `tasks:assign` 权限并调用 `reject_applicant`；`cancel` 复用全局 `tasks:submit` 权限并调用 `cancel_application`。这两个 Edge 路由动作不扩张全局能力集。`complete` 可携带 `review: { rating: 1 | 2 | 3 | 4 | 5, content: string }`。`manageCategories` 接受大类或子类 payload：`{ kind, categoryId?, name, slug, description?, sortOrder, isActive }`。

`/MKJ/admin/tasks/` 与编辑页在发出任何 admin scope 查询前调用 `getCapabilities()`，且仅在包含 `tasks:manage` 时启用。权限缺失或查询失败时，页面隐藏并禁用所有 `data-task-admin-write` 区域。
