import { en } from '../i18n/en';
import './app.css';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>{en.appTitle}</h1>
        <p className="purpose">{en.appPurpose}</p>
      </header>
      <main>
        <section className="panel" aria-labelledby="arms-heading">
          <h2 id="arms-heading">{en.armsHeading}</h2>
        </section>
        <section className="panel" aria-labelledby="search-heading">
          <h2 id="search-heading">{en.searchHeading}</h2>
        </section>
        <section className="panel" aria-labelledby="history-heading">
          <h2 id="history-heading">{en.historyHeading}</h2>
        </section>
      </main>
      <div className="visually-hidden" role="status" aria-live="polite" />
    </div>
  );
}
