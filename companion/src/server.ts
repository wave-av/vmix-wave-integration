/**
 * companion sidecar — localhost-only proxy between vMix HTTP API and
 * wave-desktop IPC. Bound to 127.0.0.1 only; never exposes a LAN surface.
 *
 * Today: skeleton with health endpoint + vMix status fetch stub. Wave 2
 * wires the real vMix XML→JSON path + the wave-desktop POST path.
 */

import express, { type Request, type Response } from 'express';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

const PORT = Number(process.env['COMPANION_PORT'] ?? 7724);
const VMIX_HOST = process.env['VMIX_HOST'] ?? 'http://127.0.0.1:8088';
const WAVE_DESKTOP_BASE = process.env['WAVE_DESKTOP_BASE'] ?? 'http://127.0.0.1:7723';

const VmixStatusSchema = z.object({
  version: z.string(),
  active: z.union([z.string(), z.number()]).optional(),
  preview: z.union([z.string(), z.number()]).optional(),
});
export type VmixStatus = z.infer<typeof VmixStatusSchema>;

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

async function fetchVmixStatus(): Promise<VmixStatus> {
  const res = await fetch(`${VMIX_HOST}/api/?Function=`, { signal: AbortSignal.timeout(2000) });
  if (!res.ok) throw new Error(`vmix ${res.status}`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml) as { vmix?: VmixStatus };
  return VmixStatusSchema.parse(parsed.vmix ?? {});
}

const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, vmix_host: VMIX_HOST, wave_desktop_base: WAVE_DESKTOP_BASE });
});

app.get('/v1/vmix/status', async (_req: Request, res: Response) => {
  try {
    const status = await fetchVmixStatus();
    res.json(status);
  } catch (err) {
    res.status(502).json({ error: String(err instanceof Error ? err.message : err) });
  }
});

// Wave 2: POST /v1/wave/encoder/start  — proxies to wave-desktop IPC.
// Wave 2: POST /v1/vmix/title-update    — pushes encoder status into a vMix Title field.

const server = app.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ msg: 'companion listening', port: PORT, vmix_host: VMIX_HOST }));
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
