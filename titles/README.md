# vMix Titles for WAVE

This folder holds Title XAML templates designed to drop into vMix's Title
Designer. Each one shows a different facet of the live WAVE-stream state.

## `wave-now-live.xaml`

A lower-third overlay that displays:

| Field | Bound to (via companion sidecar) |
|---|---|
| `WaveStreamLabel` | `wave-desktop` encoder name |
| `WaveBitrateKbps` | current encoder bitrate, kbps |
| `WaveUptime` | session uptime, mm:ss |
| `WaveStatusDot` | green / yellow / red — connected / connecting / errored |

## How to install (vMix 28+)

1. Copy `wave-now-live.xaml` to `%APPDATA%/vMix/TitleDesigner/`
2. In vMix, `Add Input` → `Title / Xaml Title` → pick `wave-now-live.xaml`
3. Add the new title to a list (e.g., 1×1 list on a virtual layer) so you
   can toggle it with a keystroke
4. Run the companion sidecar (`cd companion && npm start`)
5. The fields update automatically as long as the sidecar is reachable

## Designing your own

vMix Title XAML follows WPF syntax with named `TextBlock` elements binding
to script-set properties. The companion sidecar pushes updates via vMix's
HTTP API `Function=SetText&Input=...&SelectedName=...&Value=...`.

Reference: <https://www.vmix.com/help26/index.htm?Title.html>
