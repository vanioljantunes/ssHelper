# Contract: User Interface

Single page. All visible strings come from `src/i18n/en.ts`.

## Layout (top to bottom)

1. Landing hero (FR-026): title, subtitle, three feature bullets and a privacy line, with an
   author card and four profile links beside it (stacked below it under 720px).
2. Arms editor: arms stacked vertically; an "AND" label between consecutive arms; "Add arm"
   button below the last arm.
3. Search panel: live query preview (monospace, wraps), "Search" button, both counts after a
   run, PubMed warnings if any, and a notice that counts reflect PubMed at run time (FR-017).
4. History table.

## Arm row

- Header: "Arm N" and a delete control (accessible name "Delete arm N").
- Body: horizontal, wrapping row `[term] OR [term] OR [input]`. "OR" labels are plain text, not
  focusable, not editable.
- The input box is always last and always present.

## Term box interactions

| Action | Result |
|--------|--------|
| Type in input, press Enter | `commitTerm`; term box added before the input; focus stays in input |
| Enter on empty input | Nothing |
| Click a quotation mark of a quoted term | `unquoteTerm`; no edit mode. Quote marks are separate clickable elements named "Remove quotes" |
| Click term text | Edit mode: the text becomes an input with the text selected |
| Enter in edit mode | `commitTerm` re-applied; empty text removes the term |
| Escape in edit mode | Cancel edit |
| Remove control (x) on a term | Term and its neighbouring "OR" removed |
| Backspace in empty input | Nothing (avoids accidental loss) |

Invalid terms (unbalanced parentheses or quotes) are outlined, with a message under the arm;
Search is disabled while any issue exists.

## Search button states

| State | Button | Panel |
|-------|--------|-------|
| All arms empty (no terms, no pending text) | Disabled | "Add at least one term." |
| Validation issue | Disabled | Issue messages |
| Ready | Enabled | Query preview |
| Running | Disabled, progress shown | "Searching PubMed..." |
| Done | Enabled | Results and Results + meta-analysis, or "Error" with reason |

Search auto-commits pending text in all arms before validating.

## History table

Columns: Date and time | Search strategy | Results | Results + meta-analysis | Actions.

- Date and time in local time per browser locale, to the minute (e.g. `16/09/2026 14:05`).
- Counts with thousands separators; errors shown as "Error" with the reason available on hover
  and to screen readers.
- Row actions: Load (asks for confirmation if the current draft has terms), Copy (copies
  `query`, shows "Copied"), Delete.
- "Clear history" button with a confirmation dialog.
- Empty state: "No searches yet."

## Accessibility

- All controls reachable by keyboard, with visible focus.
- Arms, terms, and counts have meaningful accessible names.
- Result updates announced through a polite live region.
