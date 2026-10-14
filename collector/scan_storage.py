#!/usr/bin/env python3
"""Estimate per-member /blue/du.j usage from each member's top-level folder.

Lustre only lets a user read their own quota, so this daily scan is the
fallback for members who have not installed report_storage.sh. It can only
see what group permissions allow, so totals are marked incomplete (a lower
bound) whenever any directory could not be read. Paths are never published.
"""
import concurrent.futures
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import pwd
import subprocess
import time

from publish_github_snapshot import read_report

BASE = Path(__file__).resolve().parent
ROOT = Path("/blue/du.j")
OUTPUT = BASE / "state" / "storage-scan.json"
REPORTS = BASE / "storage-reports"
WORKERS = int(os.environ.get("SLURM_CPUS_PER_TASK", "4")) * 2


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def du(path):
    """Return (KiB, complete) for one path; du keeps counting past unreadable subtrees."""
    result = subprocess.run(["du", "-skx", "--", str(path)], capture_output=True, text=True)
    lines = result.stdout.strip().splitlines()
    kib = int(lines[-1].split("\t", 1)[0]) if lines else 0
    return kib, result.returncode == 0


def self_reporters():
    """Members with exact quota data (accepted self-reports, plus the publisher's owner, whose
    quota the publisher reads directly); scanning them would be redundant."""
    reporters = {result[0] for result in map(read_report, REPORTS.glob("*.json")) if result}
    return reporters | {pwd.getpwuid(os.getuid()).pw_name}


def scan_member(folder, pool):
    try:
        children = list(os.scandir(folder))
    except OSError:
        return None, False
    kib, complete, futures = 4, True, []
    for child in children:
        try:
            if child.is_dir(follow_symlinks=False):
                futures.append(pool.submit(du, child.path))
            else:
                kib += child.stat(follow_symlinks=False).st_blocks // 2
        except OSError:  # removed or unreadable mid-scan
            complete = False
    for future in futures:
        size, ok = future.result()
        kib += size
        complete = complete and ok
    return kib, complete


def main():
    OUTPUT.parent.mkdir(exist_ok=True)
    with (BASE / "scan.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Another scan is active; skipping")
            return
        started = time.time()
        members = []
        skip = self_reporters()
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for entry in sorted(os.scandir(ROOT), key=lambda e: e.name):
                if not entry.is_dir(follow_symlinks=False):
                    continue
                try:
                    owner = pwd.getpwuid(entry.stat(follow_symlinks=False).st_uid).pw_name
                except (KeyError, OSError):
                    continue
                if owner in skip:
                    print(f"{owner}: skipped (self-reported)", flush=True)
                    continue
                kib, complete = scan_member(entry.path, pool)
                members.append({"user": owner, "kbytes": kib, "complete": complete})
                print(f"{owner}: {kib} KiB complete={complete}", flush=True)
        payload = {"scanned_at": now(), "duration_s": round(time.time() - started), "members": members}
        temporary = OUTPUT.with_suffix(".tmp")
        temporary.write_text(json.dumps(payload, indent=1) + "\n")
        temporary.replace(OUTPUT)
        print(f"SCANNED in {payload['duration_s']}s")


if __name__ == "__main__":
    main()
