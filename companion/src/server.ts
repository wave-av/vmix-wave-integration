/**
 * companion sidecar — localhost-only HTTP bridge between vMix and wave-desktop.
 *
 * Bound to 127.0.0.1 only (never LAN). The web-controller loaded inside vMix
 * calls these endpoints to invoke vMix Functions, push title updates, and
 * read structured status — vMix's own HTTP API is XML-only and runs on a
 * different port, so the companion does the parsing + curates the function
 * allowlist.
 *
 * Security posture:
 *   - 127.0.0.1 bind, NEVER 0.0.0.0
 *   - Helmet on every response (defense-in-depth; even local pages can XSS)
 *   - 64KB JSON body cap
 *   - vMix function calls go through an allowlist (see vmix.ts)
 *   - Every inbound payload is Zod-validated; non-conforming = 400
 */

import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { ALLOWED_VMIX_FUNCTIONS, VmixClient, VmixError } from './vmix.js';

const PORT = Number(process.env['COMPANION_PORT'] ?? 7724);
const VMIX_HOST = process.env['VMIX_HOST'] ?? 'http://127.0.0.1:8088';
const WAVE_DESKTOP_BASE = process.env['WAVE_DESKTOP_BASE'] ?? 'http://127.0.0.1:7723';

const vmix = new VmixClient(VMIX_HOST);

const FunctionRequestSchema = z.object({
  name: z.string().refine((n) => ALLOWED_VMIX_FUNCTIONS.has(n), {
    message: 'function not allowlisted',
  }),
  params: z.record(z.string(), z.string()).optional(),
});

const TitleUpdateSchema = z.object({
  input: z.string().min(1).max(64),
  field: z.string().min(1).max(64),
  value: z.string().max(2048),
});

export function buildApp(): express.Express {
  const app = express();
  // Even localhost HTML can XSS — Helmet sets strict no-cache, frameguard,
  // content-type sniffing protections, etc.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      vmix_host: VMIX_HOST,
      wave_desktop_base: WAVE_DESKTOP_BASE,
      version: '0.2.0',
    });
  });

  app.get('/v1/vmix/status', async (_req: Request, res: Response) => {
    try {
      const status = await vmix.getStatus();
      res.json(status);
    } catch (err: unknown) {
      const code = err instanceof VmixError && err.status ? err.status : 502;
      res.status(code).json({
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  app.post('/v1/vmix/function', async (req: Request, res: Response) => {
    const parsed = FunctionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      await vmix.invokeFunction(parsed.data.name, parsed.data.params);
      res.status(204).end();
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  app.post('/v1/vmix/title-update', async (req: Request, res: Response) => {
    const parsed = TitleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      await vmix.setTitleText(parsed.data);
      res.status(204).end();
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // Catch-all error handler — keeps the process alive on a thrown handler.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ msg: 'companion error', err: String(err) }));
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal' });
  };
  app.use(errorHandler);

  return app;
}

// Only listen when run as the main module — tests import buildApp() directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildApp();
  const server = app.listen(PORT, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        msg: 'companion listening',
        port: PORT,
        vmix_host: VMIX_HOST,
        wave_desktop_base: WAVE_DESKTOP_BASE,
      }),
    );
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}
