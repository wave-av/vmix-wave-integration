# vmix-wave-integration secrets

> **No secret of any kind belongs in this repo.** Operators supply their own
> at install time.

## Runtime

| Secret | Lives where | Set how |
|---|---|---|
| WAVE gateway JWT | wave-desktop's `safeStorage` (Keychain / DPAPI / libsecret) | The companion sidecar **does not** see the raw token; it asks wave-desktop to perform actions and receives presence flags only |
| vMix HTTP API key (optional, vMix 28+) | `companion/.env` (gitignored) under `VMIX_API_KEY` | Operator generates via vMix Settings → Web Controller |

## Build / release

No build-time secrets. CI uses default `GITHUB_TOKEN` for the foundation gate
only.

## Public-facing config (OK to ship)

| Value | Why |
|---|---|
| Default vMix host `http://localhost:8088` | vMix's documented bind |
| Companion port `7724` | Documented in README |
| wave-desktop local-IPC port `7723` | Documented in wave-desktop README |
