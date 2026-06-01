# vmix-wave-integration

**WAVE integration for vMix** — drop these files into your vMix install and your switcher gets first-class WAVE controls: send program to WAVE, automated "Now Live" lower-thirds, and bidirectional sync between vMix's HTTP API and `wave-desktop`.

Layer-0 (Operator) of the [WAVE Protocol Plane][plane].

## What's in the box

| Artifact | Purpose | Install path (Windows) |
|---|---|---|
| `titles/wave-now-live.xaml` | "Now Live on WAVE" lower-third Title preset | `%APPDATA%/vMix/TitleDesigner/` |
| `titles/README.md` | Step-by-step Title-preset creation guide | reference |
| `scripts/start-wave-output.vmixscript` | vMix Title Script — starts streaming to WAVE | `%APPDATA%/vMix/Scripts/` |
| `scripts/stop-wave-output.vmixscript` | counterpart | same |
| `web-controller/index.html` + `wave-bridge.js` | vMix Web Controller page that talks to `wave-desktop`'s local control server | `%APPDATA%/vMix/WebController/wave/` |
| `companion/` | Node 20 sidecar that proxies vMix HTTP API ↔ wave-desktop IPC | runs as a service or via `npm start` |

## Quick start

1. **Install the Titles**: copy `titles/wave-now-live.xaml` to `%APPDATA%/vMix/TitleDesigner/` and add it as an Input.
2. **Install the scripts**: copy `scripts/*.vmixscript` to `%APPDATA%/vMix/Scripts/` and bind them to shortcuts.
3. **Install the Web Controller page**: copy `web-controller/` to `%APPDATA%/vMix/WebController/wave/` and load it inside vMix's Web Controller.
4. **(Optional) Run the companion sidecar** for HTTP bridging:
   ```sh
   cd companion
   npm install
   npm start  # listens on http://localhost:7724
   ```

vMix HTTP API (port 8088 by default) and the companion sidecar talk over localhost only — no traffic leaves the operator's machine until vMix actually pushes to the WAVE gateway.

## Architecture

```
┌── vMix (Windows) ──────────────────────────────┐
│  · HTTP API on :8088                           │
│  · Web Controller HTML pages                   │
│  · Title Scripts + presets                     │
└──────────┬─────────────────────────────────────┘
           │ localhost HTTP/WS
┌──────────▼─────────────────────────────────────┐
│  companion sidecar  (this repo)                │
│  · Express proxy on :7724                      │
│  · vMix XML state ↔ wave-desktop IPC JSON      │
└──────────┬─────────────────────────────────────┘
           │ localhost IPC
┌──────────▼─────────────────────────────────────┐
│  wave-desktop (separate Electron app)          │
│  · Gateway JWT auth, child encoders            │
│  · Sends program feed to WAVE Edge             │
└────────────────────────────────────────────────┘
```

## Supported vMix versions

vMix **28+** (HTTP API stable; Title Scripts supported). Earlier versions may work but are unsupported.

## License posture

MIT-licensed (see `LICENSE`). vMix itself is a third-party closed-source product owned by StudioCoast Pty Ltd; this repo contains **no vMix-licensed binaries or assets** — only configuration text files + scripts that drive vMix's documented public APIs.

## Roadmap

| Wave | Surface | Status |
|---|---|---|
| W1 | This scaffold | shipped |
| W2 | Real `companion/` server: vMix XML poll + curated function allowlist + title-update | **shipped** |
| W3 | Reverse path: wave-desktop encoder status → vMix Title field bindings | pending |
| W4 | Multi-source mapping (vMix Inputs ↔ WAVE stream-keys) | pending |

## Companion HTTP API (W2)

All endpoints are 127.0.0.1-only and wrapped in Helmet's strict CSP.

| Method | Path | Body | Behavior |
|---|---|---|---|
| GET | `/health` | — | liveness + bound vMix/wave-desktop hosts |
| GET | `/v1/vmix/status` | — | structured snapshot: `version`, `active`, `preview`, `recording`, `streaming`, `inputs[]` |
| POST | `/v1/vmix/function` | `{ name, params? }` | invokes a vMix Function — name must be in the curated allowlist (see `companion/src/vmix.ts`) |
| POST | `/v1/vmix/title-update` | `{ input, field, value }` | shorthand for SetText — `value` capped at 2048 chars |

Function allowlist: `Cut`, `Fade`, `Stinger1`/`2`, `Wipe`, `StartStreaming`, `StopStreaming`, `StartRecording`, `StopRecording`, `PreviewInput`, `ActiveInput`, `OverlayInput1On`/`Off`, `OverlayInput2On`/`Off`, `SetText`.

Non-listed functions return 400. vMix exposes hundreds of functions including destructive ones (e.g. `Quit`, `ScriptStop`); the allowlist is intentionally narrow.

Full plan: `~/claude-hub/.claude/plans/wave-on-prem-layer/plan.md` (W5 line).

## Reporting issues

Security: open a private advisory at
<https://github.com/wave-av/vmix-wave-integration/security/advisories/new>.
Other bugs: GitHub Issues.

[plane]: https://github.com/wave-av/wave-foundation/blob/master/frameworks/protocol-plane/README.md
