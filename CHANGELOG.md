# Changelog

All notable changes documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Initial scaffold: vMix Title presets, Title Scripts, Web Controller page, Node companion sidecar
- Companion sidecar: Express skeleton on :7724 bridging vMix HTTP API ↔ wave-desktop IPC
- Foundation chassis: CODEOWNERS, SECRETS.md, foundation-gate workflow, .foundation-version
- threat-model.md enumerating localhost trust boundaries
- public-repo-guard: body-content gate scanning PR/issue/comment bodies (`scripts/public-repo-guard/body-policy.sh` + fixture tests); workflow gains `issues`/`issue_comment` triggers, a dedicated `body-guard` job with per-job concurrency, and an updated checkout pin
