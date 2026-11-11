#!/usr/bin/env bash
# Assert the foundation secret-scan prints file:line only, never the matched
# payload. The scanner must stay fail-closed (non-zero) when it sees a hit.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

fail=0
for f in .github/workflows/_checks.yml .buildkite/scripts/foundation-secret-scan.sh; do
  if grep -qE 'echo "\$HITS"' "$f"; then
    echo "FAIL: $f still echoes unredacted \$HITS"
    fail=1
  fi
  if ! grep -q 'match redacted' "$f"; then
    echo "FAIL: $f is missing redacted file:line output"
    fail=1
  fi
done

# Runtime-constructed marker so this file itself does not match the scan regex.
marker="AKIA$(printf 'Z%.0s' {1..16})"
hits="fixture.txt:1: token ${marker} trailing"
redacted="$(printf '%s\n' "$hits" | sed -E 's/^([^:]+:[0-9]+):.*/\1: «match redacted — open this location to view»/')"
if printf '%s' "$redacted" | grep -q "$marker"; then
  echo "FAIL: redaction left the marker in the output"
  fail=1
fi
if ! printf '%s' "$redacted" | grep -q 'fixture.txt:1:'; then
  echo "FAIL: redaction dropped the file:line locator"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "foundation-secret-scan redaction OK"
