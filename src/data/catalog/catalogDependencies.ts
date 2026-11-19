import AsyncStorage from "@react-native-async-storage/async-storage";
import { libraryAccountScope } from "@/src/data/library/LibraryAccountScope";
import { CatalogService } from "./CatalogService";
import { GoogleBooksSource, MetadataSource, OpenLibrarySource, WikidataGenres } from "./catalogSources";

/**
 * Composição do catálogo de metadados. Desde 19/11/2026 (dono: "Google Books + Open Library") o Google Books vem primeiro, pelas
 * edições brasileiras, quando o app tem a chave pública `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`; sem ela, só o Open Library. Só a busca
 * digitada, a categoria ou o ISBN saem do aparelho.
 */
const request = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => fetch(url, init);
const googleBooksKey = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY?.trim();
const sources: MetadataSource[] = [...(googleBooksKey ? [new GoogleBooksSource(request, googleBooksKey)] : []), new OpenLibrarySource(request)];
export const catalog = new CatalogService(sources, AsyncStorage, libraryAccountScope);
/** Nomes das fontes ativas, para a legenda da tela ("Google Books e Open Library" ou só "Open Library"). */
export const catalogSourcesLabel = googleBooksKey ? "Google Books e Open Library" : "Open Library";
export const catalogGenres = new WikidataGenres(request);
