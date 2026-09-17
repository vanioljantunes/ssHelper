const PUBMED_SEARCH = 'https://pubmed.ncbi.nlm.nih.gov/?term=';

/** PubMed website URL that opens a search results page for the exact query. */
export function pubmedSearchUrl(query: string): string {
  return PUBMED_SEARCH + encodeURIComponent(query);
}
