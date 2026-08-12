import { uploadTaskAttachment as uploadTaskAttachmentToStorage } from "../tasks/task-attachments.js";

const TASK_FUNCTIONS = Object.freeze({
  "task-admin": new Set(["create", "update", "publish", "close", "archive", "delete", "assign", "reject", "manageCategories", "arbitrate"]),
  "task-complete": new Set(["apply", "submit", "cancel", "complete", "attach"]),
  "task-attachments": new Set(["register", "remove", "delete"]),
});

const SORTS = Object.freeze({
  "published_at.desc": { column: "published_at", ascending: false },
  "deadline_at.asc": { column: "deadline_at", ascending: true },
  "reward_points.desc": { column: "reward_points", ascending: false },
});

function requireClient(client) {
  if (!client?.from) throw new Error("任务数据服务暂未连接，请稍后重试。");
  return client;
}

function requireSession(session) {
  if (!session?.access_token) throw new Error("请先登录后再继续。");
  return session;
}

function normalizePage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizeLimit(value) {
  const limit = Number.parseInt(value, 10);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 20;
}

function taskSearchFilter(value) {
  const term = String(value ?? "")
    .trim()
    .replace(/[,()*\[\]{}"\\]/g, " ")
    .replace(/\s+/g, " ");
  if (!term) return null;
  return `title.ilike.*${term}*,skill_tags.cs.${JSON.stringify([term])}`;
}

function mapCategoryRows(tasks, categories) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  return tasks.map((task) => ({
    ...task,
    category: task.category ?? categoryMap.get(task.category_id) ?? null,
  }));
}

async function readQuery(builder, failureMessage = "任务数据读取失败，请稍后重试。") {
  const result = await builder;
  if (result.error) throw new Error(failureMessage);
  return result;
}

async function loadCategories(client, ids = null) {
  let query = client.from("task_categories").select("id, name, slug").eq("is_active", true);
  if (ids?.length) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw new Error("任务分类读取失败，请稍后重试。");
  return data ?? [];
}

async function decorateTasks(client, tasks) {
  const ids = [...new Set(tasks.map((task) => task.category_id).filter(Boolean))];
  if (!ids.length) return tasks;
  return mapCategoryRows(tasks, await loadCategories(client, ids));
}

async function queryPublished(client, filters = {}) {
  const page = normalizePage(filters.page);
  const limit = normalizeLimit(filters.limit);
  const sort = SORTS[filters.sort] ?? SORTS["published_at.desc"];
  let query = client.from("task_listings").select("*", { count: "exact" }).eq("status", "published");

  if (filters.category) query = query.eq("category_id", String(filters.category));
  const search = taskSearchFilter(filters.query);
  if (search) query = query.or(search);

  query = query.order(sort.column, { ascending: sort.ascending });
  query = query.range((page - 1) * limit, page * limit - 1);
  const { data, count } = await readQuery(query);
  const items = await decorateTasks(client, data ?? []);
  return { items, total: count ?? items.length, page, limit };
}

async function queryDetail(client, taskId) {
  const { data, error } = await readQuery(
    client.from("task_listings").select("*").eq("id", taskId).maybeSingle(),
  );
  if (error) throw new Error("任务详情读取失败，请稍后重试。");
  const task = data ? (await decorateTasks(client, [data]))[0] : null;
  let relatedPosts = [];

  if (task) {
    const linksResult = await readQuery(
      client.from("task_post_links").select("post_id").eq("task_id", taskId),
      "相关讨论读取失败，请稍后重试。",
    );
    const postIds = (linksResult.data ?? []).map((link) => link.post_id).filter(Boolean);
    if (postIds.length) {
      const postsResult = await readQuery(
        client.from("forum_posts").select("id, title").in("id", postIds),
        "相关讨论读取失败，请稍后重试。",
      );
      relatedPosts = postsResult.data ?? [];
    }
  }

  return { task, relatedPosts };
}

async function queryMine(client, session) {
  requireSession(session);
  const applicationsResult = await readQuery(
    client.from("task_applications").select("*").eq("applicant_id", session.user.id).order("updated_at", { ascending: false }),
  );
  const applications = applicationsResult.data ?? [];
  const taskIds = [...new Set(applications.map((application) => application.task_id).filter(Boolean))];
  if (!taskIds.length) return { items: [] };

  const tasksResult = await readQuery(client.from("task_listings").select("*").in("id", taskIds));
  const tasks = await decorateTasks(client, tasksResult.data ?? []);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return {
    items: applications.map((application) => ({
      ...application,
      task: taskMap.get(application.task_id) ?? null,
    })),
  };
}

async function queryAdmin(client, filters = {}) {
  let query = client.from("task_listings").select("*").order("updated_at", { ascending: false });
  if (filters.status) query = query.eq("status", String(filters.status));
  const search = taskSearchFilter(filters.query);
  if (search) query = query.or(search);
  const { data } = await readQuery(query);
  const tasks = data ?? [];
  const taskIds = tasks.map((task) => task.id).filter(Boolean);
  const counts = new Map();
  if (taskIds.length) {
    const applicationsResult = await readQuery(
      client.from("task_applications").select("task_id").in("task_id", taskIds),
      "任务申请数量读取失败，请稍后重试。",
    );
    for (const application of applicationsResult.data ?? []) {
      counts.set(application.task_id, (counts.get(application.task_id) ?? 0) + 1);
    }
  }
  const items = await decorateTasks(client, tasks);
  return {
    items: items.map((task) => ({
      ...task,
      application_count: counts.get(task.id) ?? 0,
    })),
  };
}

async function queryAdminDetail(client, taskId) {
  const { data } = await readQuery(client.from("task_listings").select("*").eq("id", taskId).maybeSingle());
  if (!data) return { task: null };
  return { task: (await decorateTasks(client, [data]))[0] };
}

async function queryApplications(client, taskId) {
  const applicationsResult = await readQuery(
    client.from("task_applications").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
  );
  const applications = applicationsResult.data ?? [];
  const applicantIds = [...new Set(applications.map((application) => application.applicant_id).filter(Boolean))];
  if (!applicantIds.length) return { items: [] };

  const profilesResult = await readQuery(
    client.from("user_public_profiles").select("user_id, display_name").in("user_id", applicantIds),
    "申请人资料读取失败，请稍后重试。",
  );
  const names = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile.display_name]));
  return {
    items: applications.map((application) => ({
      ...application,
      applicant_name: names.get(application.applicant_id) ?? "申请人",
    })),
  };
}

async function queryActivity(client, taskId) {
  const result = await readQuery(
    client.from("task_activity_log").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
    "浠诲姟杩涘害璇诲彇澶辫触锛岃绋嶅悗閲嶈瘯銆?",
  );
  return { items: result.data ?? [] };
}

async function queryAttachments(client, taskId) {
  const result = await readQuery(
    client.from("task_attachments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
    "浠诲姟闄勪欢璇诲彇澶辫触锛岃绋嶅悗閲嶈瘯銆?",
  );
  return { items: result.data ?? [] };
}

async function queryCategories(client) {
  const [categories, subcategoriesResult] = await Promise.all([
    loadCategories(client),
    readQuery(client.from("task_subcategories").select("id, category_id, name, slug").eq("is_active", true)),
  ]);
  const subcategories = subcategoriesResult.data ?? [];
  return {
    items: categories.map((category) => ({
      ...category,
      subcategories: subcategories.filter((subcategory) => subcategory.category_id === category.id),
    })),
  };
}

export function createTaskIntegration({
  client,
  config = {},
  getSession,
  getPublicUserIdentity,
  getCapabilities,
  fetch: fetchImpl = globalThis.fetch,
  waitForSession = async () => {},
  requireAuthenticatedAction = async () => null,
} = {}) {
  const activeClient = requireClient(client);

  async function getCurrentUser() {
    const session = await getSession?.();
    if (!session?.user?.id) return null;
    const identity = await getPublicUserIdentity?.(session.user.id);
    return {
      userId: session.user.id,
      role: identity?.role,
      reputation: identity?.reputation,
    };
  }

  async function loadCapabilities() {
    const capabilities = await getCapabilities?.();
    return capabilities && typeof capabilities === "object" ? capabilities : [];
  }

  async function uploadTaskAttachment(request = {}) {
    const session = requireSession(await getSession?.());
    return uploadTaskAttachmentToStorage({
      storage: activeClient.storage,
      userId: request.userId ?? session.user?.id,
      resourceId: request.resourceId,
      file: request.file,
      objectId: request.objectId,
      bucket: request.bucket,
    });
  }

  async function queryTasks(request) {
    switch (request?.scope) {
      case "published": return queryPublished(activeClient, request.filters);
      case "detail": return queryDetail(activeClient, request.taskId);
      case "mine": return queryMine(activeClient, await getSession?.());
      case "admin": return queryAdmin(activeClient, request.filters);
      case "adminDetail": return queryAdminDetail(activeClient, request.taskId);
      case "applications": return queryApplications(activeClient, request.taskId);
      case "activity": return queryActivity(activeClient, request.taskId);
      case "attachments": return queryAttachments(activeClient, request.taskId);
      case "categories": return queryCategories(activeClient);
      default: throw new Error("不支持的任务查询范围。");
    }
  }

  async function invokeTaskFunction(request) {
    const allowedActions = TASK_FUNCTIONS[request?.functionName];
    if (!allowedActions?.has(request?.action)) throw new Error("不支持的任务操作。");
    const session = requireSession(await getSession?.());
    if (typeof fetchImpl !== "function") throw new Error("任务服务暂未连接，请稍后重试。");

    const response = await fetchImpl(`${config.url}/functions/v1/${request.functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: request.action, payload: request.body?.payload ?? request.body ?? {} }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(result?.error?.message ?? "任务操作未完成，请稍后重试。");
      error.code = result?.error?.code ?? "TASK_FUNCTION_FAILED";
      throw error;
    }
    return result ?? {};
  }

  return Object.freeze({
    getCurrentUser,
    getCapabilities: loadCapabilities,
    queryTasks,
    invokeTaskFunction,
    uploadTaskAttachment,
    waitForSession,
    requireAuthenticatedAction,
  });
}

const app = globalThis.window?.MKJApp;
if (app?.client) {
  globalThis.window.MKJ_TASK_INTEGRATION = createTaskIntegration({
    client: app.client,
    config: app.config,
    getSession: app.getSession,
    getPublicUserIdentity: app.getPublicUserIdentity,
    getCapabilities: app.getCapabilities,
    waitForSession: app.ready,
    requireAuthenticatedAction: app.requireAuthenticatedAction,
    fetch: globalThis.fetch.bind(globalThis),
  });
}
