const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const migration = fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260811_module3.sql"), "utf8");
const schema = fs.readFileSync(path.resolve(__dirname, "../../supabase/schema.sql"), "utf8");

test("module 3 defines idempotent reviews, dimensions and reputation summary", () => {
  for (const table of ["notifications", "task_templates", "shop_products", "shop_orders", "shop_order_events", "announcements"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, "i"));
  }
  assert.match(migration, /alter table if exists public\.task_reviews[\s\S]*add column if not exists communication_rating/i);
  assert.match(migration, /communication_rating smallint/i);
  assert.match(migration, /professionalism_rating smallint/i);
  assert.match(migration, /punctuality_rating smallint/i);
  assert.match(schema, /unique \(application_id, reviewer_id\)/i);
  assert.match(migration, /get_user_reputation_summary/i);
});

test("notification reads are recipient scoped and realtime is enabled", () => {
  assert.match(migration, /notifications_read_own/i);
  assert.match(migration, /notifications_mark_own/i);
  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/i);
  assert.match(migration, /event_key text not null unique/i);
});

test("recommendations enforce reputation threshold and current-user ownership", () => {
  assert.match(migration, /recommend_task_listings\(p_user_id uuid/i);
  assert.match(migration, /min_reputation integer not null default 0/i);
  assert.match(migration, /auth\.uid\(\)\) is distinct from p_user_id/i);
  assert.match(migration, /explanation text/i);
});

test("shop redemption is idempotent and atomically locks stock and reputation", () => {
  assert.match(migration, /redeem_shop_product\(p_user_id uuid, p_product_id uuid, p_quantity integer, p_order_key text\)/i);
  assert.match(migration, /select \* into v_product[\s\S]*for update/i);
  assert.match(migration, /select reputation into v_reputation[\s\S]*for update/i);
  assert.match(migration, /order_key = trim\(p_order_key\)/i);
  assert.match(migration, /unique \(user_id, order_key\)/i);
  assert.match(migration, /insert into public\.shop_order_events/i);
  assert.match(migration, /insert into public\.reputation_events/i);
});

test("announcements use role-gated service RPCs and reject unsafe markdown", () => {
  assert.match(migration, /announcements_public_read/i);
  assert.match(migration, /upsert_announcement\(p_actor_id uuid/i);
  assert.match(migration, /set_announcement_pinned\(p_actor_id uuid/i);
  assert.match(migration, /body_markdown !~\* '<\\s\*script'/i);
  assert.match(migration, /javascript:/i);
  assert.match(schema, /announce:create/);
  assert.match(schema, /shop:manageProducts/);
});

test("canonical schema contains the complete module 3 migration", () => {
  const marker = "-- Module 3 merged from supabase/migrations/20260811_module3.sql.";
  assert.ok(schema.includes(marker));
  assert.ok(schema.includes("create table if not exists public.notifications"));
  assert.ok(schema.includes("create or replace function public.redeem_shop_product"));
  assert.ok(schema.includes("create or replace function public.upsert_announcement"));
});
