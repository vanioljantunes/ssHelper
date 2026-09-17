/**
 * Parses a pasted PubMed strategy into arms.
 * Supported shape: groups joined by AND, each group a list of terms joined by OR, with optional
 * parentheses. Terms are kept exactly as written. Anything else is rejected as a whole so a
 * strategy is never imported partially.
 */

export type ParseError =
  | 'empty'
  | 'unbalanced_quotes'
  | 'unbalanced_parentheses'
  | 'not_supported'
  | 'nested_groups'
  | 'mixed_operators'
  | 'missing_term'
  | 'missing_operator';

export type ParseResult = { ok: true; arms: string[][] } | { ok: false; error: ParseError };

type Token =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'op'; value: 'AND' | 'OR' | 'NOT' }
  | { kind: 'term'; value: string };

class ParseFailure extends Error {
  constructor(readonly code: ParseError) {
    super(code);
  }
}

const fail = (code: ParseError): never => {
  throw new ParseFailure(code);
};

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
function splitTopLevel(tokens: Token[]): { pieces: Token[][]; ops: string[] } {
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

function termsOfPiece(piece: Token[]): string[] {
  if (piece.length === 0) return fail('missing_term');
  const only = piece[0];
  if (piece.length === 1 && only?.kind === 'term') return [only.value];
  if (!isWrapped(piece)) return fail('missing_operator');
  const inner = piece.slice(1, -1);
  if (inner.some((token) => token.kind === 'open')) return fail('nested_groups');
  const { pieces, ops } = splitTopLevel(inner);
  if (ops.includes('AND')) return fail('mixed_operators');
  return pieces.map((part) => {
    const term = part[0];
    if (part.length !== 1 || term?.kind !== 'term') return fail('missing_term');
    return term.value;
  });
}

function parseArm(segment: Token[]): string[] {
  if (segment.length === 0) return fail('missing_term');
  const { tokens, stripped } = stripOuter(segment);
  if (tokens.length === 0) return fail('missing_term');
  if (stripped && tokens.some((token) => token.kind === 'open')) return fail('nested_groups');
  const { pieces, ops } = splitTopLevel(tokens);
  if (ops.includes('AND')) return fail('mixed_operators');
  return pieces.flatMap(termsOfPiece);
}

export function parseStrategy(text: string): ParseResult {
  if (text.trim() === '') return { ok: false, error: 'empty' };
  if ((text.split('"').length - 1) % 2 !== 0) return { ok: false, error: 'unbalanced_quotes' };
  try {
    const tokens = tokenize(text);
    if (tokens.some((token) => token.kind === 'op' && token.value === 'NOT')) {
      return { ok: false, error: 'not_supported' };
    }
    let depth = 0;
    for (const token of tokens) {
      if (token.kind === 'open') depth += 1;
      if (token.kind === 'close') depth -= 1;
      if (depth < 0) return { ok: false, error: 'unbalanced_parentheses' };
    }
    if (depth !== 0) return { ok: false, error: 'unbalanced_parentheses' };

    const { tokens: body } = stripOuter(tokens);
    const { pieces, ops } = splitTopLevel(body);
    if (ops.includes('AND') && ops.includes('OR')) return { ok: false, error: 'mixed_operators' };
    const arms = ops.includes('AND') ? pieces.map(parseArm) : [parseArm(body)];
    return { ok: true, arms };
  } catch (error) {
    if (error instanceof ParseFailure) return { ok: false, error: error.code };
    throw error;
  }
}
