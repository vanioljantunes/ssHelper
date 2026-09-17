# Feature Specification: PubMed Arm-Based Search and Result History

**Feature Branch**: `001-pubmed-arm-search`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Let's work on the PubMed retrieval check. It should already have an
interface where we can put the search strategy. Let's put the search strategy with blocks. You
have one block where you can put things like 'or': this term, this term, this term. Instead of
writing 'and', make a button so that another block shows up and an 'and' appears between the
blocks, so that it's clear that it's another arm. Call this block 'arms'. No fixed number of arms,
3 as the default. People can delete and add more, and an empty arm is fine. It should then get
the number of results from PubMed and save in a history table with the date and time (hour and
day), the search strategy, the number of results, and another column with the results of the
same strategy with one extra arm containing only 'meta-analysis'."

## Clarifications

### Session 2026-09-16

- Q: What exactly does the extra meta-analysis arm send to PubMed? → A: The quoted phrase
  `"meta-analysis"` (with the double quotes), as its own arm joined with AND.
- Q: How are terms entered inside an arm? → A: Each arm is a horizontal row of small term
  boxes. The researcher types in the empty box and presses Enter; a term containing a space is
  wrapped in quotation marks (single words are not); a new empty box appears to the right with a
  non-editable "OR" between. A single click on a quotation mark removes the quotes (no edit
  mode). Editing a term and pressing Enter re-applies the rule: space present -> quotes, no
  space -> no quotes.
- Q: Text typed but not committed with Enter when Search is pressed? → A: It is committed
  automatically with the same quoting rule, then included in the search.
- Q: Interface language at launch? → A: English, with all interface text kept translatable so
  other languages (e.g. Portuguese) can be added later.
- Q: Where does this version run? → A: Locally only, for testing (Constitution Delivery Phase
  A). Hosting on Vercel with Supabase accounts is the next phase.
- Q: Is history exportable in this feature? → A: Copy row only. Each history row has a button
  that copies its strategy text to the clipboard; no file export in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build a strategy with arms and get the PubMed count (Priority: P1)

A researcher opens the search page and sees three empty arms stacked vertically, with an "AND"
label between each pair. In each arm they type a term in a small box and press Enter; multi-word terms
are wrapped in quotation marks automatically, and a new empty box appears to the right after a
fixed "OR" label. They add or remove arms as needed. They press
"Search" and see how many PubMed records the strategy retrieves, plus how many it retrieves with
an extra "meta-analysis" arm.

**Why this priority**: This is the core of the retrieval check. Without it, nothing else in the
feature has value.

**Independent Test**: Enter terms in two arms, run the search, and compare both counts with the
counts PubMed's own website shows for the same query text.

**Acceptance Scenarios**:

1. **Given** the page is opened for the first time, **When** it loads, **Then** exactly 3 empty
   arms are shown with "AND" between consecutive arms.
2. **Given** an empty arm, **When** the researcher types `heart failure` and presses Enter,
   **Then** the box shows `"heart failure"` (quoted), and a new empty box appears to its right
   with a non-editable "OR" between them.
3. **Given** a term box, **When** the researcher types `diabetes` (no space) and presses Enter,
   **Then** the box shows `diabetes` without quotation marks.
4. **Given** a quoted term `"heart failure"`, **When** the researcher clicks once on either
   quotation mark, **Then** the quotes are removed and the box shows `heart failure`, without
   entering edit mode.
5. **Given** a committed term, **When** the researcher clicks the term text, edits it, and
   presses Enter, **Then** quoting is re-applied: quotes if the edited text contains a space,
   none if it does not.
6. **Given** any number of arms, **When** the researcher presses "Add arm", **Then** a new empty
   arm appears at the end with "AND" before it.
7. **Given** 3 arms, **When** the researcher deletes the middle arm, **Then** 2 arms remain,
   their terms are unchanged, and exactly one "AND" is shown between them.
8. **Given** arms A = (`"heart failure"` OR `"cardiac failure"`), B = (empty), C =
   (`"sglt2 inhibitors"`), **When** the researcher presses "Search", **Then** the empty arm is
   ignored, the query sent is `("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")`,
   and the result count is shown.
9. **Given** the same strategy, **When** the search completes, **Then** a second count is shown
   for the query with one extra arm containing only `"meta-analysis"` (with double quotes), i.e.
   `("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors") AND ("meta-analysis")`.
10. **Given** the search is running, **When** results are not yet back, **Then** a loading state
   is shown and the "Search" button cannot trigger a duplicate run.

---

### User Story 2 - Keep a history of searches (Priority: P2)

Each completed search is added to a history table so the researcher can compare how changes to
the strategy affect the number of results.

**Why this priority**: Iterating on a strategy requires comparing versions. The history turns
single counts into a development record.

**Independent Test**: Run three different strategies and confirm three rows appear, newest
first, each with the correct date and time, strategy text, and both counts; reload the page and
confirm the rows are still there.

**Acceptance Scenarios**:

1. **Given** a successful search, **When** it completes, **Then** a new row is added at the top
   of the history table with columns: Date and time (day and hour:minute), Search strategy (exact
   query text sent), Results, Results + meta-analysis.
2. **Given** existing history rows, **When** the researcher reloads the page on the same device
   and browser, **Then** all rows are still shown.
3. **Given** a search where one of the two counts failed, **When** the row is saved, **Then** the
   failed count shows "Error" and never a number such as 0.
4. **Given** a history row, **When** the researcher chooses "Load", **Then** the arms are
   replaced with that row's arms and terms so the strategy can be edited and re-run; if the
   current arms already contain terms, the researcher confirms first.
5. **Given** a history row, **When** the researcher presses its "Copy" button, **Then** the
   exact query text of that row is copied to the clipboard and a brief confirmation is shown.

---

### Edge Cases

- All arms empty (no committed terms and no typed text in any arm): "Search" is disabled and a
  hint says at least one term is needed. No PubMed call is made and no history row is added.
- Only one non-empty arm: the query is that arm alone, without any "AND".
- Blank or whitespace-only terms are ignored; leading and trailing spaces are trimmed before
  the space rule is checked, so `diabetes ` stays unquoted.
- Pressing Enter in an empty box does nothing; no new box is created.
- A term the researcher already typed with quotation marks is not quoted twice.
- A multi-word term with a field tag (e.g. `heart failure[tiab]`) gets quotes around the words
  only: `"heart failure"[tiab]`.
- Quotes removed by click stay removed until the term is edited and Enter is pressed again.
- Deleting a term (clear its text and press Enter, or its remove control) removes the box and
  its neighbouring "OR"; the empty input box at the end always remains.
- Duplicate terms in the same arm are kept as entered (the researcher owns the strategy).
- Apart from automatic quoting, terms containing PubMed syntax (field tags like `[tiab]` or
  `[Mesh]`, truncation `*`) are sent as shown in the box.
- Terms containing "AND", "OR", or "NOT" are sent as typed inside their arm's parentheses.
- A term with unbalanced parentheses or an odd number of quotation marks is marked as invalid
  and Search is disabled until it is fixed, because PubMed silently repairs such input and would
  count a different query than the one shown.
- PubMed returns 0 results: 0 is shown and saved as a real result, distinct from "Error".
- PubMed unavailable, rate limited, or offline: a clear message is shown; the row is saved with
  "Error" for the affected count, or not saved if both counts failed.
- The researcher deletes the last arm: an empty arm is added back so at least one arm exists.
- Very long strategies: the history cell wraps the strategy text, and the full text is always
  available.
- Same strategy run twice: two separate rows are saved, since PubMed counts change over time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The search page MUST show 3 empty arms by default when there is no strategy in
  progress.
- **FR-002**: Users MUST be able to add an arm with an "Add arm" button; there is no upper limit
  on the number of arms.
- **FR-003**: Users MUST be able to delete any arm; at least one arm MUST always remain.
- **FR-004**: The interface MUST display "AND" between consecutive arms and "OR" between terms
  within an arm. Users do not type these operators.
- **FR-005**: Each arm MUST show its terms as a horizontal row of small boxes ending with one
  empty input box. Pressing Enter in the input box commits the term and creates a new empty box
  to its right, separated by a non-editable "OR" label.
- **FR-005a**: On commit, a term whose trimmed text contains a space MUST be wrapped in
  quotation marks; a term without a space MUST NOT be quoted.
- **FR-005b**: A single click on a quotation mark MUST remove that term's quotes without
  entering edit mode.
- **FR-005c**: Users MUST be able to edit a committed term (click its text) and remove it; on
  Enter after editing, the quoting rule in FR-005a is re-applied.
- **FR-005d**: Pressing "Search" MUST first commit any pending text in every arm's input box,
  applying FR-005a, so the query matches what is on screen.
- **FR-005e**: What is shown in the term box MUST be exactly what is sent to PubMed.
- **FR-006**: Empty arms MUST be allowed on screen and MUST be ignored when building the query.
- **FR-007**: The system MUST build the query as each non-empty arm wrapped in parentheses, with
  its terms joined by " OR ", and arms joined by " AND ". The query text MUST be visible to the
  researcher before and after running.
- **FR-008**: On "Search", the system MUST retrieve from PubMed the total number of records for
  the query.
- **FR-009**: For the same run, the system MUST also retrieve the total for the query with one
  additional arm containing only `"meta-analysis"`, including the double quotes and with no
  field tag, appended as `AND ("meta-analysis")`.
- **FR-010**: Each completed run MUST add one history row containing: date and time of the run
  (day, month, year, hour and minute, in the researcher's local time), the exact query text,
  the result count, and the result count with the meta-analysis arm.
- **FR-011**: The history MUST also keep the arms and terms of each run so the strategy can be
  loaded back into the editor.
- **FR-012**: History rows MUST be listed newest first and MUST NOT be overwritten by later
  runs.
- **FR-013**: A failed count MUST be stored and shown as "Error" with the reason available, and
  MUST never be shown as a number.
- **FR-014**: History and the strategy in progress MUST persist across page reloads on the same
  device and browser until the accounts feature moves them to the user's account.
- **FR-015**: Users MUST be able to delete a single history row and clear all history, with a
  confirmation before clearing all.
- **FR-016**: The system MUST respect PubMed usage limits so that normal use by one researcher
  does not get blocked; if limited, the researcher sees a message to retry shortly.
- **FR-017**: The page MUST state that counts come from PubMed at the time of the run and can
  change as PubMed is updated.
- **FR-018**: All interface text MUST be in English and kept separate from logic so it can be
  translated later. The AND and OR operators are always shown in English, since they are PubMed
  syntax.
- **FR-019**: Each history row MUST have a "Copy" button that copies its exact query text to
  the clipboard and shows a brief confirmation. File export of history is out of scope for this
  feature.
- **FR-020**: Search MUST be disabled while any term has unbalanced parentheses or an odd number
  of quotation marks, and the invalid term MUST be marked with an explanation.
- **FR-021**: The page MUST offer an empty box where a prior strategy can be pasted. "Fill arms"
  MUST turn groups joined by AND into arms and the OR-joined terms of each group into term boxes,
  keeping every term exactly as written (quotes, truncation, field tags). If the current arms
  contain terms, the researcher confirms first. Strategies with NOT, groups inside groups, AND
  and OR mixed without parentheses, or unbalanced quotes or parentheses MUST show an explanation
  and import nothing.
- **FR-022**: The query text in the search panel and each history row's strategy MUST be a link
  that opens the PubMed website search for that exact query in a new tab.
- **FR-023**: The page MUST offer a "Known studies" panel with three DOI boxes by default; boxes
  can be added and removed, and at least one always remains. A box accepts a bare DOI, a
  doi.org link, or a `doi:` prefix. Each non-empty box is checked with the strategy plus an extra
  arm containing only that DOI (`<query> AND ("<doi>"[doi])`), after every completed Search and
  from a "Check studies" button that does not add a history row. Checks run one at a time
  through the request throttle. Each study shows exactly one outcome, carried by an icon and
  text, not by color alone: **Found by the strategy** (count above 0, green with a check),
  **Not found by the strategy** (count 0 while the DOI alone retrieves a PubMed record, red with
  an X), or Unresolved: **DOI not found in PubMed** (the DOI alone retrieves nothing), **Not a
  valid DOI** (no request made), or **Error** with the reason. Unresolved MUST NOT be reported as
  not found (Constitution Principle IV). A result is shown only while its box text and the
  strategy query are unchanged. A summary reads "Found N of M studies.", where M counts found and
  not found studies only, and lists Unresolved studies separately. Study inputs are kept in the
  saved draft.

### Key Entities

- **Arm**: An ordered block of the strategy. Holds an ordered list of terms combined with OR.
  May be empty.
- **Term**: A committed text entry inside an arm, shown and sent exactly as displayed, with a
  quoted or unquoted state.
- **Strategy**: The ordered list of arms. Produces the query text by joining non-empty arms
  with AND.
- **Search run (history row)**: One execution of a strategy. Holds run date and time, the
  strategy snapshot (arms and terms), the query text, the result count or error, and the
  meta-analysis result count or error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A researcher can build a 3-arm strategy with at least 2 terms per arm and get both
  counts in under 2 minutes on first use, without instructions.
- **SC-002**: For 20 test strategies, both counts match the counts PubMed's website shows for
  the same query text at the same time in 100% of cases.
- **SC-003**: Both counts appear within 5 seconds of pressing "Search" in at least 95% of runs
  under normal network conditions.
- **SC-004**: 100% of completed runs appear in the history after a page reload.
- **SC-005**: No failed request is ever displayed or stored as a numeric count.

## Assumptions

- This feature targets Constitution Delivery Phase A: a local version for testing, with no
  accounts and no hosting. History is kept in the browser. Phase B (Vercel + Supabase accounts)
  moves existing history into the signed-in account.
- Checking whether specific studies (DOI or link) are retrieved is a separate, later feature
  of the retrieval check. This feature covers counts and history only.
- Translation to other databases and synonym help are out of scope.
- Apart from the automatic quoting of multi-word terms, no field tags or MeSH mapping are added.
  Unquoted single words get PubMed's normal automatic term mapping.
- Leaving a box without pressing Enter keeps the typed text pending; pressing Search commits all
  pending text first (FR-005d).
- The meta-analysis arm is the quoted phrase `"meta-analysis"`, not the Publication Type filter.
  A filter-based variant can be added later.
- There is no "NOT" operator in this feature.
- Date and time are shown in the researcher's local time zone, to the minute.
- File export of history (required for reporting by Constitution Principle VI) is deferred to
  the accounts/projects feature; this feature provides per-row copy only.
- One strategy is edited at a time; multiple named projects come with the accounts feature.
