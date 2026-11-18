import AsyncStorage from "@react-native-async-storage/async-storage";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { CatalogService } from "./CatalogService";
import { OpenLibrarySource, WikidataGenres } from "./catalogSources";

/**
 * Composição do catálogo de metadados (fase 1, 18/11/2026). Fontes abertas, sem Google; só a busca digitada ou o ISBN saem do
 * aparelho. Ainda sem tela: a ficha do livro e a busca chegam na fase 2, depois da aprovação do texto de privacidade.
 */
const request = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => fetch(url, init);
export const catalog = new CatalogService([new OpenLibrarySource(request)], AsyncStorage, libraryAccountScope);
export const catalogGenres = new WikidataGenres(request);
