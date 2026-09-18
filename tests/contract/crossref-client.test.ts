import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CROSSREF_WORKS_URL, createCrossrefClient } from '../../src/crossref/client';

const fixtureDir = resolve(__dirname, '../fixtures/crossref');
const fixture = (name: string) => readFileSync(resolve(fixtureDir, `${name}.json`), 'utf8');

const EMAIL = 'contact@example.org';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

function setup(responses: (() => Promise<Response>)[], email = EMAIL) {
  const fetchFn = vi.fn<FetchFn>();
  for (const r of responses) fetchFn.mockImplementationOnce(r);
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  const client = createCrossrefClient({
    fetchFn,
    email,
    sleep,
    throttle: { schedule: (fn) => fn() },
  });
  return { client, fetchFn, sleep };
}

/** A recorded fixture with some message fields replaced or removed. */
function edited(name: string, change: (message: Record<string, unknown>) => void): string {
  const body = JSON.parse(fixture(name)) as { message: Record<string, unknown> };
  change(body.message);
  return JSON.stringify(body);
}

describe('fetchStudyLabel (Crossref works, FR-024)', () => {
  const cases: [string, string, string, string, number][] = [
    ['akcay-2021', '10.1016/j.clinimag.2021.02.026', 'Akcay, 2021', 'Akcay', 2021],
    ['gong-2024', '10.1002/jmri.29184', 'Gong, 2024', 'Gong', 2024],
    ['elshewy-2024', '10.1186/s43055-023-01181-z', 'Elshewy, 2024', 'Elshewy', 2024],
    ['zhang-2025', '10.1007/s00261-024-04788-6', 'Zhang, 2025', 'Zhang', 2025],
    ['yu-2024', '10.1002/jmri.29103', 'Yu, 2024', 'Yu', 2024],
  ];

  it.each(cases)('%s gives the recorded label', async (name, doi, label, family, year) => {
    const { client } = setup([async () => response(fixture(name))]);
    await expect(client.fetchStudyLabel(doi)).resolves.toEqual({
      status: 'ok',
      label,
      family,
      year,
    });
  });

  it('builds the works URL with a path-safe DOI and the mailto parameter', async () => {
    const { client, fetchFn } = setup([async () => response(fixture('elshewy-2024'))]);
    await client.fetchStudyLabel('10.1186/s43055-023-01181-z');
    const raw = String(fetchFn.mock.calls[0]?.[0]);
    expect(raw.startsWith(`${CROSSREF_WORKS_URL}/10.1186%2Fs43055-023-01181-z?`)).toBe(true);
    expect(new URL(raw).searchParams.get('mailto')).toBe(EMAIL);
  });

  it('omits mailto when no contact email is set', async () => {
    const { client, fetchFn } = setup([async () => response(fixture('gong-2024'))], ' ');
    await client.fetchStudyLabel('10.1002/jmri.29184');
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe(`${CROSSREF_WORKS_URL}/10.1002%2Fjmri.29184`);
  });

  it('reads the contact email at request time from a getter (FR-025)', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => response(fixture('gong-2024')));
    let email = '';
    const client = createCrossrefClient({
      fetchFn,
      email: () => email,
      throttle: { schedule: (fn) => fn() },
    });
    await client.fetchStudyLabel('10.1002/jmri.29184');
    email = ' visitor@example.org ';
    await client.fetchStudyLabel('10.1002/jmri.29184');
    const urls = fetchFn.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toBe(`${CROSSREF_WORKS_URL}/10.1002%2Fjmri.29184`);
    expect(new URL(urls[1] ?? '').searchParams.get('mailto')).toBe('visitor@example.org');
  });

  it('prefers the print year over the online year (Yu: online 2023, print 2024)', async () => {
    const { client } = setup([async () => response(fixture('yu-2024'))]);
    await expect(client.fetchStudyLabel('10.1002/jmri.29103')).resolves.toMatchObject({
      year: 2024,
    });
  });

  it('uses the online year when there is no print date (Zhang)', async () => {
    const { client } = setup([async () => response(fixture('zhang-2025'))]);
    await expect(client.fetchStudyLabel('10.1007/s00261-024-04788-6')).resolves.toMatchObject({
      label: 'Zhang, 2025',
    });
  });

  it('falls back to published, then issued', async () => {
    const published = edited('akcay-2021', (m) => {
      delete m['published-print'];
      m.published = { 'date-parts': [[2019, 5]] };
      m.issued = { 'date-parts': [[2018]] };
    });
    const issued = edited('akcay-2021', (m) => {
      delete m['published-print'];
      delete m.published;
      m.issued = { 'date-parts': [[2018]] };
    });
    const { client } = setup([async () => response(published), async () => response(issued)]);
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toMatchObject({ label: 'Akcay, 2019' });
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toMatchObject({ label: 'Akcay, 2018' });
  });

  it('gives only the name when every year is missing', async () => {
    const body = edited('akcay-2021', (m) => {
      delete m['published-print'];
      delete m.published;
      m.issued = { 'date-parts': [[null]] };
    });
    const { client } = setup([async () => response(body)]);
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toEqual({
      status: 'ok',
      label: 'Akcay',
      family: 'Akcay',
      year: null,
    });
  });

  it('falls back to the author name when family is missing', async () => {
    const body = edited('gong-2024', (m) => {
      m.author = [{ name: 'CONSORT Group', sequence: 'first' }];
    });
    const { client } = setup([async () => response(body)]);
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toMatchObject({
      status: 'ok',
      label: 'CONSORT Group, 2024',
    });
  });

  it('is an error when there is no author name', async () => {
    const body = edited('gong-2024', (m) => {
      delete m.author;
    });
    const { client } = setup([async () => response(body)]);
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toMatchObject({ status: 'error' });
  });

  it('HTTP 404 is an error without retry', async () => {
    const { client, fetchFn } = setup([async () => response('Resource not found.', 404)]);
    await expect(client.fetchStudyLabel('10.1/missing')).resolves.toMatchObject({
      status: 'error',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries 429 and 5xx at most twice', async () => {
    const ok = setup([
      async () => response('', 429),
      async () => response('', 503),
      async () => response(fixture('gong-2024')),
    ]);
    await expect(ok.client.fetchStudyLabel('10.1002/jmri.29184')).resolves.toMatchObject({
      label: 'Gong, 2024',
    });
    expect(ok.fetchFn).toHaveBeenCalledTimes(3);
    expect(ok.sleep).toHaveBeenCalledTimes(2);

    const busy = setup([
      async () => response('', 429),
      async () => response('', 429),
      async () => response('', 429),
      async () => response(fixture('gong-2024')),
    ]);
    await expect(busy.client.fetchStudyLabel('10.1002/jmri.29184')).resolves.toMatchObject({
      status: 'error',
    });
    expect(busy.fetchFn).toHaveBeenCalledTimes(3);
  });

  it('malformed JSON is an error', async () => {
    const { client } = setup([async () => response('{not json')]);
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toMatchObject({ status: 'error' });
  });

  it('never throws on network failure or a throwing throttle', async () => {
    const { client } = setup([
      async () => {
        throw new TypeError('Failed to fetch');
      },
    ]);
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toMatchObject({ status: 'error' });

    const broken = createCrossrefClient({
      fetchFn: vi.fn<FetchFn>(),
      email: EMAIL,
      throttle: {
        schedule: () => {
          throw new Error('boom');
        },
      },
    });
    await expect(broken.fetchStudyLabel('10.1/a')).resolves.toMatchObject({ status: 'error' });
  });

  it('times out and reports an error', async () => {
    const fetchFn = vi.fn<FetchFn>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')));
        }),
    );
    const client = createCrossrefClient({
      fetchFn,
      email: EMAIL,
      timeoutMs: 5,
      throttle: { schedule: (fn) => fn() },
    });
    await expect(client.fetchStudyLabel('10.1/a')).resolves.toMatchObject({ status: 'error' });
  });
});
