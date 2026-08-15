import test from "node:test";
import assert from "node:assert/strict";

const moduleUrl = new URL("../../assets/js/security/form-guard.js", import.meta.url);

function formWith(values) {
  return {
    elements: Object.fromEntries(Object.keys(values).map((name) => [name, { name, value: values[name] }])),
  };
}

test("guardFormData preserves ordinary public text", async () => {
  const { guardFormData } = await import(moduleUrl);
  const result = guardFormData(formWith({ title: "一次正常的求职经验" }), ["title"]);

  assert.equal(result.values.title, "一次正常的求职经验");
  assert.deepEqual(result.warnings, []);
});

test("guardFormData returns star-replaced WARN text", async () => {
  const { guardFormData } = await import(moduleUrl);
  const result = guardFormData(formWith({ content: "alpha warning beta" }), ["content"], null, {
    warnWords: ["warning"],
    blockWords: [],
  });

  assert.equal(result.values.content, "alpha ******* beta");
  assert.deepEqual(result.warnings, ["warning"]);
});

test("guardFormData blocks XSS with a friendly recoverable error", async () => {
  const { guardFormData } = await import(moduleUrl);
  const status = { hidden: true, textContent: "", dataset: {} };

  assert.throws(
    () => guardFormData(formWith({ body: "<img src=x onerror=alert(1)>" }), ["body"], status),
    (error) => error.code === "XSS_BLOCKED" && error.message === "检测到可能执行脚本的内容，请修改后重试。",
  );
  assert.equal(status.hidden, false);
  assert.equal(status.dataset.state, "error");
  assert.equal(status.textContent, "检测到可能执行脚本的内容，请修改后重试。");
});

test("guardFormData blocks high-risk content before submission", async () => {
  const { guardFormData } = await import(moduleUrl);

  assert.throws(
    () => guardFormData(formWith({ content: "do not persist" }), ["content"], null, {
      warnWords: [],
      blockWords: ["do not persist"],
    }),
    (error) => error.code === "CONTENT_BLOCKED" && error.message === "内容包含高风险信息，本次提交未保存。",
  );
});

test("guardFormData only reads explicitly listed public text fields", async () => {
  const { guardFormData } = await import(moduleUrl);
  const form = formWith({ displayName: "航线同学", email: "user@example.com", password: "<script>password</script>" });
  const result = guardFormData(form, ["displayName"]);

  assert.deepEqual(result.values, { displayName: "航线同学" });
  assert.equal("email" in result.values, false);
  assert.equal("password" in result.values, false);
});
