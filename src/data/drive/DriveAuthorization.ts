import { throwIfAborted, withAbort } from "@/src/core/utils/cancellation";
import { DriveError } from "./DriveErrors";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export interface DriveGrant { accessToken: string; expiresAt: number; }
/** silent: never show a Google screen; reject as `disconnected` when the person must confirm. reconnect: a known source (Web skips the account picker). */
export interface DriveAuthorizeOptions { silent?: boolean; reconnect?: boolean; }
/** Runs before a grant is kept; throwing discards the token (e.g. it belongs to another Google account). */
export type DriveGrantCheck = (accessToken: string, signal?: AbortSignal) => Promise<void>;
export interface DriveAuthorizationProvider {
  /** Native cache clearing must finish first; Web must preserve its click gesture. */
  clearBeforeAuthorize?: boolean;
  prepare(): Promise<void>;
  authorize(signal?: AbortSignal, correlationId?: string, options?: DriveAuthorizeOptions): Promise<DriveGrant>;
  clearToken?(token: string): Promise<void>;
  revoke(token: string): Promise<void>;
}
/** Credentials never enter source records, search results, AsyncStorage or logs. */
export class DriveAuthorization {
  private readonly grants = new Map<string, DriveGrant>();
  private readonly generations = new Map<string, number>();
  private readonly renewals = new Map<string, Promise<void>>();
  constructor(private readonly provider: DriveAuthorizationProvider) {}
  prepare() { return this.provider.prepare(); }
  async connect(sourceId: string, signal?: AbortSignal, correlationId?: string, options: DriveAuthorizeOptions & { check?: DriveGrantCheck } = {}): Promise<void> {
    const generation = (this.generations.get(sourceId) ?? 0) + 1;
    this.generations.set(sourceId, generation);
    const previous = this.grants.get(sourceId);
    this.grants.delete(sourceId);
    if (previous) {
      const clearing = this.provider.clearToken?.(previous.accessToken).catch(() => undefined);
      if (this.provider.clearBeforeAuthorize && clearing) await withAbort(clearing, signal);
    }
    throwIfAborted(signal);
    if (this.generations.get(sourceId) !== generation) throw new DriveError("disconnected");
    const grant = await withAbort(this.provider.authorize(signal, correlationId, { silent: options.silent, reconnect: options.reconnect }), signal);
    throwIfAborted(signal);
    if (this.generations.get(sourceId) !== generation) throw new DriveError("disconnected");
    if (!grant.accessToken || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now()) throw new DriveError("expired");
    if (options.check) {
      try { await withAbort(options.check(grant.accessToken, signal), signal); throwIfAborted(signal); }
      catch (error) { void this.provider.clearToken?.(grant.accessToken).catch(() => undefined); throw error; }
      if (this.generations.get(sourceId) !== generation) { void this.provider.clearToken?.(grant.accessToken).catch(() => undefined); throw new DriveError("disconnected"); }
    }
    this.grants.set(sourceId, grant);
  }
  token(sourceId: string): string {
    const grant = this.grants.get(sourceId);
    if (!grant) throw new DriveError("disconnected");
    if (grant.expiresAt <= Date.now() + 30000) { this.invalidate(sourceId); throw new DriveError("expired"); }
    return grant.accessToken;
  }
  /**
   * Silent renewal for a source the person already authorized: no Google screen, one request per source at a time.
   * Callers waiting on the same renewal share it; aborting one caller does not cancel it for the others.
   */
  async renew(sourceId: string, check: DriveGrantCheck, signal?: AbortSignal): Promise<void> {
    if (this.connected(sourceId)) return;
    let renewal = this.renewals.get(sourceId);
    if (!renewal) {
      renewal = this.connect(sourceId, undefined, undefined, { silent: true, check }).finally(() => { if (this.renewals.get(sourceId) === renewal) this.renewals.delete(sourceId); });
      this.renewals.set(sourceId, renewal);
    }
    await withAbort(renewal, signal);
  }
  connected(sourceId: string): boolean { try { this.token(sourceId); return true; } catch { return false; } }
  clearSession(): void {
    // Includes authorize calls still pending, not only completed grants.
    for (const sourceId of new Set([...this.generations.keys(), ...this.grants.keys()])) this.invalidate(sourceId);
  }
  invalidate(sourceId: string): void {
    const grant = this.grants.get(sourceId);
    this.grants.delete(sourceId);
    this.generations.set(sourceId, (this.generations.get(sourceId) ?? 0) + 1);
    if (grant) void this.provider.clearToken?.(grant.accessToken).catch(() => undefined);
  }
  async disconnect(sourceId: string): Promise<boolean> {
    const grant = this.grants.get(sourceId);
    this.invalidate(sourceId);
    if (!grant) return false;
    try { await this.provider.revoke(grant.accessToken); return true; } catch { return false; }
  }
}
