/**
 * The prompt a visitor without a strategy pastes into an AI assistant (Vera Health): one concept
 * per arm, the arms joined by a single AND, synonyms only inside each group. The wording comes
 * from the caller so every visible string stays in the i18n file.
 */
export interface PromptText {
  intro: string;
  /** Sentence for a single concept; `{concept}` is replaced. */
  single: string;
  /** First clause when there are several concepts; `{ordinal}` and `{concept}` are replaced. */
  first: string;
  /** Each later clause; `{ordinal}` and `{concept}` are replaced. */
  next: string;
  /** Word before the last clause. */
  and: string;
  rules: string;
  outro: string;
  /** Ordinal words, one per allowed concept, in order. */
  ordinals: readonly string[];
}

export const MAX_PROMPT_CONCEPTS = 6;

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);

/** Trims a concept and drops double quotes, which would break the quoted wording. */
export function cleanConcept(concept: string): string {
  return concept.replace(/"/g, '').replace(/\s+/g, ' ').trim();
}

/** The `() AND ()` skeleton for `count` groups. */
export function promptStructure(count: number): string {
  return Array.from({ length: count }, () => '()').join(' AND ');
}

/** Builds the prompt, or returns null when no concept has text. Empty boxes are skipped. */
export function buildStrategyPrompt(concepts: readonly string[], text: PromptText): string | null {
  const used = concepts
    .map(cleanConcept)
    .filter((concept) => concept !== '')
    .slice(0, Math.min(MAX_PROMPT_CONCEPTS, text.ordinals.length));
  if (used.length === 0) return null;

  let about: string;
  if (used.length === 1) {
    about = fill(text.single, { concept: used[0] ?? '' });
  } else {
    const clauses = used.map((concept, index) =>
      fill(index === 0 ? text.first : text.next, { ordinal: text.ordinals[index] ?? '', concept }),
    );
    const last = clauses.pop() as string;
    about = `${clauses.join(', ')} ${text.and} ${last}.`;
  }

  return [text.intro, promptStructure(used.length), about + ' ' + text.rules, text.outro].join(
    '\n\n',
  );
}
