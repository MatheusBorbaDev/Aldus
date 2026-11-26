import { GoogleDriveService } from "./GoogleDriveService";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
/** Drive pelo link público: sem conta Google conectada (26/11/2026). A chave do app vem de `EXPO_PUBLIC_GOOGLE_DRIVE_API_KEY`. */
export const googleDrive = new GoogleDriveService();
// A troca de conta do Aldus descarta os índices da sessão anterior.
libraryAccountScope.subscribe(() => googleDrive.clearSession());
