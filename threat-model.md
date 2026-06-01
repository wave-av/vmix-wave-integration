# vmix-wave-integration threat model

## Scope

Localhost-only bridge between vMix's HTTP API and wave-desktop's IPC server.
Runs on the operator's broadcast machine. No internet-facing surface; the
network path to the WAVE gateway lives in wave-desktop, not here.

## Trust boundaries

```
┌── operator's machine ──────────────────────────────────────────┐
│  vMix.exe              companion/        wave-desktop          │
│    ↕ HTTP :8088          ↕ HTTP :7724       ↕ Electron IPC     │
│  ──────────────────────────────────────────────────────────    │
│                                              ↕ TLS + JWT       │
└──────────────────────────────────────────────┼─────────────────┘
                                               ▼
                                       api.wave.online
```

| Boundary | Threat | Defense |
|---|---|---|
| vMix → companion | vMix process compromised → bogus state queries | companion treats all vMix responses as untrusted; Zod-validates the XML→JSON shape; rejects unrecognized fields |
| LAN → companion (loopback only) | LAN attacker hitting :7724 | bind explicit `127.0.0.1`, NOT `0.0.0.0`; documented in companion/server.ts |
| companion → wave-desktop | malicious companion process exfiltrating tokens | companion never receives the raw JWT — wave-desktop exposes only `auth.state()` presence flags + action invokes |
| companion env var `VMIX_API_KEY` exfil | logs leaking API key | structured logger redacts known-secret env vars; CI grep for naïve `console.log(process.env)` |

## Out-of-scope

- Physical access to the operator's machine
- vMix vulnerabilities (third-party — report upstream)
- Browser-side XSS in the Web Controller page (vMix's WebView is the renderer; we send only same-origin static HTML/JS)

## Process

- Threat model is reviewed at every minor version bump
- New endpoints in companion/server.ts MUST update this doc in the same PR
