import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { createAuthService } from "./auth.ts";

export function createEdgeServices() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase function environment is incomplete");
  }

  const auth = createAuthService({
    url,
    anonKey,
    serviceRoleKey,
    createClient: (clientUrl, key, options) => createClient(clientUrl, key, options),
  });

  return { auth, adminClient: auth.createAdminClient() };
}
