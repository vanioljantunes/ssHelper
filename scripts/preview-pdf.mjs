/**
 * Renders page one of a PDF written by src/core/pdf.ts to a PNG, so the table layout can be
 * looked at. Development helper: run it with `node scripts/preview-pdf.mjs <out.png>`.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? 'preview.png';
const pdfPath = `${out}.pdf`;

const build = `
import { buildStrategyTablePdf } from '{SRC}';
import { writeFileSync } from 'node:fs';
const rows = [
  { database: 'PubMed', strategy: process.env.Q_PUBMED },
  { database: 'Embase', strategy: process.env.Q_EMBASE },
  { database: 'Cochrane CENTRAL', strategy: process.env.Q_COCHRANE },
];
const bytes = buildStrategyTablePdf(rows, {
  title: 'Search strategies',
  subtitle: 'Exported 2026-10-10',
  columns: { database: 'Database', strategy: 'Search strategy' },
});
writeFileSync(process.env.OUT_PDF, bytes);
`;
const buildFile = join(tmpdir(), 'sshelper-build-pdf.mts');
writeFileSync(
  buildFile,
  build.replace('{SRC}', new URL('../src/core/pdf.ts', import.meta.url).href),
);
execFileSync('npx', ['tsx', buildFile], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    OUT_PDF: pdfPath,
    Q_PUBMED:
      '("Masseter Muscle" OR "Masseter muscle"[mh] OR Mandible OR "Facial Muscles" OR masset* OR "Face Muscle" OR Mandibl* OR Myofac*) AND (Hypertrophy OR hypertrop* OR enlarge* OR thick* OR prominence OR prominent OR "Myofascial Pain Syndromes"[Mesh]) AND ("Botulinum toxin A" OR "Botulinum Toxins, Type A"[Mesh] OR botoxA OR "BoNT-A" OR Oculinum OR Botox)',
    Q_EMBASE:
      "('masseter muscle'/exp OR 'mandible' OR 'face muscle' OR 'masset*' OR 'myofac*') AND ('hypertrophy'/exp OR 'hypertrop*' OR 'enlarge*' OR 'thick*') AND ('botulinum toxin a' OR 'botulinum toxin a'/exp OR 'botoxa' OR 'bont-a' OR 'botox')",
    Q_COCHRANE:
      '("Masseter Muscle" OR Mandible OR "Facial Muscles" OR masset* OR "Face Muscle") AND (Hypertrophy OR hypertrop* OR enlarge* OR thick*) AND ("Botulinum toxin A" OR botoxA OR "BoNT-A" OR Oculinum OR Botox)',
  },
});

rmSync(buildFile, { force: true });
const pdf = readFileSync(pdfPath).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await page.setContent('<canvas id="c"></canvas>');
await page.addScriptTag({
  url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs',
  type: 'module',
});
await page.evaluate(async (data) => {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs';
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const first = await doc.getPage(1);
  const viewport = first.getViewport({ scale: 1.5 });
  const canvas = document.getElementById('c');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await first.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  document.title = `pages:${doc.numPages}`;
}, pdf);
console.log(await page.title());
await page.locator('#c').screenshot({ path: out });
await browser.close();
