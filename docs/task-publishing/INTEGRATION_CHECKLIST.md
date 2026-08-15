# 任务模块整合清单

本清单供第 6.1 版或最终整合方执行。第 6.2 版不修改这些共享文件，也不执行迁移或部署。

- [x] 已在本地审查并将 `supabase/modules/tasks.sql` 合并到 canonical `supabase/schema.sql`。
- [ ] 在目标 Supabase 环境执行 canonical schema 迁移，并运行数据库 advisors。
- [x] 静态验证所有任务表均启用 RLS，浏览器角色无任务 RPC 执行权限，只有 `service_role` 获授权；真实数据库验证留待迁移窗口。
- [x] 确认共享 `canRole` 支持 `tasks` 的全部 camelCase actions，并由能力集输出对应的 `tasks:*` 展示标记。
- [ ] 使用真实 Deno 完成 Edge Function type-check；部署共享依赖后再部署 `task-admin` 与 `task-complete`，不在 Function 配置或日志中暴露任何密钥。
- [x] 在任务页面加载共享 runtime 和 `MKJ_TASK_INTEGRATION`，实现见 [EDGE_API.md](EDGE_API.md)。
- [x] 后台导航已接入任务管理入口，并以 `admin:access` 控制可见性。
- [x] 论坛导航已接入 `/MKJ/tasks/` 链接；任务详情通过公开帖子查询渲染 `task_post_links`。
- [ ] 用匿名、USER、MODERATOR、ADMIN 和禁言账户验证权限矩阵。
- [ ] 验证敏感词：草稿 warning、发布阻止、申请 WARN 替换、申请 MUTE 禁言和拒绝。
- [ ] 验证 `complete_task` 重试不会产生第二笔奖励，且任务与论坛徽章读取一致。
- [x] 已将 `reject_applicant(uuid, uuid)`、`cancel_application(uuid, uuid)`、`validate_task_taxonomy(uuid, uuid)` 及 `career-actions` seed 从模块 SQL 审核合入本地 canonical schema。
- [x] 已验证 Edge transport 保留 `{ data, warnings? }`，草稿 warnings 在管理员编辑页可见。
- [x] 已验证 MODERATOR 即使具备 `admin:access`，缺少 `tasks:manage` 时仍无法进入任务写界面或触发 admin scope 查询。
- [x] 已验证标题部分搜索、能力标签完整匹配和管理员 `application_count` 均返回预期结果。
- [x] 已记录并验证停用分类恢复流程：分类查询只返回 active，恢复时使用原 slug 再次 upsert 且设置 `isActive: true`。
- [x] 第 6.2 版已在 375、768、1280、1920 宽度验证静态页面并检查控制台错误；共享接入后的最终 E2E 留待目标环境。
- [x] 已修复共享敏感词过滤器的 NFKC 全角匹配/替换一致性，并补充 WARN/MUTE 回归测试。
- [x] 已修复 task-complete 申请与提交 warnings 的顶层 response envelope，并补充 Edge 契约测试。
- [x] 已生成可重复构建的 r3 静态包和独立后端包；包内容、Linux 路径、清单哈希和凭据文件名已在本地验证。
- [ ] 目标环境门禁仍未执行：canonical schema、数据库 advisors、真实 Deno type-check、Edge Functions、角色/RLS/敏感词/幂等奖励 E2E 和线上静态部署。

发布顺序与回滚步骤统一见 [COMMUNITY_RELEASE_RUNBOOK.md](../COMMUNITY_RELEASE_RUNBOOK.md)。
