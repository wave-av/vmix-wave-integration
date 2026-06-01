/**
 * vMix HTTP API client — single point of contact with the vMix process.
 *
 * Surface:
 *   getStatus()           full snapshot (inputs, active/preview, recording/streaming flags)
 *   invokeFunction(name)  pass-through to GET /api/?Function=...&...
 *   setTitleText(args)    write a string into a vMix Title field
 *
 * Boundaries:
 *   - Every call is bounded by `FETCH_TIMEOUT_MS` (vMix sometimes hangs on
 *     OS-level audio device enumeration; without a timeout the companion
 *     becomes unresponsive).
 *   - XML parsing is delegated to fast-xml-parser, then validated by Zod
 *     into a stable shape so consumers don't depend on parser quirks.
 *   - Function names are checked against an allowlist before being forwarded;
 *     vMix's HTTP API will happily execute anything it knows, so the
 *     companion narrows the surface to a curated set.
 */

import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

const FETCH_TIMEOUT_MS = 2_000;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // vMix XML always uses <inputs><input ...></input></inputs>; ensure single
  // elements still come back as arrays so consumers can iterate uniformly.
  isArray: (name) => name === 'input' || name === 'transition' || name === 'overlay',
});

const VmixInputSchema = z.object({
  '@_key': z.string().optional(),
  '@_number': z.union([z.string(), z.number()]).optional(),
  '@_type': z.string().optional(),
  '@_title': z.string().optional(),
  '@_state': z.string().optional(),
  '#text': z.string().optional(),
});

const VmixRawSchema = z.object({
  '@_version': z.string().optional(),
  version: z.string().optional(),
  active: z.union([z.string(), z.number()]).optional(),
  preview: z.union([z.string(), z.number()]).optional(),
  recording: z.union([z.string(), z.boolean()]).optional(),
  streaming: z.union([z.string(), z.boolean()]).optional(),
  inputs: z
    .object({
      input: z.array(VmixInputSchema).optional(),
    })
    .optional(),
});

export interface VmixInput {
  number: number | null;
  key: string | null;
  type: string | null;
  title: string | null;
  state: string | null;
}

export interface VmixStatus {
  version: string | null;
  active: number | null;
  preview: number | null;
  recording: boolean;
  streaming: boolean;
  inputs: VmixInput[];
}

/** Curated vMix functions the companion is willing to invoke. */
export const ALLOWED_VMIX_FUNCTIONS = new Set([
  'Cut', 'Fade', 'Stinger1', 'Stinger2', 'Wipe',
  'StartStreaming', 'StopStreaming',
  'StartRecording', 'StopRecording',
  'PreviewInput', 'ActiveInput',
  'OverlayInput1On', 'OverlayInput1Off',
  'OverlayInput2On', 'OverlayInput2Off',
  'SetText',
]);

export class VmixError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'VmixError';
  }
}

function intOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.floor(v) : null;
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : null;
  }
  return null;
}

function truthyXmlBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return false;
}

export function parseVmixXml(xml: string): VmixStatus {
  const parsed = xmlParser.parse(xml) as { vmix?: unknown };
  // fast-xml-parser collapses self-closing / empty elements to '' instead of {};
  // normalize so the schema only ever sees an object.
  const root = typeof parsed.vmix === 'object' && parsed.vmix !== null ? parsed.vmix : {};
  const raw = VmixRawSchema.parse(root);
  const inputs = (raw.inputs?.input ?? []).map((i): VmixInput => ({
    number: intOrNull(i['@_number']),
    key: i['@_key'] ?? null,
    type: i['@_type'] ?? null,
    title: i['@_title'] ?? null,
    state: i['@_state'] ?? null,
  }));
  return {
    version: raw['@_version'] ?? raw.version ?? null,
    active: intOrNull(raw.active),
    preview: intOrNull(raw.preview),
    recording: truthyXmlBool(raw.recording),
    streaming: truthyXmlBool(raw.streaming),
    inputs,
  };
}

export class VmixClient {
  constructor(private readonly base: string) {}

  async getStatus(signal?: AbortSignal): Promise<VmixStatus> {
    const res = await this.fetchVmix('', signal);
    return parseVmixXml(res);
  }

  async invokeFunction(
    fn: string,
    params: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<void> {
    if (!ALLOWED_VMIX_FUNCTIONS.has(fn)) {
      throw new VmixError(`function not allowlisted: ${fn}`);
    }
    const qs = new URLSearchParams({ Function: fn, ...params }).toString();
    await this.fetchVmix(qs, signal);
  }

  /**
   * Write a string into a vMix Title field. `input` may be the input
   * number, key, or title-text-match. `field` is the Title field selector
   * exposed by vMix (e.g. `Headline.Text`).
   */
  async setTitleText(
    args: { input: string; field: string; value: string },
    signal?: AbortSignal,
  ): Promise<void> {
    await this.invokeFunction(
      'SetText',
      { Input: args.input, SelectedName: args.field, Value: args.value },
      signal,
    );
  }

  private async fetchVmix(query: string, outer?: AbortSignal): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const onOuterAbort = (): void => controller.abort();
    outer?.addEventListener('abort', onOuterAbort, { once: true });
    try {
      const url = query
        ? `${this.base}/api/?${query}`
        : `${this.base}/api/?Function=`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new VmixError(`vmix http ${res.status}`, res.status);
      return await res.text();
    } catch (err) {
      if (err instanceof VmixError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new VmixError('vmix request timeout');
      }
      throw new VmixError(`vmix request failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  }
}
