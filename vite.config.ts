/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const TEST_CONTACT_EMAIL = 'test@example.org';
const nodeHasWebStorage = process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage');

// VITE_NCBI_CONTACT_EMAIL is optional (FR-025): visitors enter their own email in the app. When
// set (for example in .env.local), it only pre-fills that field. Leave it unset for public builds.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const contactEmail = env.VITE_NCBI_CONTACT_EMAIL?.trim() ?? '';

  const liveEnabled = process.env.LIVE_PUBMED === '1';

  return {
    plugins: [react()],
    server: { port: 5180, strictPort: true },
    preview: { port: 5181, strictPort: true },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      exclude: ['node_modules/**', 'tests/e2e/**', ...(liveEnabled ? [] : ['tests/live/**'])],
      passWithNoTests: true,
      // Node 25 exposes an incomplete global localStorage that shadows jsdom's; turn it off.
      pool: 'forks',
      poolOptions: {
        forks: { execArgv: nodeHasWebStorage ? ['--no-experimental-webstorage'] : [] },
      },
      env: {
        VITE_NCBI_CONTACT_EMAIL:
          liveEnabled && contactEmail !== '' ? contactEmail : TEST_CONTACT_EMAIL,
      },
    },
  };
});
