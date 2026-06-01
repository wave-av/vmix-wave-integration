# Contributing to vmix-wave-integration

Thanks. Read this before opening a PR.

## License

MIT (see `LICENSE`). By contributing you agree your contributions are also
MIT-licensed.

## License boundary

This repo contains **no vMix-licensed assets**. vMix is a closed-source
third-party product owned by StudioCoast Pty Ltd. We extend it through its
**documented public APIs only**:

- HTTP API (port 8088)
- Title Scripts (`.vmixscript` text format)
- Web Controller HTML pages
- Title XAML templates (open spec)

Do not commit:
- `vMix.exe` or installers
- Reverse-engineered binary patches
- Closed-format vMix project files (`.vmix`) containing third-party assets
- TestPattern / Watermark assets from vMix sample content

Enforced by the foundation gate's vendor-binary deny-list step.

## Dev setup (companion sidecar)

```sh
cd companion
npm install
npm run type-check
npm run dev   # nodemon-watched dev server on :7724
npm test
```

## PR shape

- Branch off `main`. Name: `feat/<thing>` or `fix/<thing>`.
- One concern per PR.
- Update `CHANGELOG.md`.
- `npm run type-check` must pass.

## Security issues

Open a private GitHub Security Advisory:
<https://github.com/wave-av/vmix-wave-integration/security/advisories/new>.
