#!/bin/sh
# Pre-commit guard (§15): refuse 12/24-word mnemonics and raw 32-byte hex secrets in staged files.
files=$(git diff --cached --name-only --diff-filter=ACM | grep -v -E '(pnpm-lock\.yaml|\.snap)$')
[ -z "$files" ] && exit 0
fail=0
for f in $files; do
  [ -f "$f" ] || continue
  if grep -nE '\b([a-z]{3,8} ){11}[a-z]{3,8}\b' "$f" | grep -vE '(//|#|\*)' >/dev/null; then
    echo "possible mnemonic in $f"; fail=1
  fi
  # 32-byte hex is allowed only for known public values (genesis hash, block hashes in docs).
  if grep -noE '0x[0-9a-fA-F]{64}\b' "$f" | grep -viE 'd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd' | grep -vE '^docs/|^spike/state.json' >/dev/null && ! echo "$f" | grep -qE '^(docs/|spike/state\.json|tests/)'; then
    echo "possible raw key (0x + 64 hex) in $f"; fail=1
  fi
done
exit $fail
