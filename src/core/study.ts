import { newId } from './id';
import type { CountOutcome, DraftStudy, Study, StudyCheck } from './types';

export const DEFAULT_STUDY_COUNT = 3;

const DOI_PREFIX = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\.org\/|doi:)\s*/i;
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

/** Bare DOI from a DOI, doi.org link, or `doi:` form. Null when it is not a valid DOI. */
export function normalizeDoi(raw: string): string | null {
  let text = raw.trim().replace(DOI_PREFIX, '');
  try {
    text = decodeURIComponent(text);
  } catch {
    return null;
  }
  text = text.trim();
  return DOI_PATTERN.test(text) && !text.includes('"') ? text : null;
}

/** The strategy with one extra arm holding only the DOI. */
export function studyQuery(query: string, doi: string): string {
  return `${query} AND ("${doi}"[doi])`;
}

/** The DOI alone, to tell "not in PubMed" apart from "not found by the strategy". */
export function doiExistsQuery(doi: string): string {
  return `"${doi}"[doi]`;
}

/** Checks one study (FR-023, Constitution Principle IV). No network code here. */
export async function checkStudy(
  query: string,
  rawInput: string,
  countQuery: (query: string) => Promise<CountOutcome>,
  now: () => Date = () => new Date(),
): Promise<StudyCheck> {
  const checkedAt = now().toISOString();
  const doi = normalizeDoi(rawInput);
  if (doi === null) return { status: 'invalid', doi: null, query, checkedAt };

  const withStrategy = await countQuery(studyQuery(query, doi));
  if (withStrategy.status === 'error') {
    return { status: 'error', doi, query, checkedAt, message: withStrategy.message };
  }
  if (withStrategy.count > 0) return { status: 'found', doi, query, checkedAt };

  const alone = await countQuery(doiExistsQuery(doi));
  if (alone.status === 'error') {
    return { status: 'error', doi, query, checkedAt, message: alone.message };
  }
  return { status: alone.count > 0 ? 'not_found' : 'not_in_pubmed', doi, query, checkedAt };
}

export function createStudy(input = '', label = '', labelEdited = false): Study {
  return { id: newId(), input, label, labelEdited };
}

export function createDefaultStudies(): Study[] {
  return Array.from({ length: DEFAULT_STUDY_COUNT }, () => createStudy());
}

export function addStudy(studies: Study[]): Study[] {
  return [...studies, createStudy()];
}

/** Removes a study; at least one study box always remains. */
export function removeStudy(studies: Study[], id: string): Study[] {
  const rest = studies.filter((study) => study.id !== id);
  return rest.length === 0 ? [createStudy()] : rest;
}

/** A new DOI clears an automatic label, which belonged to the old DOI; an edited label stays. */
export function setStudyInput(studies: Study[], id: string, input: string): Study[] {
  return studies.map((study) => {
    if (study.id !== id) return study;
    if (study.labelEdited || study.input === input) return { ...study, input };
    return { ...study, input, label: '' };
  });
}

/** Typing locks the label; clearing it unlocks automatic labelling again (FR-024). */
export function setStudyLabel(studies: Study[], id: string, label: string): Study[] {
  const cleared = label.trim() === '';
  return studies.map((study) =>
    study.id === id ? { ...study, label: cleared ? '' : label, labelEdited: !cleared } : study,
  );
}

/** Applies a looked-up label only if the box still holds that input and was not edited. */
export function applyAutoLabel(
  studies: Study[],
  id: string,
  label: string,
  forDoiInput: string,
): Study[] {
  return studies.map((study) =>
    study.id === id && study.input === forDoiInput && !study.labelEdited
      ? { ...study, label }
      : study,
  );
}

export function toStudyInputs(studies: Study[]): string[] {
  return studies.map((study) => study.input);
}

export function toDraftStudies(studies: Study[]): DraftStudy[] {
  return studies.map(({ input, label, labelEdited }) => ({ input, label, labelEdited }));
}

/** Missing studies (older drafts) give the default boxes; plain strings are unlabelled inputs. */
export function fromDraftStudies(saved: (string | DraftStudy)[] | undefined): Study[] {
  if (saved === undefined) return createDefaultStudies();
  if (saved.length === 0) return [createStudy()];
  return saved.map((item) =>
    typeof item === 'string'
      ? createStudy(item)
      : createStudy(item.input, item.label, item.labelEdited),
  );
}
