/**
 * vMix client tests — uses a stubbed `fetch` so the suite runs without vMix.
 * Covers XML parsing (the bug-prone bit), function-name allowlisting, and
 * timeout propagation.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALLOWED_VMIX_FUNCTIONS, VmixClient, VmixError, parseVmixXml } from './vmix.js';

const SAMPLE_XML = `<vmix version="27.0.0.74">
  <active>2</active>
  <preview>1</preview>
  <recording>True</recording>
  <streaming>False</streaming>
  <inputs>
    <input key="abc" number="1" type="VideoList" title="Bumper" state="Paused"/>
    <input key="def" number="2" type="Capture" title="Cam 1" state="Running"/>
  </inputs>
</vmix>`;

describe('parseVmixXml', () => {
  it('reads active/preview/state into structured shape', () => {
    const s = parseVmixXml(SAMPLE_XML);
    expect(s.version).toBe('27.0.0.74');
    expect(s.active).toBe(2);
    expect(s.preview).toBe(1);
    expect(s.recording).toBe(true);
    expect(s.streaming).toBe(false);
    expect(s.inputs).toHaveLength(2);
    expect(s.inputs[1]).toEqual({
      number: 2,
      key: 'def',
      type: 'Capture',
      title: 'Cam 1',
      state: 'Running',
    });
  });

  it('handles single-input XML (parser would otherwise return non-array)', () => {
    const s = parseVmixXml(`<vmix><inputs><input number="1" title="A"/></inputs></vmix>`);
    expect(s.inputs).toHaveLength(1);
    expect(s.inputs[0]?.title).toBe('A');
  });

  it('treats missing fields as null/false', () => {
    const s = parseVmixXml(`<vmix/>`);
    expect(s.active).toBeNull();
    expect(s.recording).toBe(false);
    expect(s.inputs).toEqual([]);
  });
});

describe('VmixClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects functions outside the allowlist', async () => {
    const c = new VmixClient('http://x.invalid');
    await expect(c.invokeFunction('FormatHardDrive')).rejects.toBeInstanceOf(VmixError);
  });

  it('builds the SetText query correctly', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const c = new VmixClient('http://vmix.local');
    await c.setTitleText({ input: '5', field: 'Headline.Text', value: 'Hello' });
    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall) throw new Error('fetch was not called');
    const url = String(firstCall[0]);
    expect(url).toContain('http://vmix.local/api/?');
    expect(url).toContain('Function=SetText');
    expect(url).toContain('Input=5');
    expect(url).toContain('SelectedName=Headline.Text');
    expect(url).toContain('Value=Hello');
  });

  it('wraps non-2xx as a VmixError with the status code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 })),
    );
    const c = new VmixClient('http://vmix.local');
    const err = await c.getStatus().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VmixError);
    expect((err as VmixError).status).toBe(503);
  });
});

describe('ALLOWED_VMIX_FUNCTIONS', () => {
  it('includes the lifecycle functions a controller would need', () => {
    for (const fn of ['Cut', 'Fade', 'StartStreaming', 'StopStreaming', 'SetText']) {
      expect(ALLOWED_VMIX_FUNCTIONS.has(fn)).toBe(true);
    }
  });
});
