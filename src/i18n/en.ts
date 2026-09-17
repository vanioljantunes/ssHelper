export const en = {
  appTitle: 'ssHelper',
  appPurpose:
    'Build a PubMed search strategy in arms and see how many records it retrieves, with and without a meta-analysis arm.',

  armsHeading: 'Search strategy',
  armLabel: 'Arm {n}',
  deleteArm: 'Delete arm {n}',
  addArm: 'Add arm',
  and: 'AND',
  or: 'OR',
  termInputLabel: 'New term for arm {n}',
  termEditLabel: 'Edit term {term}',
  removeQuotes: 'Remove quotes',
  removeTerm: 'Remove term',
  quoteMark: '"',
  removeTermSymbol: 'x',

  issueUnbalancedParentheses: 'Term {term} has unbalanced parentheses.',
  issueUnbalancedQuotes: 'Term {term} has an odd number of quotation marks.',

  searchHeading: 'Search',
  queryPreviewLabel: 'Query sent to PubMed',
  queryPreviewEmpty: 'No query yet.',
  search: 'Search',
  searching: 'Searching PubMed...',
  needTerm: 'Add at least one term.',
  fixIssues: 'Fix the marked terms before searching.',
  results: 'Results',
  resultsMeta: 'Results + meta-analysis',
  error: 'Error',
  warningsHeading: 'PubMed warnings',
  bothFailed: 'Both PubMed requests failed. No history row was saved.',
  runTimeNotice:
    'Counts come from PubMed at the time of the run and can change as PubMed is updated. They help you develop a strategy; they do not show that it is complete and do not replace peer review of the search.',
  resultsAnnouncement: 'Search finished. Results: {count}. Results + meta-analysis: {meta}.',

  errorRateLimited: 'PubMed is busy. Try again shortly.',
  errorNetwork: 'Could not reach PubMed. Check your connection and try again.',
  errorHttp: 'PubMed returned an error (HTTP {status}).',
  errorInvalidResponse: 'PubMed returned an unexpected response.',

  historyHeading: 'History',
  historyDateTime: 'Date and time',
  historyStrategy: 'Search strategy',
  historyResults: 'Results',
  historyResultsMeta: 'Results + meta-analysis',
  historyActions: 'Actions',
  load: 'Load',
  copy: 'Copy',
  copied: 'Copied',
  delete: 'Delete',
  clearHistory: 'Clear history',
  confirmClearHistory: 'Delete all history rows? This cannot be undone.',
  confirmLoad: 'Replace the current arms with this search? Your current terms will be lost.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  historyEmpty: 'No searches yet.',
  historySaveFailed: 'History could not be saved in this browser.',
} as const;

export type MessageKey = keyof typeof en;

export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
