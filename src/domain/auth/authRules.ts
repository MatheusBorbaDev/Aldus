export type FeatureKey = "flashcards";
export type AccountRole = "master" | "user";
export type AccountStatus = "active" | "disabled";

export interface AccountProfile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  role: AccountRole;
  account_status: AccountStatus;
}

export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * 25/11/2026 (captura do dono: "matheus teste" recusado no cadastro): enquanto a pessoa digita, o campo já mostra o formato aceito.
 * Espaço e hífen viram "_", acentos e maiúsculas somem, "@" inicial sai. Não inventa nada além disso; o resto a validação explica.
 */
export function usernameAsTyped(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^@+/, "").replace(/[\s-]+/g, "_").slice(0, 24);
}

export function validUsername(input: string): boolean {
  return /^[a-z][a-z0-9_]{2,23}$/.test(normalizeUsername(input));
}

export function canUseFeature(profile: AccountProfile | null, overrides: FeatureOverrides, feature: FeatureKey): boolean {
  if (!profile || profile.account_status !== "active" || !profile.username) return false;
  if (profile.role === "master") return true;
  return overrides[feature] !== false;
}

export type SignupField = "name" | "username" | "email" | "password" | "confirmation";
export const USERNAME_RULE = "Nome de usuário: use 3 a 24 caracteres (letras, números ou _), começando por uma letra.";

/** Cadastro: cada problema preso ao seu campo, com o nome do campo na mensagem (25/11/2026). Mesmas regras de `registerAccount`. */
export function signupFieldErrors(input: { name: string; username: string; email: string; password: string; confirmation: string }): Partial<Record<SignupField, string>> {
  const problems: Partial<Record<SignupField, string>> = {};
  if (!input.name.trim()) problems.name = "Informe seu nome.";
  if (!validUsername(input.username)) problems.username = USERNAME_RULE;
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) problems.email = "Email: informe um endereço válido, como nome@exemplo.com.";
  if (input.password.length < 8) problems.password = "Senha: use pelo menos 8 caracteres.";
  else if (input.password !== input.confirmation) problems.confirmation = "Confirmar senha: as duas senhas não são iguais.";
  return problems;
}
