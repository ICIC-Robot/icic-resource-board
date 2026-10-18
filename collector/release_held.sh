#!/bin/bash
# Watchdog for the scrontab entries of the board. Slurm retrieves the user's login environment when it launches a
# scrontab job; if that retrieval fails or times out (a slow controller or home filesystem), the job is "aborted,
# requeued and held" (sbatch(1), --get-user-env) and never runs again by itself, and scontrol cannot release scrontab
# jobs. Re-registering the scrontab replaces the held job with a fresh one. Observed 2026-10-17: duj-github-snapshot
# held for 1 h 45 min with Restarts=885. Runs from the duj-snapshot-watchdog entry of snapshot.scrontab.
set -u
me=$(id -un)
held=$(squeue -u "$me" -h -o "%j %r" | grep -E "^duj-(github-snapshot|storage-scan) " | grep -ci "held" || true)
if [ "${held:-0}" -gt 0 ]; then
  tmp=$(mktemp)
  if scrontab -l > "$tmp" && scrontab "$tmp"; then
    echo "$(date -Is) re-registered the scrontab: $held held job(s)"
  else
    echo "$(date -Is) FAILED to re-register the scrontab ($held held job(s))"
  fi
  rm -f "$tmp"
else
  echo "$(date -Is) ok"
fi
