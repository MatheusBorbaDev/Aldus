import type { LiteraryProfile, Privacy, ReadingGoal } from "./models";

/**
 * Grafo social da Community (Etapa 2). O servidor é a autoridade: quem vê o quê, quem segue quem, bloqueios e denúncias
 * são decididos pelas regras do banco; aqui ficam os tipos, a validação do que o servidor devolve e os textos.
 * Sem contagem de seguidores, ranking ou comparação entre leitores.
 */
export type ReaderRelation = "self" | "none" | "pending" | "following";
export type FollowStatus = "pending" | "accepted";
export type FollowListKind = "following" | "followers" | "requests" | "sent";
export const reportReasons = ["spam", "harassment", "impersonation", "illegal_content", "other"] as const;
export type ReportReason = (typeof reportReasons)[number];
export const reportReasonLabels: Record<ReportReason, string> = {
  spam: "Spam ou propaganda", harassment: "Assédio ou ofensa", impersonation: "Finge ser outra pessoa",
  illegal_content: "Conteúdo ilegal", other: "Outro motivo",
};

export interface ReaderCard { userId: string; username: string; displayName: string | null; avatar: string | null; privacy: Privacy | null }
export interface ReaderLookup extends ReaderCard { relation: ReaderRelation; followsMe: boolean }
export interface FollowEntry extends ReaderCard { status: FollowStatus; createdAt: number }
export interface BlockedReader { userId: string; username: string; createdAt: number }
/** O que fica visível para outros leitores. Nunca inclui biblioteca, progresso, sessões ou atividade local. */
export interface PublishedProfile {
  userId: string; username: string; displayName: string; avatar: string | null; bio: string;
  favoriteGenres: string[]; favoriteAuthors: string[]; favoriteBooks: string[];
  readingGoal: ReadingGoal | null; privacy: Privacy; updatedAt: number;
}

export type SocialErrorKind = "unavailable" | "session" | "network" | "contract" | "account" | "target" | "limit" | "query" | "private";
const socialMessages: Record<SocialErrorKind, string> = {
  unavailable: "A rede de leitores ainda não está disponível no servidor.",
  session: "Entre novamente na sua conta para usar a rede de leitores.",
  network: "Não foi possível falar com o servidor. Confira a conexão e tente de novo.",
  contract: "O servidor respondeu de um jeito inesperado. Nada foi alterado.",
  account: "Sua conta precisa de um nome de usuário ativo para usar a rede de leitores.",
  target: "Este leitor não está disponível.",
  limit: "Limite atingido. Tente de novo mais tarde.",
  query: "Digite de 2 a 40 caracteres para buscar.",
  private: "Um perfil privado não pode ser publicado. Escolha Público ou Seguidores em Editar perfil.",
};
export class SocialError extends Error {
  constructor(readonly kind: SocialErrorKind) { super(socialMessages[kind]); this.name = "SocialError"; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-z][a-z0-9_]{2,23}$/;
const privacies: Privacy[] = ["PUBLIC", "FOLLOWERS", "PRIVATE"];
const fail = (): never => { throw new SocialError("contract"); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const uuid = (value: unknown): string => typeof value === "string" && UUID.test(value) ? value : fail();
const username = (value: unknown): string => typeof value === "string" && USERNAME.test(value) ? value : fail();
const optionalText = (value: unknown, max: number): string | null => value == null ? null : typeof value === "string" && value.length <= max ? value : fail();
const avatar = (value: unknown): string | null => { const text = optionalText(value, 2048); return text && /^https:\/\//i.test(text) ? text : null; };
const privacy = (value: unknown): Privacy => privacies.includes(value as Privacy) ? value as Privacy : fail();
const time = (value: unknown): number => { const parsed = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : fail(); };
const list = (value: unknown): string[] => Array.isArray(value) && value.length <= 20 && value.every(item => typeof item === "string" && item.length <= 160) ? value as string[] : fail();
export const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : fail();

export function parseReaderCard(value: unknown): ReaderCard {
  const row = object(value);
  return { userId: uuid(row.user_id), username: username(row.username), displayName: optionalText(row.display_name, 80), avatar: avatar(row.avatar_url),
    privacy: row.privacy == null ? null : privacy(row.privacy) };
}
export function parseReaderLookup(value: unknown): ReaderLookup {
  const row = object(value), relation = row.relation;
  if (!["self", "none", "pending", "following"].includes(relation as string) || typeof row.follows_me !== "boolean") fail();
  return { ...parseReaderCard(row), relation: relation as ReaderRelation, followsMe: row.follows_me as boolean };
}
export function parseFollowEntry(value: unknown): FollowEntry {
  const row = object(value);
  if (row.status !== "pending" && row.status !== "accepted") fail();
  return { ...parseReaderCard({ ...row, privacy: null }), status: row.status as FollowStatus, createdAt: time(row.created_at) };
}
export function parseBlockedReader(value: unknown): BlockedReader {
  const row = object(value);
  return { userId: uuid(row.user_id), username: username(row.username), createdAt: time(row.created_at) };
}
export function parseFollowStatus(value: unknown): FollowStatus {
  return value === "pending" || value === "accepted" ? value : fail();
}
export function parsePublishedProfile(value: unknown): PublishedProfile {
  const row = object(value);
  const goalYear = row.goal_year, goalBooks = row.goal_books;
  if ((goalYear == null) !== (goalBooks == null) || (goalYear != null && (!Number.isInteger(goalYear) || !Number.isInteger(goalBooks)))) fail();
  const displayName = optionalText(row.display_name, 80), bio = optionalText(row.bio, 600);
  if (!displayName || bio === null) fail();
  return { userId: uuid(row.user_id), username: username(row.username), displayName: displayName!, avatar: avatar(row.avatar_url), bio: bio!,
    favoriteGenres: list(row.favorite_genres), favoriteAuthors: list(row.favorite_authors), favoriteBooks: list(row.favorite_books),
    readingGoal: goalYear == null ? null : { year: goalYear as number, books: goalBooks as number }, privacy: privacy(row.privacy), updatedAt: time(row.updated_at) };
}

/** Linha enviada ao publicar. Só campos do perfil literário; @usuario e avatar são sobrescritos pela conta no servidor. */
export function publishedProfileRow(profile: LiteraryProfile) {
  if (profile.privacy === "PRIVATE") throw new SocialError("private");
  return { user_id: profile.userId, username: profile.username, display_name: profile.displayName, bio: profile.bio,
    favorite_genres: profile.favoriteGenres, favorite_authors: profile.favoriteAuthors, favorite_books: profile.favoriteBooks,
    goal_year: profile.readingGoal?.year ?? null, goal_books: profile.readingGoal?.books ?? null,
    privacy: profile.privacy, activity_privacy: profile.activityPrivacy };
}

/** true quando o perfil publicado difere do salvo no aparelho (para oferecer "Atualizar publicação"). */
export function publicationOutdated(local: LiteraryProfile, remote: PublishedProfile): boolean {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);
  return local.displayName !== remote.displayName || local.bio !== remote.bio || local.privacy !== remote.privacy
    || !same(local.favoriteGenres, remote.favoriteGenres) || !same(local.favoriteAuthors, remote.favoriteAuthors) || !same(local.favoriteBooks, remote.favoriteBooks)
    || (local.readingGoal?.year ?? null) !== (remote.readingGoal?.year ?? null) || (local.readingGoal?.books ?? null) !== (remote.readingGoal?.books ?? null);
}

export function normalizeUsernameQuery(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

/** Texto e ação do botão principal diante de um leitor. */
export function relationAction(lookup: Pick<ReaderLookup, "relation" | "privacy">): { label: string; action: "follow" | "unfollow" | null } {
  if (lookup.relation === "self") return { label: "Este é o seu perfil", action: null };
  if (lookup.relation === "following") return { label: "Deixar de seguir", action: "unfollow" };
  if (lookup.relation === "pending") return { label: "Cancelar pedido para seguir", action: "unfollow" };
  return { label: lookup.privacy === "FOLLOWERS" ? "Pedir para seguir" : "Seguir", action: "follow" };
}

export interface CommunitySocialGateway {
  /** Perfil publicado da própria conta, ou null se não está na rede. */
  ownPublication(): Promise<PublishedProfile | null>;
  publish(profile: LiteraryProfile): Promise<PublishedProfile>;
  unpublish(): Promise<void>;
  findReader(username: string): Promise<ReaderLookup | null>;
  searchReaders(query: string): Promise<ReaderCard[]>;
  /** Perfil completo de outro leitor, se as regras do servidor permitirem; senão null. */
  readProfile(userId: string): Promise<PublishedProfile | null>;
  follow(userId: string): Promise<FollowStatus>;
  unfollow(userId: string): Promise<void>;
  respondFollow(followerId: string, accept: boolean): Promise<void>;
  removeFollower(followerId: string): Promise<void>;
  listFollows(kind: FollowListKind): Promise<FollowEntry[]>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  listBlocked(): Promise<BlockedReader[]>;
  report(userId: string, reason: ReportReason, details: string): Promise<void>;
}
