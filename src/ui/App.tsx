import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../core/id';
import { buildQuery } from '../core/query';
import { runSearch } from '../core/run';
import {
  addArm,
  commitAllPending,
  commitPending,
  createDefaultStrategy,
  editTerm,
  fromDraft,
  isStrategyEmpty,
  previewArmTerms,
  removeArm,
  removeTerm,
  setPending,
  toDraft,
  unquoteTermById,
  validateStrategy,
} from '../core/strategy';
import type { CountOutcome, SearchRun, Strategy } from '../core/types';
import { en, t } from '../i18n/en';
import { countQuery as pubmedCountQuery } from '../pubmed/client';
import { createLocalDraftStore, createLocalHistoryStore } from '../storage/localStore';
import type { DraftStore, HistoryStore, SaveResult } from '../storage/types';
import { ArmsEditor } from './ArmsEditor';
import { HistoryTable } from './HistoryTable';
import { ImportStrategy } from './ImportStrategy';
import { formatCount, SearchPanel, type LastSearch } from './SearchPanel';
import './app.css';

export interface AppProps {
  countQuery?: (query: string) => Promise<CountOutcome>;
  historyStore?: HistoryStore;
  draftStore?: DraftStore;
}

export function App({ countQuery = pubmedCountQuery, historyStore, draftStore }: AppProps) {
  const [history] = useState(() => historyStore ?? createLocalHistoryStore());
  const [drafts] = useState(() => draftStore ?? createLocalDraftStore());
  const [strategy, setStrategy] = useState<Strategy>(() => {
    const draft = drafts.load();
    return draft ? fromDraft(draft) : createDefaultStrategy();
  });
  const [runs, setRuns] = useState<SearchRun[]>(() => history.list());
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<LastSearch | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const runningRef = useRef(false);

  const track = useCallback((result: SaveResult) => {
    if (!result.ok && result.reason !== 'duplicate') setSaveFailed(true);
  }, []);

  useEffect(() => {
    track(drafts.save(toDraft(strategy)));
  }, [drafts, strategy, track]);

  const update = useCallback((change: (current: Strategy) => Strategy) => {
    setStrategy((current) => change(current));
  }, []);

  const issues = useMemo(() => validateStrategy(strategy), [strategy]);
  const query = useMemo(() => buildQuery(previewArmTerms(strategy)), [strategy]);
  const isEmpty = isStrategyEmpty(strategy);

  const handleSearch = async () => {
    if (runningRef.current) return;
    const committed = commitAllPending(strategy);
    setStrategy(committed);
    if (validateStrategy(committed).length > 0 || isStrategyEmpty(committed)) return;

    runningRef.current = true;
    setRunning(true);
    setAnnouncement(en.searching);
    try {
      const outcome = await runSearch(committed, { countQuery, now: () => new Date(), newId });
      if (outcome.status === 'completed') {
        const { result, metaResult } = outcome.run;
        track(history.add(outcome.run));
        setRuns(history.list());
        setLast({ status: 'completed', result, metaResult });
        setAnnouncement(
          t(en.resultsAnnouncement, { count: formatCount(result), meta: formatCount(metaResult) }),
        );
      } else if (outcome.status === 'failed') {
        const { result, metaResult } = outcome.failure;
        setLast({ status: 'failed', result, metaResult });
        // The role=alert message in SearchPanel announces this failure.
        setAnnouncement('');
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  const handleLoad = (run: SearchRun) => {
    setStrategy(fromDraft({ arms: run.arms.map((arm) => ({ terms: arm.terms, pending: '' })) }));
  };

  const handleDelete = (id: string) => {
    track(history.remove(id));
    setRuns(history.list());
  };

  const handleClear = () => {
    track(history.clear());
    setRuns(history.list());
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>{en.appTitle}</h1>
        <p className="purpose">{en.appPurpose}</p>
      </header>
      <main>
        <section className="panel" aria-labelledby="arms-heading">
          <h2 id="arms-heading">{en.armsHeading}</h2>
          <ImportStrategy
            needsConfirmation={!isEmpty}
            onImport={(arms) =>
              setStrategy(fromDraft({ arms: arms.map((terms) => ({ terms, pending: '' })) }))
            }
          />
          <ArmsEditor
            strategy={strategy}
            issues={issues}
            onAddArm={() => update(addArm)}
            onDeleteArm={(armId) => update((s) => removeArm(s, armId))}
            onPendingChange={(armId, text) => update((s) => setPending(s, armId, text))}
            onCommitPending={(armId) => update((s) => commitPending(s, armId))}
            onEditTerm={(armId, termId, raw) => update((s) => editTerm(s, armId, termId, raw))}
            onRemoveTerm={(armId, termId) => update((s) => removeTerm(s, armId, termId))}
            onUnquoteTerm={(armId, termId) => update((s) => unquoteTermById(s, armId, termId))}
          />
        </section>
        <section className="panel" aria-labelledby="search-heading">
          <h2 id="search-heading">{en.searchHeading}</h2>
          <SearchPanel
            query={query}
            isEmpty={isEmpty}
            hasIssues={issues.length > 0}
            running={running}
            last={last}
            onSearch={() => void handleSearch()}
          />
        </section>
        <section className="panel" aria-labelledby="history-heading">
          <h2 id="history-heading">{en.historyHeading}</h2>
          {saveFailed && <p className="alert">{en.historySaveFailed}</p>}
          <HistoryTable
            runs={runs}
            needsLoadConfirmation={strategy.arms.some((arm) => arm.terms.length > 0)}
            onLoad={handleLoad}
            onDelete={handleDelete}
            onClear={handleClear}
          />
        </section>
      </main>
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
