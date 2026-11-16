import { rows, SocialError, type ReportReason } from "./social";

/**
 * Clubes por convite e fóruns (Community Etapa 3). O servidor decide quem vê o quê: clube só para membros, comentário só até
 * o marco de quem lê, bloqueio nos dois sentidos. Aqui ficam os tipos e a validação do que o servidor devolve. Cada pessoa lê a
 * própria cópia do livro; nada aqui envia ou recebe arquivo de livro. Sem contagem de membros, respostas ou curtidas.
 */
export const CLUB_DRM_NOTICE = "Cada pessoa lê a própria cópia do livro. O Aldus não envia nem empresta o arquivo, e livros com DRM de loja podem não abrir no app.";
export type ClubRole = "owner" | "member";
export type ContentKind = "club_comment" | "thread" | "post";
export interface PublicName { userId: string; username: string; displayName: string | null }
export interface ClubSummary { id: string; name: string; bookTitle: string; role: ClubRole; reachedMilestone: number; milestoneCount: number }
export interface ClubMember extends PublicName { role: ClubRole; reachedMilestone: number }
export interface ClubDetail {
  club: { id: string; name: string; description: string; bookTitle: string; milestones: string[]; ownerId: string; inviteCode: string | null };
  me: { role: ClubRole; reachedMilestone: number };
  members: ClubMember[];
}
export interface ClubComment { id: string; milestone: number; body: string; createdAt: number; author: PublicName; mine: boolean }
export interface ThreadSummary { id: string; title: string; containsSpoilers: boolean; createdAt: number; author: PublicName; mine: boolean }
export interface ForumPost { id: string; body: string; containsSpoilers: boolean; createdAt: number; author: PublicName; mine: boolean }
export interface ThreadDetail { thread: ThreadSummary & { body: string }; posts: ForumPost[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (): never => { throw new SocialError("contract"); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const uuid = (value: unknown): string => typeof value === "string" && UUID.test(value) ? value : fail();
const text = (value: unknown, max: number, min = 0): string => typeof value === "string" && value.length >= min && value.length <= max ? value : fail();
const integer = (value: unknown, max = 1000): number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max ? value as number : fail();
const bool = (value: unknown): boolean => typeof value === "boolean" ? value : fail();
const time = (value: unknown): number => { const parsed = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : fail(); };
const role = (value: unknown): ClubRole => value === "owner" || value === "member" ? value : fail();

export function parsePublicName(value: unknown): PublicName {
  const row = object(value);
  return { userId: uuid(row.user_id), username: typeof row.username === "string" && /^[a-z][a-z0-9_]{2,23}$/.test(row.username) ? row.username : fail(),
    displayName: row.display_name == null ? null : text(row.display_name, 80, 1) };
}
export const publicLabel = (name: PublicName) => name.displayName ? `${name.displayName} · @${name.username}` : `@${name.username}`;

export function parseClubSummary(value: unknown): ClubSummary {
  const row = object(value);
  const summary = { id: uuid(row.club_id), name: text(row.name, 80, 2), bookTitle: text(row.book_title, 200, 1), role: role(row.role),
    reachedMilestone: integer(row.reached_milestone, 12), milestoneCount: integer(row.milestone_count, 12) };
  if (summary.reachedMilestone > summary.milestoneCount || summary.milestoneCount < 2) fail();
  return summary;
}
export function parseClubDetail(value: unknown): ClubDetail {
  const root = object(value), club = object(root.club), me = object(root.me);
  const milestones = Array.isArray(club.milestones) && club.milestones.length >= 2 && club.milestones.length <= 12 ? club.milestones.map(item => text(item, 120, 1)) : fail();
  const inviteCode = club.invite_code == null ? null : typeof club.invite_code === "string" && /^[A-Z0-9]{10}$/.test(club.invite_code) ? club.invite_code : fail();
  const detail: ClubDetail = {
    club: { id: uuid(club.id), name: text(club.name, 80, 2), description: text(club.description, 600), bookTitle: text(club.book_title, 200, 1), milestones, ownerId: uuid(club.owner_id), inviteCode },
    me: { role: role(me.role), reachedMilestone: integer(me.reached_milestone, milestones.length) },
    members: rows(root.members).map(item => { const row = object(item); return { ...parsePublicName(row), role: role(row.role), reachedMilestone: integer(row.reached_milestone, milestones.length) }; }),
  };
  if (detail.me.role === "owner" && detail.club.inviteCode === null) fail();
  return detail;
}
export function parseClubComment(value: unknown): ClubComment {
  const row = object(value);
  return { id: uuid(row.id), milestone: integer(row.milestone, 12), body: text(row.body, 2000, 1), createdAt: time(row.created_at), author: parsePublicName(row.author), mine: bool(row.mine) };
}
export function parseThreadSummary(value: unknown): ThreadSummary {
  const row = object(value);
  return { id: uuid(row.id), title: text(row.title, 140, 3), containsSpoilers: bool(row.contains_spoilers), createdAt: time(row.created_at), author: parsePublicName(row.author), mine: bool(row.mine) };
}
export function parseThreadDetail(value: unknown): ThreadDetail {
  const root = object(value), thread = object(root.thread);
  return { thread: { ...parseThreadSummary(thread), body: text(thread.body, 4000, 1) },
    posts: rows(root.posts).map(item => { const row = object(item); return { id: uuid(row.id), body: text(row.body, 4000, 1), containsSpoilers: bool(row.contains_spoilers), createdAt: time(row.created_at), author: parsePublicName(row.author), mine: bool(row.mine) }; }) };
}

/** Marcos digitados um por linha: 2 a 12, até 120 caracteres cada, sem linhas vazias. */
export function parseMilestoneLines(value: string): string[] {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > 12 || lines.some(line => line.length > 120)) throw new SocialError("text");
  return lines;
}
export function normalizeInviteCode(value: string): string { return value.replace(/[\s-]/g, "").toUpperCase(); }

/** Comentários agrupados pelo marco, na ordem dos marcos. */
export function commentsByMilestone(comments: ClubComment[], milestones: string[]): Array<{ milestone: number; label: string; comments: ClubComment[] }> {
  return milestones.map((label, index) => ({ milestone: index + 1, label, comments: comments.filter(comment => comment.milestone === index + 1) })).filter(group => group.comments.length);
}

export interface CommunityClubsGateway {
  createClub(name: string, description: string, bookTitle: string, milestones: string[]): Promise<{ clubId: string; inviteCode: string }>;
  joinClub(inviteCode: string): Promise<string>;
  leaveClub(clubId: string): Promise<void>;
  deleteClub(clubId: string): Promise<void>;
  listMyClubs(): Promise<ClubSummary[]>;
  clubDetail(clubId: string): Promise<ClubDetail>;
  setClubMilestone(clubId: string, milestone: number): Promise<void>;
  addClubComment(clubId: string, milestone: number, body: string): Promise<string>;
  listClubComments(clubId: string): Promise<ClubComment[]>;
  removeClubComment(commentId: string): Promise<void>;
  removeClubMember(clubId: string, userId: string): Promise<void>;
  regenerateInvite(clubId: string): Promise<string>;
  createThread(title: string, body: string, spoilers: boolean): Promise<string>;
  listThreads(query: string): Promise<ThreadSummary[]>;
  threadDetail(threadId: string): Promise<ThreadDetail>;
  addPost(threadId: string, body: string, spoilers: boolean): Promise<string>;
  removeThread(threadId: string): Promise<void>;
  removePost(postId: string): Promise<void>;
  reportContent(kind: ContentKind, id: string, reason: ReportReason, details: string): Promise<void>;
}
