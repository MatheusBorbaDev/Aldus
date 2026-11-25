/**
 * Web pages anyone can open straight from a link (store listing, Google review, a shared privacy link). They open on their own content,
 * without the opening quote and its "Continuar" (19/11/2026: the published privacy policy opened behind the quote). The app keeps
 * the quote on every other screen, as the owner asked on 18/11.
 * 25/11/2026 (owner: "Sim, tirar"): login, sign-up and the other auth pages too, since "Entrar"/"Criar conta" on the site would
 * otherwise stop on the quote before the form. After signing in, the app opens with the quote as usual.
 */
export const PUBLIC_DOCUMENT_ROUTES: readonly string[] = ["legal", "beta", "auth"];

export function opensWithoutQuote(platform: string, firstSegment: string | undefined): boolean {
  return platform === "web" && !!firstSegment && PUBLIC_DOCUMENT_ROUTES.includes(firstSegment);
}
