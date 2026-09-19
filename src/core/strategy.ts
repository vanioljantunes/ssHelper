import { newId } from './id';
import { commitTerm, unquoteTerm, validateTerm, withTag } from './term';
import type { Arm, Draft, Issue, Strategy } from './types';

export const DEFAULT_ARM_COUNT = 3;

export function createArm(terms: string[] = [], pending = ''): Arm {
  return { id: newId(), terms: terms.map((text) => ({ id: newId(), text })), pending };
}

export function createDefaultStrategy(): Strategy {
  return { arms: Array.from({ length: DEFAULT_ARM_COUNT }, () => createArm()) };
}

function updateArm(strategy: Strategy, armId: string, update: (arm: Arm) => Arm): Strategy {
  return { arms: strategy.arms.map((arm) => (arm.id === armId ? update(arm) : arm)) };
}

export function addArm(strategy: Strategy): Strategy {
  return { arms: [...strategy.arms, createArm()] };
}

/** Removes an arm; at least one arm always remains. */
export function removeArm(strategy: Strategy, armId: string): Strategy {
  const arms = strategy.arms.filter((arm) => arm.id !== armId);
  return { arms: arms.length === 0 ? [createArm()] : arms };
}

export function setPending(strategy: Strategy, armId: string, pending: string): Strategy {
  return updateArm(strategy, armId, (arm) => ({ ...arm, pending }));
}

function commitArm(arm: Arm): Arm {
  const text = commitTerm(arm.pending);
  if (text === null) return arm.pending === '' ? arm : { ...arm, pending: '' };
  return { ...arm, terms: [...arm.terms, { id: newId(), text }], pending: '' };
}

export function commitPending(strategy: Strategy, armId: string): Strategy {
  return updateArm(strategy, armId, commitArm);
}

export function commitAllPending(strategy: Strategy): Strategy {
  return { arms: strategy.arms.map(commitArm) };
}

/** Re-applies the commit rule to an edited term; empty text removes it. */
export function editTerm(strategy: Strategy, armId: string, termId: string, raw: string): Strategy {
  const text = commitTerm(raw);
  if (text === null) return removeTerm(strategy, armId, termId);
  return updateArm(strategy, armId, (arm) => ({
    ...arm,
    terms: arm.terms.map((term) => (term.id === termId ? { ...term, text } : term)),
  }));
}

export function removeTerm(strategy: Strategy, armId: string, termId: string): Strategy {
  return updateArm(strategy, armId, (arm) => ({
    ...arm,
    terms: arm.terms.filter((term) => term.id !== termId),
  }));
}

/** Sets or clears (empty tag) the field tag of one term (FR-027). */
export function setTermTag(
  strategy: Strategy,
  armId: string,
  termId: string,
  tag: string,
): Strategy {
  return updateArm(strategy, armId, (arm) => ({
    ...arm,
    terms: arm.terms.map((term) =>
      term.id === termId ? { ...term, text: withTag(term.text, tag) } : term,
    ),
  }));
}

export function unquoteTermById(strategy: Strategy, armId: string, termId: string): Strategy {
  return updateArm(strategy, armId, (arm) => ({
    ...arm,
    terms: arm.terms.map((term) =>
      term.id === termId ? { ...term, text: unquoteTerm(term.text) } : term,
    ),
  }));
}

/** Issues for committed terms and for pending text (pending issues have no termId). */
export function validateStrategy(strategy: Strategy): Issue[] {
  const issues: Issue[] = [];
  for (const arm of strategy.arms) {
    for (const term of arm.terms) {
      const kind = validateTerm(term.text);
      if (kind) issues.push({ armId: arm.id, termId: term.id, kind });
    }
    const pending = commitTerm(arm.pending);
    if (pending !== null) {
      const kind = validateTerm(pending);
      if (kind) issues.push({ armId: arm.id, kind });
    }
  }
  return issues;
}

/** True when no arm has a committed term or non-blank pending text. */
export function isStrategyEmpty(strategy: Strategy): boolean {
  return strategy.arms.every((arm) => arm.terms.length === 0 && arm.pending.trim() === '');
}

export function toArmTerms(strategy: Strategy): string[][] {
  return strategy.arms.map((arm) => arm.terms.map((term) => term.text));
}

/** Committed terms plus pending text as Search would commit it. */
export function previewArmTerms(strategy: Strategy): string[][] {
  return strategy.arms.map((arm) => {
    const terms = arm.terms.map((term) => term.text);
    const pending = commitTerm(arm.pending);
    return pending === null ? terms : [...terms, pending];
  });
}

export function toDraft(strategy: Strategy): Draft {
  return {
    arms: strategy.arms.map((arm) => ({
      terms: arm.terms.map((term) => term.text),
      pending: arm.pending,
    })),
  };
}

export function fromDraft(draft: Draft): Strategy {
  if (draft.arms.length === 0) return { arms: [createArm()] };
  return { arms: draft.arms.map((arm) => createArm(arm.terms, arm.pending)) };
}
