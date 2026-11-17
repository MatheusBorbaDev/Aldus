import type { SupabaseClient } from "@supabase/supabase-js";
import { accountDeleteMessage } from "@/src/domain/account/accountDeletion";

/**
 * Pede a exclusão da conta à função account-delete do servidor (que confirma a sessão, remove os arquivos e o usuário).
 * Resolve só quando o servidor responde que excluiu; qualquer outra resposta vira uma mensagem que diz o que aconteceu.
 */
export async function requestAccountDeletion(client: SupabaseClient, confirmation: string): Promise<void> {
  let result: { data: unknown; error: unknown };
  try {
    result = await client.functions.invoke("account-delete", { body: { confirmation: confirmation.trim().toUpperCase() } });
  } catch {
    throw new Error(accountDeleteMessage("network"));
  }
  const data = result.data as { deleted?: unknown } | null;
  if (!result.error && data?.deleted === true) return;
  let code: string | null = null;
  const context = (result.error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  try { const body = context?.json ? await context.json() as { error?: unknown } : null; code = typeof body?.error === "string" ? body.error : null; } catch { code = null; }
  if (!code && (result.error as { name?: string } | null)?.name === "FunctionsFetchError") code = "network";
  throw new Error(accountDeleteMessage(code));
}
