import { DriveError } from "./DriveErrors";
export interface DriveFolder { folderId: string; resourceKey?: string; }
export function parseDriveFolder(input: string): DriveFolder {
  const text = input.trim();
  // IDs are opaque; reject obvious prose and injection without assuming Google's length.
  if (/^[\w-]{10,200}$/.test(text)) return { folderId: text };
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.username || url.password || url.port) throw new Error();
    const match = url.pathname.match(/^\/(?:drive\/(?:u\/\d+\/)?)?folders\/([\w-]+)\/?$/);
    const id = match?.[1] ?? (/^\/(?:open|folderview)\/?$/.test(url.pathname) ? url.searchParams.get("id") : null);
    if (!id || !/^[\w-]{10,200}$/.test(id)) throw new Error();
    const key = url.searchParams.get("resourcekey") ?? undefined;
    if (key && !/^[\w-]{1,200}$/.test(key)) throw new Error();
    return { folderId: id, resourceKey: key };
  } catch { throw new DriveError("invalid-folder"); }
}
/** Canonical link for a folder chosen in the picker; parseDriveFolder reads it back. */
export function driveFolderLink(folder: DriveFolder): string {
  if (!/^[\w-]{10,200}$/.test(folder.folderId) || (folder.resourceKey && !/^[\w-]{1,200}$/.test(folder.resourceKey))) throw new DriveError("invalid-folder");
  return `https://drive.google.com/drive/folders/${folder.folderId}${folder.resourceKey ? `?resourcekey=${folder.resourceKey}` : ""}`;
}
