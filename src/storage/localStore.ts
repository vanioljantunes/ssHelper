import type { CountOutcome, Draft, SearchRun } from '../core/types';
import type { DraftStore, HistoryStore, SaveResult } from './types';

export const HISTORY_KEY = 'sshelper:v1:history';
export const DRAFT_KEY = 'sshelper:v1:draft';
export const SCHEMA_VERSION = 1;

const OK: SaveResult = { ok: true };

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function writeError(error: unknown): SaveResult {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  const code = (error as { code?: unknown } | null)?.code;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22) {
    return { ok: false, reason: 'quota' };
  }
  return { ok: false, reason: 'unavailable' };
}

function safeWrite(storage: Storage | null, key: string, value: string | null): SaveResult {
  if (storage === null) return { ok: false, reason: 'unavailable' };
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    return OK;
  } catch (error) {
    return writeError(error);
  }
}

type ReadResult<T> = { status: 'missing' } | { status: 'ok'; value: T } | { status: 'invalid' };

/** Reads and validates a key. Invalid raw data is copied to `<key>:corrupt`, never deleted. */
function safeRead<T>(
  storage: Storage | null,
  key: string,
  parse: (data: unknown) => T | null,
): ReadResult<T> {
  if (storage === null) return { status: 'missing' };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: 'missing' };
  }
  if (raw === null) return { status: 'missing' };
  let value: T | null = null;
  try {
    value = parse(JSON.parse(raw));
  } catch {
    value = null;
  }
  if (value !== null) return { status: 'ok', value };
  safeWrite(storage, `${key}:corrupt`, raw);
  return { status: 'invalid' };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function isCountOutcome(value: unknown): value is CountOutcome {
  if (!isObject(value)) return false;
  if (value.status === 'ok') {
    return (
      typeof value.count === 'number' &&
      typeof value.queryTranslation === 'string' &&
      isStringArray(value.warnings)
    );
  }
  return (
    value.status === 'error' && typeof value.kind === 'string' && typeof value.message === 'string'
  );
}

function isSearchRun(value: unknown): value is SearchRun {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.query === 'string' &&
    typeof value.metaQuery === 'string' &&
    Array.isArray(value.arms) &&
    value.arms.every((arm) => isObject(arm) && isStringArray(arm.terms)) &&
    isCountOutcome(value.result) &&
    isCountOutcome(value.metaResult)
  );
}

function parseHistory(data: unknown): SearchRun[] | null {
  if (!isObject(data) || data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.runs))
    return null;
  return data.runs.every(isSearchRun) ? data.runs : null;
}

function parseDraft(data: unknown): Draft | null {
  if (!isObject(data) || data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.arms))
    return null;
  const valid = data.arms.every(
    (arm) => isObject(arm) && isStringArray(arm.terms) && typeof arm.pending === 'string',
  );
  if (!valid) return null;
  if (data.studies !== undefined && !isStringArray(data.studies)) return null;
  const draft: Draft = {
    arms: (data.arms as { terms: string[]; pending: string }[]).map((arm) => ({
      terms: [...arm.terms],
      pending: arm.pending,
    })),
  };
  if (data.studies !== undefined) draft.studies = [...data.studies];
  return draft;
}

function newestFirst(runs: SearchRun[]): SearchRun[] {
  return [...runs].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

export function createLocalHistoryStore(storage: Storage | null = browserStorage()): HistoryStore {
  const readRuns = (): SearchRun[] => {
    const result = safeRead(storage, HISTORY_KEY, parseHistory);
    return result.status === 'ok' ? result.value : [];
  };
  const writeRuns = (runs: SearchRun[]): SaveResult =>
    safeWrite(storage, HISTORY_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, runs }));

  return {
    list: () => newestFirst(readRuns()),
    add(run) {
      const runs = readRuns();
      if (runs.some((existing) => existing.id === run.id))
        return { ok: false, reason: 'duplicate' };
      return writeRuns([...runs, run]);
    },
    remove(id) {
      return writeRuns(readRuns().filter((run) => run.id !== id));
    },
    clear() {
      return writeRuns([]);
    },
  };
}

export function createLocalDraftStore(storage: Storage | null = browserStorage()): DraftStore {
  return {
    load() {
      const result = safeRead(storage, DRAFT_KEY, parseDraft);
      return result.status === 'ok' ? result.value : null;
    },
    save(draft) {
      return safeWrite(
        storage,
        DRAFT_KEY,
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, arms: draft.arms, studies: draft.studies }),
      );
    },
  };
}
