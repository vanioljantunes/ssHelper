import { splitTag } from './term';

/** The databases a PubMed strategy can be rewritten for. */
export type TargetDatabase = 'cochrane' | 'embase';

export const TARGET_DATABASES = ['cochrane', 'embase'] as const;

export interface Translation {
  /** The rewritten strategy, or null when every arm is empty. */
  query: string | null;
  /** Field tags that have no counterpart and were left out, in the order they first appeared. */
  droppedTags: string[];
  /**
   * Subject headings the rewrite carried over from MeSH. MeSH and Emtree are different
   * thesauri, so each heading needs checking in the target database (constitution V).
   */
  headings: string[];
  /** Terms with a wildcard: truncation rules are not the same in every database. */
  wildcards: string[];
}

/**
 * What each PubMed field tag becomes. A `field` mapping is the suffix the database appends to
 * the words; `heading` means the term is a subject heading and gets the exploded form.
 */
type Mapping = { kind: 'field'; cochrane: string; embase: string } | { kind: 'heading' };

const MAPPINGS: Record<string, Mapping> = {
  tiab: { kind: 'field', cochrane: ':ti,ab,kw', embase: ':ti,ab' },
  tw: { kind: 'field', cochrane: ':ti,ab,kw', embase: ':ti,ab,kw' },
  ti: { kind: 'field', cochrane: ':ti', embase: ':ti' },
  title: { kind: 'field', cochrane: ':ti', embase: ':ti' },
  ab: { kind: 'field', cochrane: ':ab', embase: ':ab' },
  mesh: { kind: 'heading' },
  mh: { kind: 'heading' },
  majr: { kind: 'heading' },
};

function isWrappedIn(text: string, quote: string): boolean {
  return text.length >= 2 && text.startsWith(quote) && text.endsWith(quote);
}

/** The words of the term without the quotes that hold them together. */
function bareWords(body: string): string {
  if (isWrappedIn(body, '"') || isWrappedIn(body, "'")) return body.slice(1, -1);
  return body;
}

/** Quotes the words whether or not they are a phrase, as a subject heading needs. */
function quoteAlways(words: string, database: TargetDatabase): string {
  if (database === 'cochrane') return `"${words}"`;
  // Embase accepts either quote; double quotes keep an apostrophe inside the phrase intact.
  return words.includes("'") ? `"${words}"` : `'${words}'`;
}

/** Quotes a phrase the way `database` expects; a single word is left as typed. */
function quotePhrase(words: string, database: TargetDatabase): string {
  return words.includes(' ') ? quoteAlways(words, database) : words;
}

/** The tag name without its brackets or case, or '' when the term carries no tag. */
function tagName(tag: string): string {
  return tag
    .replace(/^\[|\]$/g, '')
    .trim()
    .toLowerCase();
}

/**
 * One PubMed term rewritten for `database`. A tag with no counterpart is left out and the words
 * are kept, so the term still searches, as free text.
 */
export function translateTerm(text: string, database: TargetDatabase): string {
  const { body, tag } = splitTag(text.trim());
  if (body === '') return text.trim();
  const words = bareWords(body);
  const mapping = MAPPINGS[tagName(tag)];
  if (mapping === undefined) return quotePhrase(words, database);
  if (mapping.kind === 'heading') {
    // Emtree terms are written in lower case; MeSH terms are capitalised.
    return database === 'cochrane'
      ? `[mh ${quoteAlways(words, 'cochrane')}]`
      : `${quoteAlways(words.toLowerCase(), 'embase')}/exp`;
  }
  return quotePhrase(words, database) + mapping[database];
}

/** The field tag of a term that this rewrite cannot carry over, or null when it can. */
function droppedTag(text: string): string | null {
  const { body, tag } = splitTag(text.trim());
  if (body === '' || tag === '') return null;
  return MAPPINGS[tagName(tag)] === undefined ? tag : null;
}

/** The subject heading a term carries, or null when the term is free text. */
function heading(text: string): string | null {
  const { body, tag } = splitTag(text.trim());
  if (body === '') return null;
  return MAPPINGS[tagName(tag)]?.kind === 'heading' ? bareWords(body) : null;
}

function addOnce(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/**
 * The strategy of `arms` rewritten for `database`: terms joined with OR inside each arm, arms
 * joined with AND, in the same shape as the PubMed query.
 */
export function translate(arms: string[][], database: TargetDatabase): Translation {
  const droppedTags: string[] = [];
  const headings: string[] = [];
  const wildcards: string[] = [];
  const parts = arms
    .filter((terms) => terms.length > 0)
    .map((terms) => {
      for (const term of terms) {
        const tag = droppedTag(term);
        if (tag !== null) addOnce(droppedTags, tag);
        const subject = heading(term);
        if (subject !== null) addOnce(headings, subject);
        if (term.includes('*')) addOnce(wildcards, term.trim());
      }
      return `(${terms.map((term) => translateTerm(term, database)).join(' OR ')})`;
    });
  return {
    query: parts.length === 0 ? null : parts.join(' AND '),
    droppedTags,
    headings,
    wildcards,
  };
}
