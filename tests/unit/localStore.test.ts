import { describe, expect, it } from 'vitest';
import type { Draft, SearchRun } from '../../src/core/types';
import {
  DRAFT_KEY,
  HISTORY_KEY,
  createLocalDraftStore,
  createLocalHistoryStore,
} from '../../src/storage/localStore';

function run(id: string, createdAt: string, query = '(diabetes)'): SearchRun {
  return {
    id,
    createdAt,
    arms: [{ terms: ['diabetes'] }, { terms: [] }],
    query,
    metaQuery: `${query} AND ("meta-analysis")`,
    result: { status: 'ok', count: 10, queryTranslation: 'x', warnings: [] },
    metaResult: { status: 'error', kind: 'network', message: 'offline' },
  };
}

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  writes: string[] = [];
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.writes.push(key);
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.writes.push(key);
    this.data.set(key, value);
  }
}

class ThrowingStorage extends MemoryStorage {
  constructor(private readonly error: Error) {
    super();
  }
  override setItem() {
    throw this.error;
  }
  override removeItem() {
    throw this.error;
  }
}

function quotaError(): Error {
  return new DOMException('The quota has been exceeded.', 'QuotaExceededError');
}

describe('local history store (contracts/storage.md)', () => {
  it('lists runs newest first', () => {
    const store = createLocalHistoryStore(new MemoryStorage());
    store.add(run('a', '2026-09-16T10:00:00.000Z'));
    store.add(run('c', '2026-09-16T12:00:00.000Z'));
    store.add(run('b', '2026-09-16T11:00:00.000Z'));
    expect(store.list().map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('uses the browser localStorage by default', () => {
    const store = createLocalHistoryStore();
    expect(store.add(run('a', '2026-09-16T10:00:00.000Z'))).toEqual({ ok: true });
    expect(window.localStorage.getItem(HISTORY_KEY)).toContain('"schemaVersion":1');
  });

  it('writes the versioned shape', () => {
    const storage = new MemoryStorage();
    const store = createLocalHistoryStore(storage);
    const r = run('a', '2026-09-16T10:00:00.000Z');
    store.add(r);
    expect(JSON.parse(storage.getItem(HISTORY_KEY) ?? '')).toEqual({ schemaVersion: 1, runs: [r] });
  });

  it('add rejects a duplicate id and never overwrites', () => {
    const store = createLocalHistoryStore(new MemoryStorage());
    const original = run('a', '2026-09-16T10:00:00.000Z', '(first)');
    expect(store.add(original)).toEqual({ ok: true });
    const result = store.add(run('a', '2026-09-16T11:00:00.000Z', '(second)'));
    expect(result.ok).toBe(false);
    expect(store.list()).toEqual([original]);
  });

  it('stores two runs with identical query text', () => {
    const store = createLocalHistoryStore(new MemoryStorage());
    store.add(run('a', '2026-09-16T10:00:00.000Z'));
    store.add(run('b', '2026-09-16T10:01:00.000Z'));
    expect(store.list()).toHaveLength(2);
  });

  it('removes one run', () => {
    const store = createLocalHistoryStore(new MemoryStorage());
    store.add(run('a', '2026-09-16T10:00:00.000Z'));
    store.add(run('b', '2026-09-16T11:00:00.000Z'));
    expect(store.remove('a')).toEqual({ ok: true });
    expect(store.list().map((r) => r.id)).toEqual(['b']);
  });

  it('clears all runs', () => {
    const store = createLocalHistoryStore(new MemoryStorage());
    store.add(run('a', '2026-09-16T10:00:00.000Z'));
    expect(store.clear()).toEqual({ ok: true });
    expect(store.list()).toEqual([]);
  });

  it('returns empty history for corrupt JSON and keeps the raw value', () => {
    const storage = new MemoryStorage();
    storage.setItem(HISTORY_KEY, '{not json');
    const store = createLocalHistoryStore(storage);
    expect(store.list()).toEqual([]);
    expect(storage.getItem(`${HISTORY_KEY}:corrupt`)).toBe('{not json');
  });

  it('returns empty history for an unknown schemaVersion and keeps the raw value', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 99, runs: [] });
    storage.setItem(HISTORY_KEY, raw);
    expect(createLocalHistoryStore(storage).list()).toEqual([]);
    expect(storage.getItem(`${HISTORY_KEY}:corrupt`)).toBe(raw);
  });

  it('returns reason quota on QuotaExceededError', () => {
    const store = createLocalHistoryStore(new ThrowingStorage(quotaError()));
    expect(store.add(run('a', '2026-09-16T10:00:00.000Z'))).toEqual({ ok: false, reason: 'quota' });
  });

  it('returns reason unavailable on access errors', () => {
    const store = createLocalHistoryStore(new ThrowingStorage(new Error('SecurityError')));
    expect(store.add(run('a', '2026-09-16T10:00:00.000Z'))).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(store.clear()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('never throws when reading fails', () => {
    const storage = new MemoryStorage();
    storage.getItem = () => {
      throw new Error('SecurityError');
    };
    expect(createLocalHistoryStore(storage).list()).toEqual([]);
    expect(createLocalDraftStore(storage).load()).toBeNull();
  });

  it('treats missing storage as unavailable', () => {
    const store = createLocalHistoryStore(null);
    expect(store.list()).toEqual([]);
    expect(store.add(run('a', '2026-09-16T10:00:00.000Z'))).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('only writes the history, draft, and corrupt keys', () => {
    const storage = new MemoryStorage();
    storage.data.set(HISTORY_KEY, 'bad');
    storage.data.set(DRAFT_KEY, 'bad');
    const history = createLocalHistoryStore(storage);
    const drafts = createLocalDraftStore(storage);
    history.list();
    drafts.load();
    history.add(run('a', '2026-09-16T10:00:00.000Z'));
    history.remove('a');
    history.clear();
    drafts.save({ arms: [{ terms: ['x'], pending: '' }] });
    const allowed = new Set([
      HISTORY_KEY,
      DRAFT_KEY,
      `${HISTORY_KEY}:corrupt`,
      `${DRAFT_KEY}:corrupt`,
    ]);
    expect(storage.writes.length).toBeGreaterThan(0);
    expect(storage.writes.every((key) => allowed.has(key))).toBe(true);
    expect(HISTORY_KEY).toBe('sshelper:v1:history');
    expect(DRAFT_KEY).toBe('sshelper:v1:draft');
  });
});

describe('local draft store (contracts/storage.md)', () => {
  const draft: Draft = {
    arms: [
      { terms: ['"heart failure"', 'cardio*'], pending: '' },
      { terms: [], pending: 'typed' },
    ],
  };

  it('round trips a draft with the versioned shape', () => {
    const storage = new MemoryStorage();
    const store = createLocalDraftStore(storage);
    expect(store.load()).toBeNull();
    expect(store.save(draft)).toEqual({ ok: true });
    expect(store.load()).toEqual(draft);
    expect(JSON.parse(storage.getItem(DRAFT_KEY) ?? '')).toEqual({ schemaVersion: 1, ...draft });
  });

  it('round trips a draft with study inputs and labels', () => {
    const storage = new MemoryStorage();
    const store = createLocalDraftStore(storage);
    const withStudies: Draft = {
      ...draft,
      studies: [
        { input: '10.1056/NEJMoa1911303', label: 'McMurray, 2019', labelEdited: false },
        { input: '10.1002/jmri.29184', label: 'Custom, 2020', labelEdited: true },
        { input: '', label: '', labelEdited: false },
      ],
    };
    expect(store.save(withStudies)).toEqual({ ok: true });
    expect(store.load()).toEqual(withStudies);
    expect(JSON.parse(storage.getItem(DRAFT_KEY) ?? '')).toEqual({
      schemaVersion: 1,
      ...withStudies,
    });
  });

  it('loads an older draft without studies', () => {
    const storage = new MemoryStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify({ schemaVersion: 1, arms: draft.arms }));
    const loaded = createLocalDraftStore(storage).load();
    expect(loaded).toEqual(draft);
    expect(loaded).not.toHaveProperty('studies');
  });

  it('loads old string-form studies as unlabelled, unedited studies', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        schemaVersion: 1,
        arms: draft.arms,
        studies: ['10.1056/NEJMoa1911303', ''],
      }),
    );
    expect(createLocalDraftStore(storage).load()).toEqual({
      ...draft,
      studies: [
        { input: '10.1056/NEJMoa1911303', label: '', labelEdited: false },
        { input: '', label: '', labelEdited: false },
      ],
    });
  });

  it('returns null when studies has a wrong shape', () => {
    const storage = new MemoryStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify({ schemaVersion: 1, arms: [], studies: [1] }));
    expect(createLocalDraftStore(storage).load()).toBeNull();
    for (const study of [
      { input: 'x', label: 2, labelEdited: false },
      { input: 'x', label: '', labelEdited: 'yes' },
      { label: '', labelEdited: false },
    ]) {
      storage.setItem(DRAFT_KEY, JSON.stringify({ schemaVersion: 1, arms: [], studies: [study] }));
      expect(createLocalDraftStore(storage).load()).toBeNull();
    }
  });

  it('returns null for corrupt data and keeps the raw value', () => {
    const storage = new MemoryStorage();
    storage.setItem(DRAFT_KEY, '[1,2');
    expect(createLocalDraftStore(storage).load()).toBeNull();
    expect(storage.getItem(`${DRAFT_KEY}:corrupt`)).toBe('[1,2');
  });

  it('returns null for a wrong shape or unknown schemaVersion', () => {
    const storage = new MemoryStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify({ schemaVersion: 1, arms: [{ terms: 'x' }] }));
    expect(createLocalDraftStore(storage).load()).toBeNull();
    storage.setItem(DRAFT_KEY, JSON.stringify({ schemaVersion: 2, arms: [] }));
    expect(createLocalDraftStore(storage).load()).toBeNull();
  });

  it('reports quota errors on save', () => {
    const store = createLocalDraftStore(new ThrowingStorage(quotaError()));
    expect(store.save(draft)).toEqual({ ok: false, reason: 'quota' });
  });
});
