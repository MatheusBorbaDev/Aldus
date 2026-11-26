export type DriveErrorCode = "disconnected" | "expired" | "cancelled" | "popup-blocked" | "auth-denied" | "api-disabled" | "permission" | "not-found" | "rate-limit" | "network" | "api" | "invalid-folder" | "unsupported" | "configuration" | "busy" | "account-mismatch";
export type DriveErrorCategory = "AUTH_CANCELLED" | "AUTH_REQUIRED" | "AUTH_DENIED" | "TOKEN_EXPIRED" | "DRIVE_API_DISABLED" | "FOLDER_NOT_FOUND" | "FOLDER_FORBIDDEN" | "NETWORK_ERROR" | "RATE_LIMIT" | "INVALID_FOLDER" | "UNKNOWN";
const categories: Record<DriveErrorCode, DriveErrorCategory> = {
  disconnected: "AUTH_REQUIRED", expired: "TOKEN_EXPIRED", cancelled: "AUTH_CANCELLED", "popup-blocked": "AUTH_REQUIRED", "auth-denied": "AUTH_DENIED",
  "api-disabled": "DRIVE_API_DISABLED", permission: "FOLDER_FORBIDDEN", "not-found": "FOLDER_NOT_FOUND",
  "rate-limit": "RATE_LIMIT", network: "NETWORK_ERROR", api: "UNKNOWN", "invalid-folder": "INVALID_FOLDER",
  unsupported: "INVALID_FOLDER", configuration: "UNKNOWN", busy: "UNKNOWN", "account-mismatch": "AUTH_REQUIRED",
};
const messages: Record<DriveErrorCode, string> = {
  disconnected: "Não foi possível ler esta pasta agora. Confira o link e tente atualizar novamente.",
  expired: "O Google recusou a consulta. Tente atualizar novamente em instantes.",
  cancelled: "A operação foi cancelada.",
  "popup-blocked": "Não foi possível concluir a operação. Tente novamente.",
  "auth-denied": "O Google recusou a leitura desta pasta pelo link. No Google Drive, abra o compartilhamento da pasta e escolha “Qualquer pessoa com o link”.",
  "api-disabled": "A leitura do Google Drive está desativada nesta versão do Aldus. Avise o suporte.",
  permission: "A pasta ou o arquivo não está aberto para leitura pelo link. No Google Drive, abra o compartilhamento da pasta e escolha “Qualquer pessoa com o link”.",
  "not-found": "Pasta ou arquivo não encontrado. Confira se o link está completo e se a pasta está compartilhada com “Qualquer pessoa com o link”.",
  "rate-limit": "Limite de consultas do Drive atingido. Aguarde e tente atualizar novamente.",
  network: "Não foi possível contatar o Drive. Confira a rede e tente novamente.",
  api: "Não foi possível concluir a consulta ao Drive. A causa não foi identificada; tente atualizar novamente.",
  "invalid-folder": "Informe um link de pasta válido do Google Drive.",
  unsupported: "O destino não é uma pasta do Google Drive. Use uma pasta real; atalhos para arquivos não são percorridos.",
  configuration: "A leitura do Google Drive não está configurada nesta versão do Aldus. Avise o suporte.",
  busy: "Já existe uma consulta ao Drive em andamento. Aguarde e tente novamente.",
  "account-mismatch": "Não foi possível ler esta pasta agora. Confira o link e tente atualizar novamente.",
};
export class DriveError extends Error {
  readonly category: DriveErrorCategory;
  constructor(public readonly code: DriveErrorCode) { super(messages[code]); this.name = "DriveError"; this.category = categories[code]; }
}
/** Provider bodies are used only for known reason enums; their messages never leave this boundary. */
export function assertDriveResponse(status: number, body?: unknown): void {
  if (status >= 200 && status < 300) return;
  const error = (body as { error?: { errors?: { reason?: unknown }[]; details?: { reason?: unknown }[] } } | null)?.error;
  const reasons = [...(Array.isArray(error?.errors) ? error.errors : []), ...(Array.isArray(error?.details) ? error.details : [])].map(item => item?.reason);
  const disabled = reasons.some(reason => reason === "accessNotConfigured" || reason === "serviceDisabled" || reason === "SERVICE_DISABLED");
  const rateLimit = reasons.some(reason => reason === "rateLimitExceeded" || reason === "userRateLimitExceeded" || reason === "dailyLimitExceeded" || reason === "RATE_LIMIT_EXCEEDED");
  const scope = reasons.some(reason => reason === "insufficientPermissions" || reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT");
  const filePermission = reasons.some(reason => reason === "insufficientFilePermissions");
  throw new DriveError(status === 401 ? "expired" : status === 429 || (status === 403 && rateLimit) ? "rate-limit" : status === 403 && disabled ? "api-disabled" : status === 403 && scope ? "auth-denied" : status === 403 && filePermission ? "permission" : status === 404 ? "not-found" : "api");
}
