const PUBMED_SEARCH = 'https://pubmed.ncbi.nlm.nih.gov/?term=';

/** PubMed website URL that opens a search results page for the exact query. */
export function pubmedSearchUrl(query: string): string {
  return PUBMED_SEARCH + encodeURIComponent(query);
}

/**
 * PubMed search restricted to the DOI field. PubMed opens the article page directly when the
 * DOI matches a single record.
 */
export function pubmedDoiUrl(doi: string): string {
  return pubmedSearchUrl(`"${doi}"[doi]`);
}

/** Publisher landing page through the DOI resolver; slashes stay unescaped. */
export function doiOrgUrl(doi: string): string {
  return 'https://doi.org/' + doi.split('/').map(encodeURIComponent).join('/');
}
