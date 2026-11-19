/**
 * Library search with nothing on the shelf (19/11/2026, owner: "a biblioteca como catálogo não ta funcionando"): the same words can be
 * searched in the catalog. Returns the text to send to the catalog screen, or null when there is nothing worth searching there.
 * Same limits as the catalog screen: at least 2 characters, at most 200.
 */
export function libraryCatalogQuery(query: string): string | null {
  const text = query.replace(/\s+/g, " ").trim().slice(0, 200).trim();
  return text.length >= 2 ? text : null;
}
