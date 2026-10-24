#!/usr/bin/env bash
# Runs a command with all output written to .cache/test_logs/<name>.log.
# The terminal only gets a short summary, plus the first failure when the command fails.
# Usage: scripts/quiet_run.sh <name> <command> [args...]
set -u

name="$1"
shift
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
log_dir="$repo_root/.cache/test_logs"
log_file="$log_dir/$name.log"
mkdir -p "$log_dir"

"$@" >"$log_file" 2>&1
status=$?

summary_pattern='Tests  |^ *[0-9]+ (passed|failed|flaky|skipped)|[0-9]+ problems?|error TS'

if [ "$status" -eq 0 ]; then
  echo "✔ $name passed (full log: .cache/test_logs/$name.log)"
  grep -E "$summary_pattern" "$log_file" | tail -n 20
else
  echo "✘ $name failed with exit code $status (full log: .cache/test_logs/$name.log)"
  echo "--- first failure ---"
  first_line="$(grep -n -m 1 -E 'FAIL |✘|×|AssertionError|error TS|  error  |Error:|ERR_' "$log_file" | cut -d: -f1)"
  if [ -n "$first_line" ]; then
    tail -n "+$first_line" "$log_file" | head -n 25
  fi
  echo "--- end of log ---"
  tail -n 8 "$log_file"
fi
exit "$status"
