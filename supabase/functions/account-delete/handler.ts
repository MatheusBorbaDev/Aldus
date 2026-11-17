// Server-only account deletion (owner's request, 17/11/2026; Google Play and LGPD). Runs with the service role that exists only inside
// the Edge Function environment: confirms the caller's session, refuses administration accounts, removes every private book file
// of the account through the Storage API (an SQL row delete would orphan the stored file), verifies nothing is left, then deletes the
// Auth user; the account's rows go with it by cascade. Never logs personal data and never returns it.
type Env = (name: string) => string | undefined;
type ClientFactory = (url: string, key: string, options: { auth: { persistSession: boolean; autoRefreshToken: boolean } }) => any;

export const ACCOUNT_DELETE_CONFIRMATION = "EXCLUIR MINHA CONTA";
export const PRIVATE_LIBRARY_BUCKET = "aldus-private-library";
const headers = {
  "content-type": "application/json", "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS", "cache-control": "no-store", "x-content-type-options": "nosniff",
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, error: string) => reply(status, { error });
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const MAX_FILES = 50000;

async function readConfirmation(request: Request): Promise<string> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("body");
  const text = await request.text();
  if (text.length > 1024) throw new Error("body");
  const body = JSON.parse(text) as { confirmation?: unknown };
  return typeof body.confirmation === "string" ? body.confirmation.trim().toUpperCase() : "";
}

/** Every file path under the account folder (`<uid>/<book>/<hash>.<ext>`), walking folders page by page. */
export async function listAccountFiles(storage: any, userId: string): Promise<string[]> {
  const files: string[] = [], folders = [userId];
  while (folders.length) {
    const folder = folders.shift() as string;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(folder, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error("list");
      for (const entry of data ?? []) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null || entry.id === undefined) folders.push(path); else files.push(path);
        if (files.length > MAX_FILES) throw new Error("too-many");
      }
      if (!data || data.length < 1000) break;
    }
  }
  return files;
}

export function createAccountDeleteHandler(createClient: ClientFactory, env: Env) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return fail(405, "method");
    const url = env("SUPABASE_URL"), serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return fail(503, "unavailable");
    const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) return fail(401, "session");
    let confirmation: string;
    try { confirmation = await readConfirmation(request); } catch { return fail(400, "body"); }
    if (confirmation !== ACCOUNT_DELETE_CONFIRMATION) return fail(400, "confirmation");

    const admin = createClient(url, serviceKey, options);
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    const userId = auth?.user?.id;
    if (authError || typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) return fail(401, "session");

    const { data: member, error: memberError } = await admin.from("aldus_admin_members").select("user_id").eq("user_id", userId).maybeSingle();
    if (memberError) return fail(503, "unavailable");
    if (member) return fail(409, "admin");

    const storage = admin.storage.from(PRIVATE_LIBRARY_BUCKET);
    try {
      const files = await listAccountFiles(storage, userId);
      for (let index = 0; index < files.length; index += 100) {
        const { error } = await storage.remove(files.slice(index, index + 100));
        if (error) throw new Error("remove");
      }
      if ((await listAccountFiles(storage, userId)).length) throw new Error("left");
    } catch { return fail(503, "files"); }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) return fail(503, "delete");
    return reply(200, { deleted: true });
  };
}
