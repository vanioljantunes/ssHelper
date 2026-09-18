/** Something shaped like name@domain.tld, without spaces. Surrounding spaces are ignored. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether a contact email has a simple valid shape (FR-025). This only guards against typos;
 * PubMed and Crossref do not verify the address.
 */
export function isValidContactEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}
