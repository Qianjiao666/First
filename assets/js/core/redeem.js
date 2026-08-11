export function normalizeRedeemCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

export async function redeemCode(client, value) {
  const code = normalizeRedeemCode(value);
  if (!code) throw new Error("Redeem code is required");

  const { data, error } = await client.functions.invoke("redeem", {
    body: { code },
  });
  if (error) throw error;
  return data ?? {};
}
