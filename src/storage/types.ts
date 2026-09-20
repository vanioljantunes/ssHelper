import type { Draft, RunStudies, SearchRun } from '../core/types';

export type SaveResult =
  { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'duplicate' };

/** History of search runs. The seam for the Supabase implementation in Phase B. */
export interface HistoryStore {
  /** Newest first. Never throws. */
  list(): SearchRun[];
  /** Appends a run; never replaces an existing one (duplicate ids are rejected). */
  add(run: SearchRun): SaveResult;
  /** Attaches the known-study outcome to a saved run (FR-030); an unknown id is not added. */
  attachStudies(id: string, studies: RunStudies): SaveResult;
  remove(id: string): SaveResult;
  clear(): SaveResult;
}

/** The strategy in progress. */
export interface DraftStore {
  load(): Draft | null;
  save(draft: Draft): SaveResult;
}

/** Visitor settings kept in this browser (FR-025). */
export interface Settings {
  /** Contact email sent to PubMed and Crossref; empty when the visitor removed it. */
  contactEmail: string;
}

/** Visitor settings. Reads never throw; a missing or corrupt value loads as null. */
export interface SettingsStore {
  load(): Settings | null;
  save(settings: Settings): SaveResult;
}
