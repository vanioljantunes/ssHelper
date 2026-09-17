import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPubmedClient, ESEARCH_URL } from '../../src/pubmed/client';
import type { Throttle } from '../../src/pubmed/throttle';

const fixtureDir = resolve(__dirname, '../fixtures/pubmed');
const fixture = (name: string) => readFileSync(resolve(fixtureDir, name), 'utf8');

const countOk = fixture('count-ok.json');
const notFound = fixture('quoted-phrase-not-found.json');
const rateLimited = fixture('rate-limited.json');
const malformed = fixture('malformed.txt');

const EMAIL = 'contact@example.org';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

function setup(responses: (() => Promise<Response>)[]) {
  const fetchFn = vi.fn<FetchFn>();
  for (const r of responses) fetchFn.mockImplementationOnce(r);
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  const client = createPubmedClient({
    fetchFn,
    email: EMAIL,
    sleep,
    throttle: { schedule: (fn) => fn() },
  });
  return { client, fetchFn, sleep };
}

describe('countQuery (contracts/pubmed-client.md)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds the esearch URL with every required parameter', async () => {
    const { client, fetchFn } = setup([async () => response(countOk)]);
    const query = '("heart failure" OR cardio*) AND ("sglt2 inhibitors"[tiab])';
    await client.countQuery(query);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const raw = String(fetchFn.mock.calls[0]?.[0]);
    const url = new URL(raw);
    expect(`${url.origin}${url.pathname}`).toBe(ESEARCH_URL);
    expect(url.searchParams.get('db')).toBe('pubmed');
    expect(url.searchParams.get('term')).toBe(query);
    expect(url.searchParams.get('retmode')).toBe('json');
    expect(url.searchParams.get('retmax')).toBe('0');
    expect(url.searchParams.get('tool')).toBe('ssHelper');
    expect(url.searchParams.get('email')).toBe(EMAIL);
    expect(raw).not.toContain(' ');
    expect(raw).not.toContain('"');
  });

  it('throws at creation when the contact email is missing', () => {
    expect(() =>
      createPubmedClient({
        fetchFn: vi.fn<FetchFn>(),
        email: '  ',
        throttle: { schedule: (fn) => fn() },
      }),
    ).toThrow(/VITE_NCBI_CONTACT_EMAIL/);
  });

  it('has a contact email configured for the default client', () => {
    expect(import.meta.env.VITE_NCBI_CONTACT_EMAIL).toBeTruthy();
  });

  it('maps a normal response to ok', async () => {
    const { client } = setup([async () => response(countOk)]);
    const expected = JSON.parse(countOk).esearchresult;
    const outcome = await client.countQuery('(diabetes) AND ("meta-analysis")');
    expect(outcome).toEqual({
      status: 'ok',
      count: Number(expected.count),
      queryTranslation: expected.querytranslation,
      warnings: [],
    });
  });

  it('maps a quoted phrase not found to count 0 with the warning, excluding "No items found."', async () => {
    const { client } = setup([async () => response(notFound)]);
    const outcome = await client.countQuery('"zzqxunfoundphrase qqxz"');
    expect(outcome).toEqual({
      status: 'ok',
      count: 0,
      queryTranslation: '"zzqxunfoundphrase qqxz"',
      warnings: ['"zzqxunfoundphrase qqxz"'],
    });
  });

  it('includes errorlist values in warnings', async () => {
    const body = JSON.stringify({
      esearchresult: {
        count: '5',
        querytranslation: 'x',
        errorlist: { phrasesnotfound: ['zzz'], fieldsnotfound: [] },
        warninglist: { outputmessages: ['No items found.'], phrasesignored: ['and'] },
      },
    });
    const { client } = setup([async () => response(body)]);
    const outcome = await client.countQuery('x');
    expect(outcome).toMatchObject({ status: 'ok', count: 5 });
    if (outcome.status === 'ok') expect([...outcome.warnings].sort()).toEqual(['and', 'zzz']);
  });

  it('retries 429 twice with 1 s and 3 s backoff, then gives rate_limited', async () => {
    const { client, fetchFn, sleep } = setup([
      async () => response(rateLimited, 429),
      async () => response(rateLimited, 429),
      async () => response(rateLimited, 429),
    ]);
    const outcome = await client.countQuery('x');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 3000]);
    expect(outcome).toMatchObject({ status: 'error', kind: 'rate_limited' });
  });

  it('treats a 200 body with a rate limit error as rate limited', async () => {
    const { client, fetchFn } = setup([
      async () => response(rateLimited, 200),
      async () => response(countOk),
    ]);
    const outcome = await client.countQuery('x');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(outcome.status).toBe('ok');
  });

  it('recovers when a retry succeeds', async () => {
    const { client } = setup([
      async () => response(rateLimited, 429),
      async () => response(countOk),
    ]);
    expect((await client.countQuery('x')).status).toBe('ok');
  });

  it('retries 5xx twice then gives http', async () => {
    const { client, fetchFn } = setup([
      async () => response('oops', 502),
      async () => response('oops', 503),
      async () => response('oops', 500),
    ]);
    const outcome = await client.countQuery('x');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({ status: 'error', kind: 'http' });
    if (outcome.status === 'error') expect(outcome.message).toContain('500');
  });

  it('does not retry 404', async () => {
    const { client, fetchFn } = setup([async () => response('missing', 404)]);
    const outcome = await client.countQuery('x');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ status: 'error', kind: 'http' });
  });

  it('maps a network failure to network', async () => {
    const { client } = setup([
      async () => {
        throw new TypeError('Failed to fetch');
      },
    ]);
    expect(await client.countQuery('x')).toMatchObject({ status: 'error', kind: 'network' });
  });

  it('maps a 15 s timeout to network', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<FetchFn>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const client = createPubmedClient({
      fetchFn,
      email: EMAIL,
      sleep: async () => {},
      throttle: { schedule: (fn) => fn() },
    });
    let settled = false;
    const pending = client.countQuery('x').then((outcome) => {
      settled = true;
      return outcome;
    });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ status: 'error', kind: 'network' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('maps a non-JSON body to invalid_response', async () => {
    const { client } = setup([async () => response(malformed)]);
    expect(await client.countQuery('x')).toMatchObject({
      status: 'error',
      kind: 'invalid_response',
    });
  });

  it('maps JSON without a count to invalid_response', async () => {
    const { client } = setup([async () => response('{"esearchresult":{}}')]);
    expect(await client.countQuery('x')).toMatchObject({
      status: 'error',
      kind: 'invalid_response',
    });
  });

  it('never throws, even when reading the body fails', async () => {
    const broken = {
      ok: true,
      status: 200,
      text: async () => {
        throw new Error('stream broke');
      },
    } as unknown as Response;
    const { client } = setup([async () => broken]);
    await expect(client.countQuery('x')).resolves.toMatchObject({ status: 'error' });
  });

  it('passes every attempt through the throttle', async () => {
    let scheduled = 0;
    const throttle: Throttle = {
      schedule: (fn) => {
        scheduled += 1;
        return fn();
      },
    };
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(response(rateLimited, 429))
      .mockResolvedValueOnce(response(countOk));
    const client = createPubmedClient({
      fetchFn,
      email: EMAIL,
      sleep: async () => {},
      throttle,
    });
    await client.countQuery('x');
    expect(scheduled).toBe(2);
  });
});
