# 航线更新日志

本文件按公开版本号的实际演进顺序记录项目变化。公开版本只使用两段式 `vX.Y`。

## v0.1

- 建立航线求职竞争力评估页面与基础内容结构。

## v0.2

- 接入 Supabase 账户、会话与云端求职进度，并修复认证邮件回跳和错误提示。

## v0.3

- 增加主题预设、岗位与学校搜索、自定义任务、账户留言和移动端体验。

## v0.4

- 扩充本地大学索引并整理无外部运行时依赖的静态发布结构。

## v0.5

- 升级十题渐进测评、进度恢复、六维雷达、能力名片与完整结果体验。

## v0.6

- 建立社区入口以及论坛、任务、全局权限、声望、公告、商城和后台模块。

## v0.7

- 完成社区与任务后端迁移、Edge Functions、RLS、发布清单和生产部署。

## v0.8

- 修复论坛跨页面账户状态显示，统一公开昵称、角色标签和资源版本标记。

## v0.9

- 完成从 v0.8 到 v1.0 的全站视觉规范、页面覆盖矩阵与发布准备。

## v1.0

- 上线“职业校准台”全站视觉系统，覆盖 20 个生产页面并保持原业务契约。

## v1.1

- 增强跨页面会话、XSS 与敏感词防护、三套主题和移动端组件一致性。
- 头像显示兼容与后端安全实现保留；头像上传入口因腾讯 IMS 账号权限尚未开通而延期，不计入本次交付验收。


## v1.2

- Added the Signal Horizon v1.2 presentation overlay with unified light/dark theme tokens, focus states, hover/active feedback, and restrained motion.
- Added 19 local PNG technology illustrations for home, forum, tasks, profile, and empty states with lazy loading, explicit dimensions, alt text, and error fallback.
- Preserved all business entry points, sensitive-word filtering, Supabase session behavior, API contracts, and data structures.
