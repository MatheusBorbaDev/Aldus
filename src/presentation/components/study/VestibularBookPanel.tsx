import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button } from "@/src/ui";
import { useAppTheme } from "@/src/presentation/contexts/AppThemeContext";
import { appDependencies } from "@/src/presentation/services/dependencies";
import { useDownloadStore } from "@/src/presentation/stores/downloadStore";
import { useLibraryStore } from "@/src/presentation/stores/libraryStore";
import { UserSourceRepository } from "@/src/data/sources/UserSourceRepository";
import { builtinCatalogs, configuredCatalog } from "@/src/data/scraping/catalogPlugins";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { sourceIdentity } from "@/src/domain/types/sourceCatalog";
import type { ScrapedLink } from "@/src/domain/types/search";
import type { UserSource } from "@/src/domain/types/sources";
import { sameWork, VestibularBook, vestibularDownloadQuery } from "@/src/domain/study/vestibularReadings";

/**
 * Livro de uma lista de vestibular aberto na própria tela (25/11/2026, dono: "aparecesse se o livro tem domínio público e está disponível
 * para download... que fosse possível fazer isso tudo direto pelo Aldus"). Primeiro: arquivos gratuitos da mesma obra no Project Gutenberg
 * (domínio público) e nas fontes desta conta (Drive, bibliotecas por link), com "Baixar e adicionar". Depois: a ficha do catálogo
 * (Quero ler, Lendo, Lido). Só sai do aparelho o título e o sobrenome do autor buscados.
 */
type Found = ScrapedLink & { publicDomain: boolean };
const sourceRepository = new UserSourceRepository();
const fileBase = (title: string) => title.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "livro";

export function VestibularBookPanel({ book }: { book: VestibularBook }) {
  const { palette } = useAppTheme();
  const [found, setFound] = useState<Found[] | null>(null), [searchError, setSearchError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [message, setMessage] = useState<{ url: string; text: string; bookId?: string } | null>(null);
  const sources = useRef<UserSource[]>([]);
  const jobs = useDownloadStore(state => state.jobs), enqueue = useDownloadStore(state => state.enqueue);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const account = libraryAccountScope.userId;
        sources.current = (await sourceRepository.list()).filter(source => source.enabled && source.status === "active" && (source.ownerId ?? null) === account);
        const plugins = [...builtinCatalogs(), ...sources.current.map(configuredCatalog)];
        const response = await appDependencies.searchBooks.executeDetailed(vestibularDownloadQuery(book), plugins, {}, controller.signal);
        if (controller.signal.aborted) return;
        const own = new Set(sources.current.map(source => source.id));
        const matches = response.results
          .filter(item => (item.format === "epub" || item.format === "pdf") && sameWork(item, book))
          .map(item => ({ ...item, publicDomain: !item.sourceId || !own.has(item.sourceId) }))
          // Domínio público primeiro, depois EPUB antes de PDF.
          .sort((a, b) => Number(b.publicDomain) - Number(a.publicDomain) || Number(b.format === "epub") - Number(a.format === "epub"))
          .slice(0, 4);
        setFound(matches);
        setSearchError(!matches.length && response.sources.length > 0 && response.sources.every(source => source.status === "error"));
      } catch { if (!controller.signal.aborted) { setFound([]); setSearchError(true); } }
    })();
    return () => controller.abort();
  }, [book]);

  const acquire = async (item: Found) => {
    if (busy) return;
    setBusy(item.url); setMessage(null);
    try {
      const resolved = await appDependencies.searchBooks.resolveAcquisition(item);
      const format = resolved.format === "pdf" ? "pdf" : "epub";
      const source = resolved.sourceId ? sources.current.find(candidate => candidate.id === resolved.sourceId) : undefined;
      await enqueue({
        id: resolved.url, url: resolved.url, fileName: `${fileBase(book.title)}.${format}`, format,
        drive: resolved.drive && resolved.sourceId ? { sourceId: resolved.sourceId, fileId: resolved.drive.fileId } : undefined,
        source: resolved.sourceId ? { sourceId: resolved.sourceId, remoteBookId: resolved.drive?.fileId ?? resolved.remoteBookId ?? resolved.url, sourceIdentity: source ? sourceIdentity(source) : undefined } : undefined,
        status: "queued", progress: 0, localUri: null, error: null, attempts: 0,
      });
      const job = useDownloadStore.getState().jobs[resolved.url];
      if (job?.status === "completed") {
        await useLibraryStore.getState().load();
        setMessage({ url: item.url, text: "Adicionado à sua Biblioteca.", bookId: job.importedBookId });
      } else setMessage({ url: item.url, text: job?.error ?? "Não foi possível baixar agora. Tente de novo." });
    } catch (error) {
      setMessage({ url: item.url, text: error instanceof Error ? error.message : "Não foi possível baixar agora. Tente de novo." });
    } finally { setBusy(null); }
  };

  return (
    <View style={[styles.panel, { borderColor: palette.border }]}>
      {found === null ? <AppText variant="bodySmall" tone="secondary">Procurando arquivo gratuito em domínio público…</AppText> : null}
      {found?.map(item => {
        const job = jobs[item.url], working = busy === item.url || job?.status === "queued" || job?.status === "downloading";
        const done = message?.url === item.url && message.bookId;
        return (
          <View key={item.url} style={[styles.offer, { backgroundColor: palette.accentSoft ?? palette.surface }]}>
            <AppText variant="label">{item.publicDomain ? "Domínio público · disponível para baixar" : "Disponível nas suas fontes"}</AppText>
            <AppText variant="bodySmall" tone="secondary">{item.title}{item.author ? ` · ${item.author}` : ""} · {item.format.toUpperCase()} · {item.sourceSite}</AppText>
            {done
              ? <Button label="Abrir para ler" icon="book-outline" variant="primary" onPress={() => router.push(`/reader/${message!.bookId}` as never)} />
              : <Button label={working ? "Baixando…" : "Baixar e adicionar"} icon="download-outline" variant="primary" disabled={!!busy || working} onPress={() => void acquire(item)} />}
            {message?.url === item.url ? <AppText variant="bodySmall" tone={message.bookId ? "success" : "danger"} accessibilityRole="alert">{message.text}</AppText> : null}
          </View>
        );
      })}
      {found && !found.length ? (
        <AppText variant="bodySmall" tone="secondary">
          {searchError ? "Não foi possível consultar as fontes de domínio público agora." : "Não achamos arquivo gratuito desta obra em domínio público. Ela pode ainda ter direitos autorais."}
        </AppText>
      ) : null}
      <Button label="Ver no catálogo (Quero ler, Lendo, Lido)" icon="albums-outline" variant="ghost"
        onPress={() => router.push({ pathname: "/catalog", params: { q: `${book.title} ${book.author}` } } as never)} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderLeftWidth: 2, marginLeft: 8, paddingLeft: 12, paddingVertical: 6, gap: 8, marginBottom: 6 },
  offer: { borderRadius: 10, padding: 12, gap: 6 },
});
