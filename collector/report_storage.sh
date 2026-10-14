#!/bin/bash
# Share your own exact /blue/du.j usage with the ICIC Resource Board.
#
# Lustre lets each user read only their own quota, so the board cannot see
# exact per-member usage unless members opt in. This script reads *only your*
# usage (lfs quota -u) and writes a small JSON file that the publisher reads.
#
#   report_storage.sh              write one report now
#   report_storage.sh --install    write now + refresh every 3 hours via scrontab
#   report_storage.sh --uninstall  stop reporting and delete your report
set -euo pipefail

SOURCE=/blue/du.j/jinjiaguo/duj-github-snapshot/report_storage.sh
# The scheduled job runs a private copy in your home directory, so nobody else who can
# write in /blue/du.j can change the code that runs as you.
LOCAL_COPY=$HOME/.local/bin/icic-report-storage.sh
DIR=/blue/du.j/jinjiaguo/duj-github-snapshot/storage-reports
BEGIN="# >>> icic-resource-board storage report >>>"
END="# <<< icic-resource-board storage report <<<"
ME=$(id -un)
# Reports are named by uid so nobody can claim another member's file name first.
REPORT="$DIR/$(id -u).json"
export PATH=/opt/slurm/bin:/usr/bin:/bin

tmp=""
cleanup() { [[ -z $tmp ]] || rm -f "$tmp"; }
trap cleanup EXIT

# Print the current scrontab without our block. Refuse to continue if it cannot be
# read or the block is malformed, so someone's existing entries are never replaced.
current_without_block() {
  local existing errors status=0
  errors=$(mktemp)
  existing=$(scrontab -l 2>"$errors") || status=$?
  if ((status != 0)); then
    if ! grep -qi "no crontab" "$errors"; then
      echo "Cannot read scrontab: $(cat "$errors")" >&2; rm -f "$errors"; exit 1
    fi
    existing=""
  fi
  rm -f "$errors"
  [[ -n $existing ]] || return 0
  local begins ends
  begins=$(grep -cxF "$BEGIN" <<<"$existing" || true)
  ends=$(grep -cxF "$END" <<<"$existing" || true)
  if [[ $begins != "$ends" ]]; then
    echo "Your scrontab has an incomplete '$BEGIN' block; fix it with 'scrontab -e' first." >&2; exit 1
  fi
  awk -v b="$BEGIN" -v e="$END" '$0 == b { skip = 1; next } $0 == e { skip = 0; next } !skip' <<<"$existing"
}

report() {
  local output fields
  output=$(lfs quota -q -u "$ME" /blue/du.j) || { echo "lfs quota failed" >&2; exit 1; }
  read -r -a fields <<<"$(tr -d '*' <<<"$output")"
  if (( ${#fields[@]} < 6 )) || [[ ! ${fields[1]} =~ ^[0-9]+$ || ! ${fields[5]} =~ ^[0-9]+$ ]]; then
    echo "Unexpected lfs quota output: $output" >&2; exit 1
  fi
  tmp=$(mktemp "$DIR/.$ME.XXXXXX")
  printf '{"user":"%s","kbytes":%s,"files":%s,"measured_at":"%s"}\n' \
    "$ME" "${fields[1]}" "${fields[5]}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$tmp"
  chmod 644 "$tmp"
  mv -f "$tmp" "$REPORT"
  tmp=""
  echo "Reported $ME: ${fields[1]} KiB, ${fields[5]} files"
}

case "${1:-}" in
  "")
    report ;;
  --install)
    report
    mkdir -p "$(dirname "$LOCAL_COPY")"
    install -m 700 "$SOURCE" "$LOCAL_COPY"
    tmp=$(mktemp)
    { current_without_block
      cat <<EOF
$BEGIN
#SCRON --account=du.j
#SCRON --qos=du.j
#SCRON --partition=hpg-dev
#SCRON --time=00:01:00
#SCRON --cpus-per-task=1
#SCRON --mem=128M
#SCRON --job-name=duj-storage-report
#SCRON --output=/dev/null
17 */3 * * * $LOCAL_COPY
$END
EOF
    } >"$tmp"
    scrontab "$tmp"
    echo "Installed: your usage will refresh every 3 hours (scrontab -l to inspect)." ;;
  --uninstall)
    tmp=$(mktemp)
    current_without_block >"$tmp"
    scrontab "$tmp"
    rm -f "$REPORT" "$LOCAL_COPY"
    echo "Uninstalled and removed your report." ;;
  *)
    sed -n '2,10p' "$0"; exit 2 ;;
esac
