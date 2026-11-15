import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isValidContactEmail } from '../core/email';
import { newId } from '../core/id';
import { defaultMinYear, yearOptions } from '../core/prior';
import { buildQuery, withYearFloor } from '../core/query';
import { runSearch } from '../core/run';
import {
  addStudy,
  applyAutoLabel,
  checkStudy,
  fromDraftStudies,
  type LabelledCheck,
  normalizeDoi,
  removeStudy,
  setStudyInput,
  setStudyLabel,
  summarizeStudyChecks,
  toDraftStudies,
} from '../core/study';
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
  toArmTerms,
  toDraft,
  setTermTag,
  unquoteTermById,
  validateStrategy,
} from '../core/strategy';
import { DEFAULT_TARGET_DATABASES, type TargetDatabase } from '../core/translate';
import type { CountOutcome, SearchRun, Strategy, Study } from '../core/types';
import { createAppCrossrefClient, type LabelOutcome } from '../crossref/client';
import { en, t } from '../i18n/en';
import { createAppPubmedClient, type RecordsOutcome } from '../pubmed/client';
import {
  createLocalDraftStore,
  createLocalHistoryStore,
  createLocalSettingsStore,
} from '../storage/localStore';
import type { DraftStore, HistoryStore, SaveResult, SettingsStore } from '../storage/types';
import { ArmsEditor } from './ArmsEditor';
import { Hero } from './Hero';
import { HistoryTable } from './HistoryTable';
import { ImportStrategy } from './ImportStrategy';
import { Packages } from './Packages';
import { PriorCount, PriorPanel, type PriorState } from './PriorPanel';
import { PromptPanel } from './PromptPanel';
import { CONTACT_EMAIL_HINT_ID, formatCount, SearchPanel, type LastSearch } from './SearchPanel';
import { ExportPanel } from './ExportPanel';
import { Section } from './Section';
import { PAGE_SECTIONS, SectionNav } from './SectionNav';
import { SiteBar } from './SiteBar';
import { StudiesPanel, type StudyRowState } from './StudiesPanel';
import { TranslatePanel } from './TranslatePanel';
import './app.css';

/** Every collapsible section; the About block above them always stays open. */
const TOOL_SECTION_IDS: readonly string[] = PAGE_SECTIONS.map((section) => section.id).filter(
  (id) => id !== 'about',
);

export interface AppProps {
  countQuery?: (query: string) => Promise<CountOutcome>;
  /** Prior meta-analysis records for a query; defaults to the PubMed client. */
  listRecords?: (query: string) => Promise<RecordsOutcome>;
  /** Study label lookup by DOI (FR-024); defaults to the Crossref client. */
  lookupLabel?: (doi: string) => Promise<LabelOutcome>;
  historyStore?: HistoryStore;
  draftStore?: DraftStore;
  settingsStore?: SettingsStore;
  /** Pre-filled contact email when none is saved; defaults to the optional build variable. */
  defaultContactEmail?: string;
  /** Starts with every section open instead of folded (tests). */
  openAllSections?: boolean;
}

export function App({
  countQuery: countQueryProp,
  listRecords: listRecordsProp,
  lookupLabel: lookupLabelProp,
  historyStore,
  draftStore,
  settingsStore,
  defaultContactEmail = import.meta.env.VITE_NCBI_CONTACT_EMAIL ?? '',
  openAllSections = false,
}: AppProps) {
  const [history] = useState(() => historyStore ?? createLocalHistoryStore());
  const [drafts] = useState(() => draftStore ?? createLocalDraftStore());
  const [settings] = useState(() => settingsStore ?? createLocalSettingsStore());
  const [contactEmail, setContactEmail] = useState(
    () => settings.load()?.contactEmail ?? defaultContactEmail.trim(),
  );
  const emailValid = isValidContactEmail(contactEmail);
  // The clients read the visitor's email at request time (FR-025).
  const emailRef = useRef(contactEmail.trim());
  useEffect(() => {
    emailRef.current = contactEmail.trim();
  }, [contactEmail]);
  const [clients] = useState(() => {
    const email = () => emailRef.current;
    return { pubmed: createAppPubmedClient(email), crossref: createAppCrossrefClient(email) };
  });
  const countQuery = countQueryProp ?? ((query: string) => clients.pubmed.countQuery(query));
  const lookupLabel = lookupLabelProp ?? ((doi: string) => clients.crossref.fetchStudyLabel(doi));
  const listRecords = listRecordsProp ?? ((query: string) => clients.pubmed.listRecords(query));
  const [initialDraft] = useState(() => drafts.load());
  const [strategy, setStrategy] = useState<Strategy>(() =>
    initialDraft ? fromDraft(initialDraft) : createDefaultStrategy(),
  );
  const [studies, setStudies] = useState<Study[]>(() => fromDraftStudies(initialDraft?.studies));
  const [studyResults, setStudyResults] = useState<Record<string, StudyRowState>>({});
  const [checkingStudies, setCheckingStudies] = useState(false);
  const [runs, setRuns] = useState<SearchRun[]>(() => history.list());
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<LastSearch | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The meta-analysis query of the last run; the year filter is added to it on each load.
  const [priorQuery, setPriorQuery] = useState<string | null>(null);
  const [priorCount, setPriorCount] = useState<number | null>(null);
  const [priorMinYear, setPriorMinYear] = useState<number | null>(null);
  const [priorState, setPriorState] = useState<PriorState>({ status: 'idle' });
  // Only the newest load may write its records: an older one can still be in flight.
  const priorLoadRef = useRef(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const runningRef = useRef(false);
  // Sections start folded; a link to one (#search) opens it on arrival.
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => {
    if (openAllSections) return new Set(TOOL_SECTION_IDS);
    const hash = window.location.hash.slice(1);
    return new Set(TOOL_SECTION_IDS.includes(hash) ? [hash] : []);
  });
  const allOpen = openSections.size === TOOL_SECTION_IDS.length;

  const openSection = useCallback((id: string) => {
    setOpenSections((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /** Opens Search strategy and puts the cursor in its paste box. */
  const handleGoPaste = () => {
    openSection('strategy');
    // The box is already in the DOM; wait one frame for its section to unhide.
    window.requestAnimationFrame(() => {
      const box = document.querySelector<HTMLTextAreaElement>('#strategy .import-box');
      if (!box) return;
      box.scrollIntoView?.({ block: 'center' });
      box.focus({ preventScroll: true });
    });
  };

  const track = useCallback((result: SaveResult) => {
    if (!result.ok && result.reason !== 'duplicate') setSaveFailed(true);
  }, []);

  useEffect(() => {
    track(drafts.save({ ...toDraft(strategy), studies: toDraftStudies(studies) }));
  }, [drafts, strategy, studies, track]);

  /** Lists the meta-analyses of `baseQuery`, from `year` onwards when a year is chosen. */
  const loadPrior = async (baseQuery: string, year: number | null) => {
    const load = priorLoadRef.current + 1;
    priorLoadRef.current = load;
    setPriorState({ status: 'loading' });
    const outcome = await listRecords(year === null ? baseQuery : withYearFloor(baseQuery, year));
    if (priorLoadRef.current !== load) return;
    setPriorState(
      outcome.status === 'ok'
        ? { status: 'ready', records: outcome.records, total: outcome.total }
        : { status: 'error', message: outcome.message },
    );
  };

  const handleMinYearChange = (year: number | null) => {
    setPriorMinYear(year);
    if (priorQuery !== null) void loadPrior(priorQuery, year);
  };

  const update = useCallback((change: (current: Strategy) => Strategy) => {
    setStrategy((current) => change(current));
  }, []);

  const issues = useMemo(() => validateStrategy(strategy), [strategy]);
  const query = useMemo(() => buildQuery(previewArmTerms(strategy)), [strategy]);
  const [targets, setTargets] = useState<TargetDatabase[]>(DEFAULT_TARGET_DATABASES);
  const isEmpty = isStrategyEmpty(strategy);

  /**
   * Looks up labels for boxes with a valid DOI and no label yet, on the Crossref queue so the
   * PubMed checks are not slowed. Failures leave the label empty and show nothing (FR-024).
   */
  const labelStudies = (list: Study[]) => {
    for (const study of list) {
      const doi = normalizeDoi(study.input);
      if (doi === null || study.labelEdited || study.label !== '') continue;
      void lookupLabel(doi)
        .then((outcome) => {
          if (outcome.status !== 'ok') return;
          setStudies((current) => applyAutoLabel(current, study.id, outcome.label, study.input));
        })
        .catch(() => undefined);
    }
  };

  /**
   * Checks every non-empty study box in order through the throttled countQuery (FR-023), and
   * returns the outcomes named as in the boxes so the run can record them (FR-030).
   */
  const checkStudies = async (checkedQuery: string, list: Study[]): Promise<LabelledCheck[]> => {
    labelStudies(list);
    const targets = list.filter((study) => study.input.trim() !== '');
    if (targets.length === 0) return [];
    setCheckingStudies(true);
    setStudyResults((current) => {
      const next = { ...current };
      for (const study of targets) {
        next[study.id] = { input: study.input, check: { status: 'checking', query: checkedQuery } };
      }
      return next;
    });
    const checks: LabelledCheck[] = [];
    try {
      for (const study of targets) {
        const check = await checkStudy(checkedQuery, study.input, countQuery);
        setStudyResults((current) => ({ ...current, [study.id]: { input: study.input, check } }));
        checks.push({ label: study.label.trim() || study.input.trim(), check });
      }
    } finally {
      setCheckingStudies(false);
    }
    return checks;
  };

  /**
   * Saves the email once it is valid; clearing the field removes the saved address. A failed
   * save only means the visitor retypes it after a reload, so it is not reported.
   */
  const handleContactEmailChange = (value: string) => {
    setContactEmail(value);
    const trimmed = value.trim();
    if (trimmed === '' || isValidContactEmail(trimmed)) settings.save({ contactEmail: trimmed });
  };

  const handleCheckStudies = async () => {
    if (runningRef.current || !emailValid) return;
    const committed = commitAllPending(strategy);
    setStrategy(committed);
    if (validateStrategy(committed).length > 0 || isStrategyEmpty(committed)) return;
    const committedQuery = buildQuery(toArmTerms(committed));
    if (committedQuery === null) return;

    runningRef.current = true;
    try {
      await checkStudies(committedQuery, studies);
    } finally {
      runningRef.current = false;
    }
  };

  const handleStudyInput = (id: string, input: string) => {
    setStudies((current) => setStudyInput(current, id, input));
    setStudyResults((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleSearch = async () => {
    if (runningRef.current || !emailValid) return;
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
        setPriorQuery(outcome.run.metaQuery);
        openSection('prior');
        if (metaResult.status === 'ok') {
          const year = defaultMinYear(metaResult.count, new Date());
          setPriorCount(metaResult.count);
          setPriorMinYear(year);
          void loadPrior(outcome.run.metaQuery, year);
        } else {
          setPriorCount(null);
          setPriorState({ status: 'error', message: metaResult.message });
        }
        const checks = await checkStudies(outcome.run.query, studies);
        if (checks.length > 0) {
          track(history.attachStudies(outcome.run.id, summarizeStudyChecks(checks)));
          setRuns(history.list());
        }
      } else if (outcome.status === 'failed') {
        const { result, metaResult } = outcome.failure;
        setLast({ status: 'failed', result, metaResult });
        setPriorCount(null);
        // Both requests failed: the role=alert message in SearchPanel is the only report needed.
        setPriorState({ status: 'idle' });
        setAnnouncement('');
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  const handleLoad = (run: SearchRun) => {
    setStrategy(fromDraft({ arms: run.arms.map((arm) => ({ terms: arm.terms, pending: '' })) }));
    openSection('strategy');
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
    <>
      <SiteBar />
      <div className="app">
        <Hero />
        <div className="tool">
          <SectionNav
            onSelect={openSection}
            allOpen={allOpen}
            onToggleAll={() => setOpenSections(allOpen ? new Set() : new Set(TOOL_SECTION_IDS))}
          />
          <main>
            <Section
              id="prompt"
              headingId="prompt-heading"
              title={en.promptHeading}
              open={openSections.has('prompt')}
              onToggle={toggleSection}
            >
              <PromptPanel onGoPaste={handleGoPaste} />
            </Section>
            <Section
              id="strategy"
              headingId="arms-heading"
              title={en.armsHeading}
              open={openSections.has('strategy')}
              onToggle={toggleSection}
            >
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
                onSetTermTag={(armId, termId, tag) =>
                  update((s) => setTermTag(s, armId, termId, tag))
                }
              />
            </Section>
            <Section
              id="search"
              headingId="search-heading"
              title={en.searchHeading}
              open={openSections.has('search')}
              onToggle={toggleSection}
            >
              <SearchPanel
                query={query}
                isEmpty={isEmpty}
                hasIssues={issues.length > 0}
                running={running || checkingStudies}
                last={last}
                contactEmail={contactEmail}
                emailValid={emailValid}
                onContactEmailChange={handleContactEmailChange}
                onSearch={() => void handleSearch()}
              />
            </Section>
            <Section
              id="prior"
              headingId="prior-heading"
              title={en.priorHeading}
              open={openSections.has('prior')}
              onToggle={toggleSection}
              badge={<PriorCount count={priorCount} />}
            >
              <PriorPanel
                state={priorState}
                minYear={priorMinYear}
                years={yearOptions(new Date())}
                onMinYearChange={handleMinYearChange}
              />
            </Section>
            <Section
              id="studies"
              headingId="studies-heading"
              title={en.studiesHeading}
              open={openSections.has('studies')}
              onToggle={toggleSection}
            >
              <StudiesPanel
                studies={studies}
                results={studyResults}
                query={query}
                canCheck={!isEmpty && issues.length === 0 && emailValid}
                describedBy={emailValid ? undefined : CONTACT_EMAIL_HINT_ID}
                checking={running || checkingStudies}
                onInputChange={handleStudyInput}
                onLabelChange={(id, label) =>
                  setStudies((current) => setStudyLabel(current, id, label))
                }
                onAdd={() => setStudies(addStudy)}
                onRemove={(id) => setStudies((current) => removeStudy(current, id))}
                onCheck={() => void handleCheckStudies()}
              />
            </Section>
            <Section
              id="translate"
              headingId="translate-heading"
              title={en.translateHeading}
              open={openSections.has('translate')}
              onToggle={toggleSection}
            >
              <TranslatePanel
                arms={previewArmTerms(strategy)}
                selected={targets}
                onToggle={(database, checked) =>
                  setTargets((current) =>
                    checked ? [...current, database] : current.filter((item) => item !== database),
                  )
                }
              />
            </Section>
            <Section
              id="export"
              headingId="export-heading"
              title={en.exportHeading}
              open={openSections.has('export')}
              onToggle={toggleSection}
            >
              <ExportPanel arms={previewArmTerms(strategy)} query={query} selected={targets} />
            </Section>
            <Section
              id="history"
              headingId="history-heading"
              title={en.historyHeading}
              open={openSections.has('history')}
              onToggle={toggleSection}
            >
              {saveFailed && <p className="alert">{en.historySaveFailed}</p>}
              <HistoryTable
                runs={runs}
                needsLoadConfirmation={strategy.arms.some((arm) => arm.terms.length > 0)}
                onLoad={handleLoad}
                onDelete={handleDelete}
                onClear={handleClear}
              />
            </Section>
          </main>
        </div>
        <Packages />
        <div className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </div>
      </div>
    </>
  );
}
