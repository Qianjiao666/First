export function element(tag, className = "", text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

export function showPanel(container, title, body, onRetry) {
  if (!container) return;
  const panel = element("section", "admin-message");
  panel.setAttribute("role", "status");
  panel.append(element("h1", "admin-message-title", title), element("p", "admin-message-copy", body));
  if (onRetry) {
    const retry = element("button", "admin-primary-button", "Retry");
    retry.type = "button";
    retry.dataset.adminRetry = "";
    retry.setAttribute("data-admin-retry", "");
    retry.addEventListener("click", onRetry, { once: true });
    panel.append(retry);
  }
  container.replaceChildren(panel);
}

const navigation = [
  ["Overview", "/MKJ/admin/", "admin:access"],
  ["Forum", "/MKJ/admin/forum/", "admin:manageForum"],
  ["Users", "/MKJ/admin/users/", "admin:manageUsers"],
  ["Redeem codes", "/MKJ/admin/redeem-codes/", "admin:manageRedeemCodes"],
  ["Sensitive words", "/MKJ/admin/sensitive-words/", "admin:manageSensitiveWords"],
  ["Account transfer", "/MKJ/admin/account-transfer/", "admin:transferAccount"],
  ["Task publishing", "/MKJ/admin/tasks/", "task-admin:access"],
];

export function renderNav(container, capabilities = []) {
  if (!container) return;
  container.replaceChildren();
  navigation.filter(([, , capability]) => capabilities.includes(capability)).forEach(([label, href]) => {
    const link = element("a", "admin-nav-link", label);
    link.href = href;
    if (window.location.pathname.replace(/index\.html$/, "") === href.replace(/index\.html$/, "")) link.setAttribute("aria-current", "page");
    container.append(link);
  });
}

export function renderLoading(container, label = "Loading") {
  if (!container) return;
  container.replaceChildren(element("p", "admin-loading", label));
}

export function renderRows(container, columns, rows = []) {
  if (!container) return;
  container.replaceChildren();
  if (!rows.length) { container.append(element("p", "admin-empty", "No records to show.")); return; }
  const table = element("table", "admin-table");
  const head = element("thead");
  const headRow = element("tr");
  columns.forEach((column) => headRow.append(element("th", "", column.label)));
  head.append(headRow);
  const body = element("tbody");
  rows.forEach((row) => {
    const tr = element("tr");
    columns.forEach((column) => {
      const cell = element("td");
      const value = typeof column.value === "function" ? column.value(row) : row[column.value];
      if (value instanceof Node) cell.append(value); else cell.textContent = value ?? "-";
      tr.append(cell);
    });
    body.append(tr);
  });
  table.append(head, body);
  container.append(table);
}

export function formatTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
