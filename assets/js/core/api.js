export async function invokeFunction(name, payload = {}, method = "POST") {
  if (!window.MKJApp?.invokeFunction) {
    throw new Error("账户服务暂未连接，请稍后重试。");
  }

  return window.MKJApp.invokeFunction(name, payload, method);
}
