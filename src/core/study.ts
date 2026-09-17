import { newId } from './id';
import type { CountOutcome, Study, StudyCheck } from './types';

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

export function createStudy(input = ''): Study {
  return { id: newId(), input };
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

export function setStudyInput(studies: Study[], id: string, input: string): Study[] {
  return studies.map((study) => (study.id === id ? { ...study, input } : study));
}

export function toStudyInputs(studies: Study[]): string[] {
  return studies.map((study) => study.input);
}

/** Missing inputs (older drafts) give the default boxes. */
export function fromStudyInputs(inputs: string[] | undefined): Study[] {
  if (inputs === undefined) return createDefaultStudies();
  if (inputs.length === 0) return [createStudy()];
  return inputs.map((input) => createStudy(input));
}
