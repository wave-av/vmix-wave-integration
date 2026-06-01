/**
 * server route tests — mocks fetch (the underlying vMix request) and exercises
 * each HTTP endpoint via supertest. No real vMix needed; no real socket bind.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from './server.js';

afterEach(() => vi.restoreAllMocks());

describe('GET /health', () => {
  it('returns ok + the bound vmix/wave-desktop hosts', async () => {
    const res = await request(buildApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.vmix_host).toMatch(/^http:\/\//);
  });
});

describe('GET /v1/vmix/status', () => {
  it('parses upstream XML into the structured response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(`<vmix version="1.2"><active>3</active></vmix>`, { status: 200 }),
        ),
    );
    const res = await request(buildApp()).get('/v1/vmix/status');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.2');
    expect(res.body.active).toBe(3);
  });

  it('502s when vmix is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNREFUSED')),
    );
    const res = await request(buildApp()).get('/v1/vmix/status');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/vmix request failed|ECONNREFUSED/);
  });
});

describe('POST /v1/vmix/function', () => {
  it('rejects non-allowlisted function names with 400', async () => {
    const res = await request(buildApp())
      .post('/v1/vmix/function')
      .send({ name: 'FormatHardDrive' });
    expect(res.status).toBe(400);
  });

  it('forwards allowlisted functions to vmix', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await request(buildApp())
      .post('/v1/vmix/function')
      .send({ name: 'Cut' });
    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall) throw new Error('fetch was not called');
    const calledUrl = String(firstCall[0]);
    expect(calledUrl).toContain('Function=Cut');
  });
});

describe('POST /v1/vmix/title-update', () => {
  it('rejects oversized values', async () => {
    const res = await request(buildApp())
      .post('/v1/vmix/title-update')
      .send({ input: '1', field: 'X', value: 'a'.repeat(3000) });
    expect(res.status).toBe(400);
  });

  it('translates into a SetText invocation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await request(buildApp())
      .post('/v1/vmix/title-update')
      .send({ input: '2', field: 'Headline.Text', value: 'On Air' });
    expect(res.status).toBe(204);
    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall) throw new Error('fetch was not called');
    const calledUrl = String(firstCall[0]);
    expect(calledUrl).toContain('Function=SetText');
    expect(calledUrl).toContain('Value=On+Air');
  });
});
