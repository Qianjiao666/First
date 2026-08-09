# 航线

大学生就业确定性工作台，部署路径为 `/MKJ/`。

## Supabase 配置

1. 在 Supabase SQL Editor 中执行 `supabase/schema.sql`。
2. 在 Supabase 的 Connect/API 页面复制 `Publishable key`。
3. 将密钥填入 `supabase-config.js` 的 `publishableKey`。
4. 部署 `index.html`、`styles.css`、`script.js`、`supabase-config.js` 和 `supabase/schema.sql`。

只使用 Publishable key。不要把数据库密码、`service_role` key 或其他服务器密钥放进前端。
初始 存储网页有关
