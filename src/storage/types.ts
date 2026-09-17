import type { Draft, SearchRun } from '../core/types';

export type SaveResult =
  { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'duplicate' };

/** History of search runs. The seam for the Supabase implementation in Phase B. */
export interface HistoryStore {
  /** Newest first. Never throws. */
  list(): SearchRun[];
  /** Appends a run; never replaces an existing one (duplicate ids are rejected). */
  add(run: SearchRun): SaveResult;
  remove(id: string): SaveResult;
  clear(): SaveResult;
}

/** The strategy in progress. */
export interface DraftStore {
  load(): Draft | null;
  save(draft: Draft): SaveResult;
}
