export type SourceKind = "json" | "opds" | "html" | "bndigital" | "gutenberg" | "webview" | "google-drive";
export interface UserSource {
  /** Local account boundary. Missing/null means device data awaiting explicit adoption. */
  ownerId?: string | null;
  /** Non-secret Drive configuration. id is the persistent sourceId. */
  folderId?: string;
  resourceKey?: string;
  /** Google Drive account the folder was connected with (Drive `about.user.permissionId`, not an e-mail). Lets the app renew
   *  access silently only for that same account; missing means the next renewal needs the person. */
  driveAccountId?: string;
	id: string;
	name: string;
	url: string;
	kind: SourceKind;
	enabled: boolean;
	createdAt: number;
	status?: "active" | "error";
	lastError?: string | null;
	lastCheckedAt?: number | null;
}
