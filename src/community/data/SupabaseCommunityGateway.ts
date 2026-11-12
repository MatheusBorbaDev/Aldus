import type { LiteraryProfile } from "../domain/models";
import {
  type BlockedReader, type CommunitySocialGateway, type FollowEntry, type FollowListKind, type FollowStatus, type PublishedProfile, type ReaderCard,
  type ReaderLookup, type ReportReason, type SocialErrorKind, SocialError, normalizeUsernameQuery, parseBlockedReader, parseFollowEntry, parseFollowStatus,
  parsePublishedProfile, parseReaderCard, parseReaderLookup, publishedProfileRow, reportReasons, rows,
} from "../domain/social";

type RemoteError = { code?: string | null; message?: string | null } | null;
type RemoteResult = { data: unknown; error: RemoteError };
/** Só o que este gateway usa do cliente Supabase; facilita o teste sem rede. */
export interface CommunityRemoteClient {
  auth: { getSession(): Promise<{ data: { session: { user: { id: string } } | null }; error: unknown }> };
  rpc(name: string, params?: Record<string, unknown>): PromiseLike<RemoteResult>;
  from(table: string): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<RemoteResult> } };
    upsert(row: Record<string, unknown>, options: { onConflict: string }): { select(columns: string): { single(): PromiseLike<RemoteResult> } };
    delete(): { eq(column: string, value: string): PromiseLike<RemoteResult> };
  };
}

const UNAVAILABLE = new Set(["PGRST202", "PGRST205", "PGRST204", "42P01", "42883", "3F000"]);
const SESSION = new Set(["PGRST301", "PGRST302", "42501", "401"]);
function errorKind(error: NonNullable<RemoteError>): SocialErrorKind {
  const message = error.message ?? "", code = error.code ?? "";
  const tagged = /community:(account|target|limit|query)/.exec(message);
  if (tagged) return tagged[1] as SocialErrorKind;
  if (/community:/.test(message)) return "contract";
  if (UNAVAILABLE.has(code) || /schema cache|does not exist/i.test(message)) return "unavailable";
  if (SESSION.has(code) || /jwt/i.test(message)) return "session";
  if (!code || /fetch|network/i.test(message)) return "network";
  return "contract";
}

/**
 * Grafo social pelo Supabase. Só dados do perfil literário saem do aparelho, e só quando a pessoa publica. Toda chamada
 * confere que a sessão é da conta para a qual o gateway foi criado; follows, bloqueios e denúncias só passam por RPC.
 */
export class SupabaseCommunityGateway implements CommunitySocialGateway {
  constructor(private readonly client: CommunityRemoteClient | null, private readonly userId: string) {}

  private async ready(): Promise<CommunityRemoteClient> {
    if (!this.client) throw new SocialError("unavailable");
    let result: Awaited<ReturnType<CommunityRemoteClient["auth"]["getSession"]>>;
    try { result = await this.client.auth.getSession(); } catch { throw new SocialError("network"); }
    if (result.error || result.data.session?.user.id !== this.userId) throw new SocialError("session");
    return this.client;
  }
  private async run(operation: (client: CommunityRemoteClient) => PromiseLike<RemoteResult>): Promise<unknown> {
    const client = await this.ready();
    let result: RemoteResult;
    try { result = await operation(client); } catch (error) { throw error instanceof SocialError ? error : new SocialError("network"); }
    if (result.error) throw new SocialError(errorKind(result.error));
    return result.data;
  }
  private rpc(name: string, params?: Record<string, unknown>) { return this.run(client => client.rpc(name, params)); }
  private target(userId: string): string {
    if (!userId || userId === this.userId) throw new SocialError("target");
    return userId;
  }

  async ownPublication(): Promise<PublishedProfile | null> {
    const data = await this.run(client => client.from("community_profiles").select("*").eq("user_id", this.userId).maybeSingle());
    return data == null ? null : parsePublishedProfile(data);
  }
  async publish(profile: LiteraryProfile): Promise<PublishedProfile> {
    if (profile.userId !== this.userId) throw new SocialError("session");
    const row = publishedProfileRow(profile);
    const published = parsePublishedProfile(await this.run(client => client.from("community_profiles").upsert(row, { onConflict: "user_id" }).select("*").single()));
    if (published.userId !== this.userId) throw new SocialError("contract");
    return published;
  }
  async unpublish(): Promise<void> {
    await this.run(client => client.from("community_profiles").delete().eq("user_id", this.userId));
  }
  async findReader(username: string): Promise<ReaderLookup | null> {
    const query = normalizeUsernameQuery(username);
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(query)) throw new SocialError("query");
    const found = rows(await this.rpc("community_find_reader", { p_username: query }));
    return found.length ? parseReaderLookup(found[0]) : null;
  }
  async searchReaders(query: string): Promise<ReaderCard[]> {
    const text = normalizeUsernameQuery(query);
    if (text.length < 2 || text.length > 40) throw new SocialError("query");
    return rows(await this.rpc("community_search_readers", { p_query: text })).map(parseReaderCard).filter(card => card.userId !== this.userId);
  }
  async readProfile(userId: string): Promise<PublishedProfile | null> {
    const data = await this.run(client => client.from("community_profiles").select("*").eq("user_id", this.target(userId)).maybeSingle());
    if (data == null) return null;
    const profile = parsePublishedProfile(data);
    if (profile.userId !== userId) throw new SocialError("contract");
    return profile;
  }
  async follow(userId: string): Promise<FollowStatus> { return parseFollowStatus(await this.rpc("community_follow", { p_target: this.target(userId) })); }
  async unfollow(userId: string): Promise<void> { await this.rpc("community_unfollow", { p_target: this.target(userId) }); }
  async respondFollow(followerId: string, accept: boolean): Promise<void> { await this.rpc("community_respond_follow", { p_follower: this.target(followerId), p_accept: accept }); }
  async removeFollower(followerId: string): Promise<void> { await this.rpc("community_remove_follower", { p_follower: this.target(followerId) }); }
  async listFollows(kind: FollowListKind): Promise<FollowEntry[]> {
    return rows(await this.rpc("community_list_follows", { p_kind: kind })).map(parseFollowEntry).filter(entry => entry.userId !== this.userId);
  }
  async block(userId: string): Promise<void> { await this.rpc("community_block", { p_target: this.target(userId) }); }
  async unblock(userId: string): Promise<void> { await this.rpc("community_unblock", { p_target: this.target(userId) }); }
  async listBlocked(): Promise<BlockedReader[]> { return rows(await this.rpc("community_list_blocked")).map(parseBlockedReader); }
  async report(userId: string, reason: ReportReason, details: string): Promise<void> {
    const text = details.trim();
    if (!reportReasons.includes(reason) || text.length > 1000) throw new SocialError("contract");
    await this.rpc("community_report", { p_target: this.target(userId), p_reason: reason, p_details: text });
  }
}
