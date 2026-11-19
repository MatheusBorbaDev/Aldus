import { useEffect, useMemo } from "react";
import { router } from "expo-router";
import { useSourceStore } from "@/src/presentation/stores/sourceStore";
import { sourceCapabilities } from "@/src/domain/types/sourceCatalog";
import type { UserSource } from "@/src/domain/types/sources";
import { sourceLibraryTypeLabel, sourceVisibleInAccount, useSourceAccountId } from "@/src/presentation/components/sourcePresentation";
import { AppText, Button, ListGroup, ListRow, Section } from "@/src/ui";

/**
 * "Suas fontes" no fim da Descobrir (19/11/2026): o Drive e as bibliotecas por link desta conta continuam a um toque, abaixo do
 * catálogo. Só as fontes da conta atual aparecem (Sources ainda são persistidas por dispositivo, BUG 12).
 */
export function YourSources() {
  const sources = useSourceStore(state => state.sources);
  const loadSources = useSourceStore(state => state.load);
  const accountId = useSourceAccountId();
  const accountSources = useMemo(() => sources.filter(source => sourceVisibleInAccount(source, accountId)), [sources, accountId]);
  useEffect(() => { void loadSources(); }, [loadSources]);
  const open = (source: UserSource) => {
    if (sourceCapabilities(source).supportsCatalog) router.push({ pathname: "/sources/[sourceId]", params: { sourceId: source.id } } as never);
    else router.push("/sources" as never);
  };
  return (
    <Section title="Suas fontes" action={<Button label="Adicionar fonte" icon="add" variant="ghost" onPress={() => router.push("/sources?add=1" as never)} />}>
      {accountSources.length ? (
        <ListGroup>
          {accountSources.map(source => (
            <ListRow
              key={source.id}
              title={source.name}
              description={source.enabled ? sourceLibraryTypeLabel(source.kind) : `${sourceLibraryTypeLabel(source.kind)} · desativada`}
              icon={source.kind === "google-drive" ? "logo-google" : source.kind === "json" ? "link-outline" : "library-outline"}
              onPress={() => open(source)}
            />
          ))}
        </ListGroup>
      ) : (
        <AppText variant="bodySmall" tone="secondary">Conecte o Google Drive ou adicione uma biblioteca por link para abrir seus arquivos por aqui.</AppText>
      )}
      <Button label="Gerenciar fontes" variant="ghost" trailingIcon="chevron-forward" onPress={() => router.push("/sources" as never)} />
    </Section>
  );
}
