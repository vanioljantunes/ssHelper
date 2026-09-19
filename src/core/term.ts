import type { IssueKind } from './types';

const TRAILING_TAG = /^(.*?)(\[[^\]]+\])$/;

export interface TermParts {
  body: string;
  tag: string;
}

/** Splits a trailing PubMed field tag such as `[tiab]` from the term body. */
export function splitTag(text: string): TermParts {
  const match = TRAILING_TAG.exec(text);
  if (match) {
    return { body: (match[1] ?? '').trim(), tag: match[2] ?? '' };
  }
  return { body: text, tag: '' };
}

function isWrappedInQuotes(body: string): boolean {
  return body.length >= 2 && body.startsWith('"') && body.endsWith('"');
}

/** True when the body of the term (before any field tag) is wrapped in double quotes. */
export function isQuoted(text: string): boolean {
  return isWrappedInQuotes(splitTag(text).body);
}

/**
 * Commit rule (contracts/query-builder.md): trim, quote a body that contains a space, never
 * quote twice. A body that already contains a quotation mark is kept as typed, so quoting the
 * researcher entered is never altered. Returns null for blank input.
 */
export function commitTerm(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return null;
  const { body, tag } = splitTag(text);
  if (body === '') return text;
  if (body.includes('"')) return body + tag;
  if (body.includes(' ')) return `"${body}"${tag}`;
  return body + tag;
}

/** Field tags offered by the + control on each term (FR-027). */
export const FIELD_TAGS = ['[tiab]', '[Mesh]'] as const;

/** Replaces the trailing field tag; an empty tag removes it. Quotes are kept. */
export function withTag(text: string, tag: string): string {
  return splitTag(text).body + tag;
}

/**
 * The words a researcher edits (FR-028): the body without its wrapping quotes and without the
 * field tag. Quotes are never typed by hand; commitTerm puts them back by the space rule.
 */
export function editableBody(text: string): string {
  const { body } = splitTag(text);
  return isWrappedInQuotes(body) ? body.slice(1, -1) : body;
}

/** Removes the wrapping quotes of the body and keeps the tag. */
export function unquoteTerm(text: string): string {
  const { body, tag } = splitTag(text);
  if (!isWrappedInQuotes(body)) return text;
  return body.slice(1, -1) + tag;
}

/** Returns the syntax problem PubMed would silently repair, or null. */
export function validateTerm(text: string): IssueKind | null {
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth < 0) return 'unbalanced_parentheses';
    }
  }
  if (depth !== 0) return 'unbalanced_parentheses';
  const quotes = text.split('"').length - 1;
  if (quotes % 2 !== 0) return 'unbalanced_quotes';
  return null;
}
