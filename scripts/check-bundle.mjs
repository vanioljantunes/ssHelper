// Scans the production build for server secrets that must never reach the client
// (Constitution Principle II). Run after `npm run build`: `npm run check:bundle`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(process.cwd(), 'dist');

const PATTERNS = [
  { name: 'secret key (sk-...)', regex: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'service_role', regex: /service_role/ },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', regex: /SUPABASE_SERVICE_ROLE_KEY/ },
  { name: 'api_key parameter', regex: /api_key=[A-Za-z0-9]{16,}/ },
];

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

let files;
try {
  files = listFiles(DIST);
} catch {
  console.error('check:bundle: dist/ not found. Run `npm run build` first.');
  process.exit(2);
}

const findings = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const { name, regex } of PATTERNS) {
    if (regex.test(text)) findings.push(`${relative(process.cwd(), file)}: ${name}`);
  }
}

if (findings.length > 0) {
  console.error('check:bundle: possible secrets found in the client bundle:');
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}

console.log(`check:bundle: ${files.length} files scanned in dist/, no secrets found.`);
