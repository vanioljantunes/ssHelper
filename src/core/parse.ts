/**
 * Parses a pasted PubMed strategy into arms.
 * Supported shape: groups joined by AND, each group a list of terms joined by OR, with optional
 * parentheses. Every term goes through the commit rule, so a body with a space comes out quoted
 * exactly as it would if it had been typed into a term box. Anything else is rejected as a whole
 * so a strategy is never imported partially.
 *
 * Four kinds of part are dropped instead of rejected (FR-021a), because they lower the
 * sensitivity of a systematic review search or cannot be resolved from the paste: a NOT and the
 * operand after it, methodological filters, date limits, and history line references. Each one
 * comes back as an advisory so the page can name it before the researcher confirms the import.
 */

import { commitTerm, splitTag } from './term';

export type ParseError =
  | 'empty'
  | 'unbalanced_quotes'
  | 'unbalanced_parentheses'
  | 'all_dropped'
  | 'nested_groups'
  | 'mixed_operators'
  | 'missing_term'
  | 'missing_operator';

export type AdvisoryKind = 'not_clause' | 'filter' | 'date_limit' | 'line_reference';

/** One dropped part of the paste, written as it appeared. */
export interface Advisory {
  kind: AdvisoryKind;
  text: string;
}

export type ParseResult =
  { ok: true; arms: string[][]; advisories: Advisory[] } | { ok: false; error: ParseError };

type Token =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'op'; value: 'AND' | 'OR' | 'NOT' }
  | { kind: 'term'; value: string };

type Split = { pieces: Token[][]; ops: string[] };

class ParseFailure extends Error {
  constructor(readonly code: ParseError) {
    super(code);
  }
}

const fail = (code: ParseError): never => {
  throw new ParseFailure(code);
};

/** Field tags that restrict the search by method or record type rather than by topic. */
const FILTER_TAGS = ['lang', 'la', 'pt', 'ptyp', 'sb', 'filter'];
/** Field tags that restrict the search by date. */
const DATE_TAGS = ['dp', 'pdat', 'edat'];
/** Subject headings used as filters rather than as topic terms. */
const MESH_CHECKS = ['humans', 'animals', 'male', 'female'];
const LINE_REFERENCE = /^#\d+$/;
const TAGS_IN_TERM = /\[([^\]]+)\]/g;

function isSpace(char: string): boolean {
  return /\s/.test(char);
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i] ?? '';
    if (isSpace(char)) {
      i += 1;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ kind: char === '(' ? 'open' : 'close' });
      i += 1;
      continue;
    }
    let word = '';
    while (i < text.length) {
      const c = text[i] ?? '';
      if (isSpace(c) || c === '(' || c === ')') break;
      if (c === '"' || c === '[') {
        const end = text.indexOf(c === '"' ? '"' : ']', i + 1);
        if (end === -1) fail(c === '"' ? 'unbalanced_quotes' : 'unbalanced_parentheses');
        word += text.slice(i, end + 1);
        i = end + 1;
        continue;
      }
      word += c;
      i += 1;
    }
    if (word === 'AND' || word === 'OR' || word === 'NOT') {
      tokens.push({ kind: 'op', value: word });
      continue;
    }
    const previous = tokens[tokens.length - 1];
    if (previous?.kind === 'term') {
      // Unquoted multi-word term, kept as written with single spaces.
      previous.value = `${previous.value} ${word}`;
    } else {
      tokens.push({ kind: 'term', value: word });
    }
  }
  return tokens;
}

/** The tokens written back out, so a dropped part can be named as it was pasted. */
function renderTokens(tokens: Token[]): string {
  let out = '';
  for (const token of tokens) {
    const piece =
      token.kind === 'open'
        ? '('
        : token.kind === 'close'
          ? ')'
          : token.kind === 'op'
            ? token.value
            : token.value;
    const joined = out !== '' && !out.endsWith('(') && piece !== ')';
    out += (joined ? ' ' : '') + piece;
  }
  return out;
}

function matchingClose(tokens: Token[], openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token?.kind === 'open') depth += 1;
    if (token?.kind === 'close') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isWrapped(tokens: Token[]): boolean {
  return tokens[0]?.kind === 'open' && matchingClose(tokens, 0) === tokens.length - 1;
}

function stripOuter(tokens: Token[]): { tokens: Token[]; stripped: boolean } {
  let current = tokens;
  let stripped = false;
  while (current.length > 0 && isWrapped(current)) {
    current = current.slice(1, -1);
    stripped = true;
  }
  return { tokens: current, stripped };
}

/** Splits at operators outside parentheses; returns pieces and the operators found. */
function splitTopLevel(tokens: Token[]): Split {
  const pieces: Token[][] = [[]];
  const ops: string[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.kind === 'open') depth += 1;
    if (token.kind === 'close') depth -= 1;
    if (token.kind === 'op' && depth === 0) {
      ops.push(token.value);
      pieces.push([]);
      continue;
    }
    pieces[pieces.length - 1]?.push(token);
  }
  return { pieces, ops };
}

/** The same split with every NOT and the operand after it removed and recorded. */
function splitOutsideNot(tokens: Token[], advisories: Advisory[]): Split {
  const split = splitTopLevel(tokens);
  const pieces: Token[][] = [];
  const ops: string[] = [];
  split.pieces.forEach((piece, index) => {
    if (index > 0) {
      const op = split.ops[index - 1] ?? '';
      if (op === 'NOT') {
        advisories.push({ kind: 'not_clause', text: `NOT ${renderTokens(piece)}` });
        return;
      }
      ops.push(op);
    }
    pieces.push(piece);
  });
  return { pieces, ops };
}

function termsOfPiece(piece: Token[], advisories: Advisory[]): string[] {
  if (piece.length === 0) return fail('missing_term');
  const only = piece[0];
  if (piece.length === 1 && only?.kind === 'term') return [only.value];
  if (!isWrapped(piece)) return fail('missing_operator');
  const inner = piece.slice(1, -1);
  if (inner.some((token) => token.kind === 'open')) return fail('nested_groups');
  const { pieces, ops } = splitOutsideNot(inner, advisories);
  if (ops.includes('AND')) return fail('mixed_operators');
  return pieces.map((part) => {
    const term = part[0];
    if (part.length !== 1 || term?.kind !== 'term') return fail('missing_term');
    return term.value;
  });
}

function armOfSplit(split: Split, advisories: Advisory[]): string[] {
  if (split.ops.includes('AND')) return fail('mixed_operators');
  return split.pieces.flatMap((piece) => termsOfPiece(piece, advisories));
}

function parseArm(segment: Token[], advisories: Advisory[]): string[] {
  if (segment.length === 0) return fail('missing_term');
  const { tokens, stripped } = stripOuter(segment);
  if (tokens.length === 0) return fail('missing_term');
  if (stripped && tokens.some((token) => token.kind === 'open')) return fail('nested_groups');
  return armOfSplit(splitOutsideNot(tokens, advisories), advisories);
}

/** The reason this term is dropped rather than imported, or null when it is a topic term. */
export function advisoryKindOf(text: string): AdvisoryKind | null {
  if (LINE_REFERENCE.test(text)) return 'line_reference';
  const tags = Array.from(text.matchAll(TAGS_IN_TERM)).map((match) =>
    (match[1] ?? '').trim().toLowerCase(),
  );
  if (tags.some((tag) => DATE_TAGS.includes(tag))) return 'date_limit';
  if (tags.some((tag) => FILTER_TAGS.includes(tag))) return 'filter';
  const { body, tag } = splitTag(text);
  const word = body.replace(/^"/, '').replace(/"$/, '').trim().toLowerCase();
  const heading = tag.replace(/[[\]]/g, '').trim().toLowerCase();
  const isHeading = heading === 'mh' || heading.startsWith('mesh');
  if (isHeading && MESH_CHECKS.includes(word)) return 'filter';
  return null;
}

export function parseStrategy(text: string): ParseResult {
  if (text.trim() === '') return { ok: false, error: 'empty' };
  if ((text.split('"').length - 1) % 2 !== 0) return { ok: false, error: 'unbalanced_quotes' };
  const advisories: Advisory[] = [];
  try {
    const tokens = tokenize(text);
    let depth = 0;
    for (const token of tokens) {
      if (token.kind === 'open') depth += 1;
      if (token.kind === 'close') depth -= 1;
      if (depth < 0) return { ok: false, error: 'unbalanced_parentheses' };
    }
    if (depth !== 0) return { ok: false, error: 'unbalanced_parentheses' };

    const { tokens: body } = stripOuter(tokens);
    const split = splitOutsideNot(body, advisories);
    if (split.ops.includes('AND') && split.ops.includes('OR')) {
      return { ok: false, error: 'mixed_operators' };
    }
    const parsed = split.ops.includes('AND')
      ? split.pieces.map((piece) => parseArm(piece, advisories))
      : [armOfSplit(split, advisories)];

    const arms: string[][] = [];
    for (const arm of parsed) {
      const kept: string[] = [];
      for (const raw of arm) {
        const term = commitTerm(raw) ?? raw;
        const kind = advisoryKindOf(term);
        if (kind) {
          advisories.push({ kind, text: term });
          continue;
        }
        kept.push(term);
      }
      if (kept.length > 0) arms.push(kept);
    }
    if (arms.length === 0) return { ok: false, error: 'all_dropped' };
    return { ok: true, arms, advisories };
  } catch (error) {
    if (error instanceof ParseFailure) return { ok: false, error: error.code };
    throw error;
  }
}
