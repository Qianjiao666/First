import { taskMenuDescriptor } from "./admin-menu-descriptors.js";

export function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function showPanel(container, title, body) {
  container.replaceChildren();
  const panel = element("div", "admin-message");
  panel.append(element("h1", "admin-message-title", title), element("p", "admin-message-copy", body));
  container.append(panel);
}

export function renderNav(container, capabilities) {
  const items = [
    { label: "概览", href: "/MKJ/admin/", capability: "admin:access" },
    { label: "论坛管理", href: "/MKJ/admin/forum/", capability: "admin:manageForum" },
    { label: "用户管理", href: "/MKJ/admin/users/", capability: "admin:manageUsers" },
    { label: "礼包码管理", href: "/MKJ/admin/redeem-codes/", capability: "admin:manageRedeemCodes" },
    { label: "敏感词管理", href: "/MKJ/admin/sensitive-words/", capability: "admin:manageSensitiveWords" },
    { label: "账号数据转移", href: "/MKJ/admin/account-transfer/", capability: "admin:transferAccount" },
    taskMenuDescriptor,
  ];
  container.replaceChildren();
  items.filter((item) => capabilities.includes(item.capability)).forEach((item) => {
    const link = element("a", "admin-nav-link", item.label);
    link.href = item.href;
    if (window.location.pathname.replace(/index\.html$/, "") === item.href.replace(/index\.html$/, "")) link.setAttribute("aria-current", "page");
    container.append(link);
  });
}

export function renderRows(container, columns, rows) {
  container.replaceChildren();
  if (!rows.length) {
    container.append(element("p", "admin-empty", "暂无可显示的记录。"));
    return;
  }
  const table = element("table", "admin-table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  columns.forEach((column) => headRow.append(element("th", "", column.label)));
  head.append(headRow);
  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("td");
      const value = typeof column.value === "function" ? column.value(row) : row[column.value];
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value ?? "-";
      tableRow.append(cell);
    });
    body.append(tableRow);
  });
  table.append(head, body);
  container.append(table);
}

export function formatTime(value) {
  if (!value) return "未设置";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未设置" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
