#!/usr/bin/env python3
"""Publish an allowlisted du.j Slurm snapshot using a disposable checkout."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import tempfile
import time
from zoneinfo import ZoneInfo

BASE = Path(__file__).resolve().parent
REPO = "git@github.com:ICIC-Robot/icic-resource-board.git"
STORAGE_ROOT = "/blue/du.j"
REPORTS = BASE / "storage-reports"
SCAN = BASE / "state" / "storage-scan.json"
REPORT_MAX_AGE = 2 * 86400
HISTORY = BASE / "state" / "storage-history.json"
HISTORY_STEP = 6 * 3600 - 300
HISTORY_KEEP = 90 * 86400
LOCAL = ZoneInfo("America/New_York")
USAGE_DAYS = 7
# Partitions shown in the cluster availability panel; GPU type is read from sinfo.
PARTITIONS = ["hpg-b200", "hpg-rtx6000", "hpg-turin", "hpg-default"]
UP_STATES = {"idle", "mix", "alloc"}
QOS_MAIN, QOS_BURST = "du.j", "du.j-b"
# The board's own scrontab jobs: shown apart so they never read as someone's work.
SYSTEM_JOBS = {"duj-github-snapshot", "duj-storage-scan", "duj-snapshot-watchdog"}
# Why a pending job waits, grouped by what it means for the rest of the group.
PENDING_CLASSES = [
    ("scheduled", ("BeginTime",)),                                   # --begin / scrontab: not waiting for resources
    ("throttled", ("JobArrayTaskLimit",)),                           # the array's own %N limit: takes no group headroom
    ("dependency", ("Dependency",)),
    ("held", ("JobHeld",)),
    ("group_limit", ("QOSGrp", "AssocGrp")),                         # prefix match: the group ceiling is full
    ("user_limit", ("QOSMaxJobsPerUser", "QOSMaxSubmitJob", "AssocMaxJobs")),
    ("cluster", ("Resources", "Priority", "ReqNodeNotAvail", "Reservation", "PartitionNodeLimit",
                 "Nodes_required", "BadConstraints")),                # needs free nodes / other users' jobs first
]
# Probe requests for start estimates (sbatch --test-only submits nothing).
PROBES = [
    {"id": "b200-1", "partition": "hpg-b200", "qos": QOS_MAIN, "gpus": "b200:1", "cpu": 8, "mem": "64G", "time": "04:00:00"},
    {"id": "rtx6000-1", "partition": "hpg-rtx6000", "qos": QOS_MAIN, "gpus": "rtx_pro_6000:1", "cpu": 8, "mem": "64G", "time": "04:00:00"},
    {"id": "l4-1", "partition": "hpg-turin", "qos": QOS_MAIN, "gpus": "l4:1", "cpu": 4, "mem": "32G", "time": "04:00:00"},
    {"id": "cpu-8", "partition": "hpg-default", "qos": QOS_MAIN, "gpus": None, "cpu": 8, "mem": "32G", "time": "04:00:00"},
    {"id": "cpu-8-burst", "partition": "hpg-default", "qos": QOS_BURST, "gpus": None, "cpu": 8, "mem": "32G", "time": "04:00:00"},
]
SSH = "ssh -i /home/jinjiaguo/.ssh/icic-resource-board-publisher -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15"

def run(args, cwd=None, timeout=25, env=None):
    return subprocess.check_output(args, cwd=cwd, text=True, timeout=timeout, env=env)

def number(value):
    if isinstance(value, dict):
        return value.get("number", 0) if value.get("set") and not value.get("infinite") else 0
    return value or 0

def timestamp(value):
    n = number(value)
    return dt.datetime.fromtimestamp(n, dt.timezone.utc).isoformat().replace("+00:00", "Z") if n else None

def memory(value):
    m = re.fullmatch(r"([\d.]+)([KMGT]?)", str(value), re.I)
    if not m:
        raise ValueError("Unrecognized memory value")
    return float(m[1]) * {"": 1/1024, "K": 1/1024**2, "M": 1/1024, "G": 1, "T": 1024}[m[2].upper()]

def resources(tres):
    fields = dict(part.split("=", 1) for part in (tres or "").split(",") if "=" in part)
    types = {k.split(":", 1)[1].upper(): int(v) for k, v in fields.items() if k.startswith("gres/gpu:")}
    return {"cpu": float(fields.get("cpu", 0)), "memory_gb": memory(fields.get("mem", "0")),
            "gpu": int(fields.get("gres/gpu", sum(types.values()))), "gpu_types": types}

def task_count(task_string):
    if not task_string:
        return 1
    text = task_string.split("%", 1)[0].strip("[]")
    count = 0
    for part in text.split(","):
        m = re.fullmatch(r"(\d+)(?:-(\d+)(?::(\d+))?)?", part)
        if not m:
            raise ValueError("Unrecognized array range")
        count += (int(m[2]) - int(m[1])) // int(m[3] or 1) + 1 if m[2] else 1
    return count

def add(total, res, count):
    for key in ("cpu", "memory_gb", "gpu"):
        total[key] += res[key] * count
    for kind, n in res["gpu_types"].items():
        total["gpu_types"][kind] = total["gpu_types"].get(kind, 0) + n * count

def empty():
    return {"cpu": 0, "memory_gb": 0, "gpu": 0, "gpu_types": {}}

def gib(kib):
    return round(kib / 1024**2, 2)

def parse_time(value):
    return dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).timestamp()

def read_report(path, now=None):
    """Validate one self-report named <uid>.json; return (user, report) or None.

    The reports directory is group-writable, so never follow links or block on special
    files, and only trust a file whose owner uid matches its name.
    """
    now = now or time.time()
    try:
        uid = int(path.stem)
        fd = os.open(str(path), os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except (ValueError, OSError):
        return None
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != uid or info.st_size > 4096:
            return None
        raw = os.read(fd, 4097)
    except OSError:
        return None
    finally:
        os.close(fd)
    try:
        user = pwd.getpwuid(uid).pw_name
        data = json.loads(raw)
        if not isinstance(data, dict) or data.get("user") != user or not isinstance(data.get("measured_at"), str):
            return None
        measured = parse_time(data["measured_at"])
        kib, files = data.get("kbytes"), data.get("files")
        if not all(type(v) is int and 0 <= v < 2**53 for v in (kib, files)):
            return None
        if measured > now + 300 or now - measured > REPORT_MAX_AGE:
            return None
    except (KeyError, ValueError, TypeError, OverflowError):
        return None
    return user, {"kbytes": kib, "files": files, "measured_at": timestamp(measured)}

def self_reports():
    """Exact usage that members chose to share (see read_report for the trust rules)."""
    reports = {}
    for path in REPORTS.glob("*.json"):
        result = read_report(path)
        if result:
            reports[result[0]] = result[1]
    return reports

def own_quota():
    """The publisher runs as its owner, so it can read that one member's exact quota directly."""
    user = pwd.getpwuid(os.getuid()).pw_name
    tokens = run(["lfs", "quota", "-q", "-u", user, STORAGE_ROOT]).replace("*", "").split()
    fields = tokens[tokens.index(STORAGE_ROOT) + 1:]
    return user, {"kbytes": int(fields[0]), "files": int(fields[4]), "measured_at": timestamp(time.time())}

def storage():
    project = run(["lfs", "project", "-d", STORAGE_ROOT]).split()[0]
    tokens = run(["lfs", "quota", "-q", "-p", project, STORAGE_ROOT]).replace("*", "").split()
    fields = tokens[tokens.index(STORAGE_ROOT) + 1:]
    used, quota, files = int(fields[0]), int(fields[1]), int(fields[4])
    members = {}
    scanned_at = None
    if SCAN.exists():
        scan = json.loads(SCAN.read_text())
        scanned_at = scan["scanned_at"]
        for entry in scan["members"]:
            member = members.setdefault(entry["user"], {"user": entry["user"], "kbytes": 0, "files": None,
                                                        "source": "scan", "complete": True, "measured_at": scanned_at})
            if entry["kbytes"] is None:
                member["kbytes"], member["complete"], member["source"] = None, False, "unreadable"
            elif member["kbytes"] is not None:
                member["kbytes"] += entry["kbytes"]
                member["complete"] = member["complete"] and entry["complete"]
    reports = self_reports()
    user, report = own_quota()
    reports[user] = report
    for user, report in reports.items():
        members[user] = {"user": user, "source": "quota", "complete": True, **report}
    attributed = sum(m["kbytes"] or 0 for m in members.values())
    rows = []
    for member in members.values():
        kib = member.pop("kbytes")
        member["used_gb"] = gib(kib) if kib is not None else None
        rows.append(member)
    rows.sort(key=lambda m: (-(m["used_gb"] or 0), m["user"]))
    return {"filesystem": "blue2", "path": STORAGE_ROOT, "measured_at": timestamp(time.time()),
            "used_gb": gib(used), "quota_gb": gib(quota) if quota else None, "files": files,
            "unattributed_gb": gib(max(0, used - attributed)), "scanned_at": scanned_at, "members": rows}

def storage_history(summary):
    """Keep one storage point every ~6 hours for 90 days on HiPerGator; publish it for trend lines."""
    history = json.loads(HISTORY.read_text()) if HISTORY.exists() else []
    now = time.time()
    if not history or now - parse_time(history[-1]["t"]) >= HISTORY_STEP:
        history.append({"t": dt.datetime.fromtimestamp(int(now), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "used_gb": summary["used_gb"],
                        "members": {m["user"]: m["used_gb"] for m in summary["members"] if m["used_gb"] is not None}})
        history = [point for point in history if now - parse_time(point["t"]) <= HISTORY_KEEP]
        HISTORY.parent.mkdir(exist_ok=True)
        temporary = HISTORY.with_suffix(".tmp")
        temporary.write_text(json.dumps(history, separators=(",", ":")) + "\n")
        temporary.replace(HISTORY)
    return [{"t": point["t"], "used_gb": point["used_gb"]} for point in history]

def cluster():
    """Physical availability per partition, aggregated so node names never leave HiPerGator."""
    out = run(["sinfo", "-h", "-N", "-p", ",".join(PARTITIONS), "-O",
               "Partition:40,Gres:120,GresUsed:160,StateCompact:20,CPUsState:40,Memory:20,AllocMem:20"])
    partitions = {}
    for line in out.splitlines():
        fields = line.split()
        if len(fields) != 7:
            continue
        name, gres, used, node_state, cpus, memory_mb, alloc_mb = fields
        name = name.rstrip("*")
        part = partitions.setdefault(name, {"partition": name, "gpu_type": None, "nodes": 0, "nodes_up": 0,
                                            "gpu_total": 0, "gpu_free": 0, "max_gpu_free_node": 0,
                                            "cpu_total": 0, "cpu_idle": 0, "max_cpu_free_node": 0})
        part["nodes"] += 1
        total_match = re.search(r"gpu:([^:(]+):(\d+)", gres)
        used_match = re.search(r"gpu:([^:(]+):(\d+)", used)
        if total_match:
            part["gpu_type"] = total_match[1].upper()
        base = re.sub(r"[^a-z]", "", node_state)
        if base not in UP_STATES or re.search(r"[*~#!%$@^]", node_state):
            continue
        part["nodes_up"] += 1
        allocated_cpu, idle_cpu, _, total_cpu = (int(x) for x in cpus.split("/"))
        part["cpu_total"] += total_cpu
        part["cpu_idle"] += idle_cpu
        part["max_cpu_free_node"] = max(part["max_cpu_free_node"], idle_cpu)
        if total_match:
            free = int(total_match[2]) - (int(used_match[2]) if used_match else 0)
            part["gpu_total"] += int(total_match[2])
            part["gpu_free"] += max(0, free)
            part["max_gpu_free_node"] = max(part["max_gpu_free_node"], free)
    return [partitions[name] for name in PARTITIONS if name in partitions]

def contention(partitions, ref_priority):
    """Pending demand per partition from all users (aggregated: no users, jobs or nodes leave
    HiPerGator). Only jobs waiting for Resources/Priority compete for free capacity; "ahead"
    counts those whose priority is at least ref_priority, roughly what a new du.j job gets
    (burst jobs have far lower priority, so for them everything pending is ahead)."""
    names = [p["partition"] for p in partitions]
    out = run_retry(["squeue", "-h", "-t", "PD", "-p", ",".join(names), "-O",
                     "Partition:60,Reason:40,PriorityLong:14,tres-alloc:200"], timeout=40)
    stats = {name: {"pending_jobs": 0, "pending_gpu": 0, "pending_gpu_ahead": 0, "pending_cpu": 0, "pending_cpu_ahead": 0}
             for name in names}
    for line in out.splitlines():
        parts, reason, priority, tres = line[:60].strip(), line[60:100].strip(), line[100:114].strip(), line[114:].strip()
        if reason not in ("Resources", "Priority") or not priority.isdigit():
            continue
        gpu = re.search(r"gres/gpu=(\d+)", tres)
        cpu = re.search(r"(?:^|,)cpu=(\d+)", tres)
        gpus, cpus = int(gpu[1]) if gpu else 0, int(cpu[1]) if cpu else 0
        ahead = ref_priority is None or int(priority) >= ref_priority
        for name in parts.split(","):  # a multi-partition job is counted on each (conservative)
            if name in stats:
                entry = stats[name]
                entry["pending_jobs"] += 1
                entry["pending_gpu"] += gpus
                entry["pending_cpu"] += cpus
                if ahead:
                    entry["pending_gpu_ahead"] += gpus
                    entry["pending_cpu_ahead"] += cpus
    for part in partitions:
        part.update(stats.get(part["partition"], {}))
        part["ref_priority"] = ref_priority

def sacct_time(value, fallback):
    """sacct runs with SLURM_TIME_FORMAT=%s, so times are unambiguous epoch seconds."""
    return int(value) if value.isdigit() and int(value) > 0 else fallback

def usage():
    """GPU/CPU hours for the last USAGE_DAYS from sacct: hourly group curve, daily per member, totals."""
    now = time.time()
    start_hour = (int(now) // 3600 - USAGE_DAYS * 24 + 1) * 3600
    out = run(["sacct", "-a", "-A", "du.j", "-X", "-n", "-P", "-S", dt.datetime.fromtimestamp(start_hour, LOCAL).strftime("%Y-%m-%dT%H:%M:%S"),
               "-E", "now", "--format=User,State,Start,End,AllocTRES"], timeout=40,
              env={**os.environ, "SLURM_TIME_FORMAT": "%s", "TZ": "America/New_York"})
    hours = (int(now) // 3600 + 1) * 3600
    count = (hours - start_hour) // 3600
    gpu_curve, cpu_curve = [0.0] * count, [0.0] * count
    daily, members = {}, {}
    failed_states = ("FAILED", "TIMEOUT", "OUT_OF_MEMORY", "NODE_FAIL", "BOOT_FAIL", "DEADLINE")
    for line in out.splitlines():
        parts = line.split("|")
        if len(parts) != 5 or not parts[0]:
            continue
        user, job_state, begin, end, tres = parts
        fields = dict(item.split("=", 1) for item in tres.split(",") if "=" in item)
        gpus, cpus = int(fields.get("gres/gpu", 0)), float(fields.get("cpu", 0))
        begin, end_time = sacct_time(begin, None), sacct_time(end, now)
        member = members.setdefault(user, {"user": user, "gpu_hours": 0.0, "cpu_hours": 0.0,
                                           "finished": 0, "completed": 0, "failed": 0, "cancelled": 0})
        if sacct_time(end, 0) >= start_hour:
            member["finished"] += 1
            word = job_state.split()[0]
            if word == "COMPLETED":
                member["completed"] += 1
            elif word in failed_states:
                member["failed"] += 1
            elif word == "CANCELLED":
                member["cancelled"] += 1
        if begin is None:
            continue
        lo, hi = max(begin, start_hour), min(end_time, now)
        if hi <= lo:
            continue
        member["gpu_hours"] += gpus * (hi - lo) / 3600
        member["cpu_hours"] += cpus * (hi - lo) / 3600
        cursor = lo
        while cursor < hi:
            bucket = int(cursor - start_hour) // 3600
            step = min(hi, start_hour + (bucket + 1) * 3600) - cursor
            gpu_curve[bucket] += gpus * step / 3600
            cpu_curve[bucket] += cpus * step / 3600
            day = dt.datetime.fromtimestamp(cursor, LOCAL).strftime("%Y-%m-%d")
            entry = daily.setdefault(day, {}).setdefault(user, [0.0, 0.0])
            entry[0] += gpus * step / 3600
            entry[1] += cpus * step / 3600
            cursor += step
    elapsed = max(1, now - (hours - 3600))  # the current hour is partial: report its average so far
    gpu_curve[-1] *= 3600 / elapsed
    cpu_curve[-1] *= 3600 / elapsed
    rows = []
    for member in members.values():
        member["gpu_hours"], member["cpu_hours"] = round(member["gpu_hours"], 1), round(member["cpu_hours"], 1)
        if member["gpu_hours"] or member["cpu_hours"] or member["finished"]:
            rows.append(member)
    rows.sort(key=lambda m: (-m["gpu_hours"], -m["cpu_hours"], m["user"]))
    return {"window_days": USAGE_DAYS, "start": timestamp(start_hour), "hour_seconds": 3600,
            "gpu_in_use": [round(x, 2) for x in gpu_curve], "cpu_in_use": [round(x, 1) for x in cpu_curve],
            "daily": [{"date": day, "members": {u: {"gpu_hours": round(v[0], 1), "cpu_hours": round(v[1], 1)} for u, v in users.items()}}
                      for day, users in sorted(daily.items())],
            "members": rows}

def optional(name, function):
    """Extra panels must never block the queue snapshot."""
    try:
        return function()
    except Exception as error:
        print(name.upper() + "_ERROR", type(error).__name__, error, file=sys.stderr)
        return None

def run_retry(args, tries=2, timeout=60, pause=10):
    """A Slurm query that the controller may answer slowly (the 25 s default timed out on 2026-10-17 while the
    controller was busy); the job's five-minute limit leaves room for two attempts of one minute."""
    for attempt in range(tries):
        try:
            return run(args, timeout=timeout)
        except subprocess.TimeoutExpired:
            if attempt == tries - 1:
                raise
            print("RETRY", " ".join(args), file=sys.stderr)
            time.sleep(pause)

def pending_class(reason):
    for name, codes in PENDING_CLASSES:
        if any(reason.startswith(code) for code in codes):
            return name
    return "other"

def qos_limits(name):
    rows = run(["sacctmgr", "-nP", "show", "qos", name, "format=Name,GrpTRES,MaxWall,MaxJobsPU,MaxSubmitJobsPU,Priority"]).strip().splitlines()
    if len(rows) != 1 or rows[0].split("|")[0] != name:
        raise RuntimeError("Unexpected QOS " + name)
    _, tres, wall, maxjobs, maxsubmit, priority = rows[0].split("|")[:6]
    limits = resources(tres)
    limits.pop("gpu_types")
    limits.update(max_running_jobs_per_user=int(maxjobs) if maxjobs.isdigit() else None,
                  max_submitted_jobs_per_user=int(maxsubmit) if maxsubmit.isdigit() else None, max_wall=wall,
                  priority=int(priority) if priority.isdigit() else None)
    return limits

def estimates():
    """Slurm's own start estimate for a few standard requests, made as the publisher's user."""
    out = []
    env = {**os.environ, "TZ": "America/New_York"}
    for probe in PROBES:
        args = ["sbatch", "--test-only", "--account=du.j", f"--qos={probe['qos']}", f"--partition={probe['partition']}",
                f"--cpus-per-task={probe['cpu']}", f"--mem={probe['mem']}", f"--time={probe['time']}", "--wrap=true"]
        if probe["gpus"]:
            args.insert(-1, f"--gpus={probe['gpus']}")
        entry = {k: probe[k] for k in ("id", "partition", "qos", "gpus", "cpu", "mem", "time")}
        try:
            text = subprocess.run(args, text=True, capture_output=True, timeout=20, env=env).stderr
            match = re.search(r"to start at (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)", text)
            if match:
                local = dt.datetime.strptime(match[1], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=LOCAL)
                entry["start_time"] = timestamp(max(local.timestamp(), time.time()))
            else:
                entry["error"] = (text.strip().splitlines() or ["no estimate"])[-1][:160]
        except subprocess.TimeoutExpired:
            entry["error"] = "timeout"
        out.append(entry)
    return {"measured_at": timestamp(time.time()), "as_user": pwd.getpwuid(os.getuid()).pw_name, "probes": out}

def collect():
    raw = json.loads(run_retry(["squeue", "-A", "du.j", "--json"]))
    if raw.get("errors"):
        raise RuntimeError("Slurm reported queue errors")
    limits = {QOS_MAIN: qos_limits(QOS_MAIN), QOS_BURST: optional("burst_qos", lambda: qos_limits(QOS_BURST))}
    by_qos = {q: {"allocated": empty(), "running_jobs": 0} for q in limits}
    classes = {name: {"tasks": 0, **empty()} for name, _ in PENDING_CLASSES + [("other", ())]}
    users, jobs, system = {}, [], empty()
    array_running, array_rows = {}, []
    for source in raw["jobs"]:
        if source.get("account") != "du.j":
            continue
        state = source["job_state"]
        state = state[0] if isinstance(state, list) else state
        if state not in ("RUNNING", "PENDING", "COMPLETING", "CONFIGURING", "SUSPENDED"):
            continue
        res = resources(source.get("tres_alloc_str") if state != "PENDING" else source.get("tres_req_str"))
        if not source.get("tres_alloc_str") and state != "PENDING":
            res = resources(source.get("tres_req_str"))
        if not res["gpu_types"]:
            # Slurm sometimes omits typed GPU TRES; allocated device detail (running) or the
            # typed request (pending) supplies the model without exposing nodes or devices.
            kinds = {}
            for detail in source.get("gres_detail") or []:
                match = re.match(r"gpu:([^:()]+):(\d+)", detail)
                if match:
                    kinds[match[1].upper()] = kinds.get(match[1].upper(), 0) + int(match[2])
            if not kinds:
                for item in re.finditer(r"gres/gpu:([^:,]+):(\d+)", (source.get("tres_per_job") or "") + "," + (source.get("tres_per_node") or "")):
                    kinds[item[1].upper()] = kinds.get(item[1].upper(), 0) + int(item[2])
            if kinds and sum(kinds.values()) == res["gpu"]:
                res["gpu_types"] = kinds
        count = task_count(source.get("array_task_string"))
        jobid = str(source["job_id"])
        array_id = number(source.get("array_job_id"))
        task_id = source.get("array_task_id", {})
        if array_id:
            jobid = str(array_id)
            if source.get("array_task_string"):
                jobid += "_" + source["array_task_string"]
            elif isinstance(task_id, dict) and task_id.get("set"):
                jobid += "_" + str(number(task_id))
        qos = source.get("qos") or QOS_MAIN
        reason = source.get("state_reason", "")
        label = ", ".join(f"{v}× {k}" for k, v in res["gpu_types"].items()) or (f"{res['gpu']}× GPU" if res["gpu"] else "")
        job = {"job_id": jobid, "array_id": str(array_id) if array_id else None, "user": source["user_name"],
               "name": source["name"], "qos": qos, "system": source["name"] in SYSTEM_JOBS,
               "partition": source["partition"], "state": state, "reason": reason,
               "pending_class": pending_class(reason) if state == "PENDING" else None,
               "array_throttle": number(source.get("array_max_tasks")) or None,
               "task_count": count, "cpu": res["cpu"], "memory_gb": res["memory_gb"], "gpus": res["gpu"],
               "gpu_types": res["gpu_types"], "gpu_label": label, "submit_time": timestamp(source.get("submit_time")),
               "start_time": timestamp(source.get("start_time")), "end_time": timestamp(source.get("end_time")),
               "time_limit_minutes": number(source.get("time_limit"))}
        jobs.append(job)
        user = users.setdefault(job["user"], dict(user=job["user"], running_jobs=0, pending_jobs=0, burst=empty(), **empty())) \
            if not job["system"] else {}
        if state == "PENDING":
            if job["pending_class"] != "scheduled" and not job["system"]:
                user["pending_jobs"] += count
            if job["pending_class"] == "throttled" and array_id:
                array_rows.append(job)
            else:
                add(classes[job["pending_class"]], res, count)
                classes[job["pending_class"]]["tasks"] += count
        else:
            if array_id:
                array_running[str(array_id)] = array_running.get(str(array_id), 0) + count
            bucket = by_qos.setdefault(qos, {"allocated": empty(), "running_jobs": 0})
            bucket["running_jobs"] += count
            add(bucket["allocated"], res, count)
            if job["system"]:
                add(system, res, count)
            else:
                user["running_jobs"] += count
                add(user if qos != QOS_BURST else user["burst"], res, count)
    # An array waiting on its own %N throttle starts a task only when one of its running tasks
    # ends, so it adds no demand on the group while its slots are full.
    for job in array_rows:
        running_now = array_running.get(job["array_id"], 0)
        slots = max(0, (job["array_throttle"] or job["task_count"]) - running_now)
        job["array_running"], job["array_free_slots"] = running_now, min(slots, job["task_count"])
        res = {"cpu": job["cpu"], "memory_gb": job["memory_gb"], "gpu": job["gpus"], "gpu_types": job["gpu_types"]}
        classes["throttled"]["tasks"] += job["task_count"]
        add(classes["throttled"], res, job["task_count"])
        add(classes["cluster"], res, job["array_free_slots"])  # free slots compete like any pending job
        classes["cluster"]["tasks"] += job["array_free_slots"]
    jobs.sort(key=lambda j: (j["system"], j["state"] != "RUNNING", j["job_id"]))
    now_ts = timestamp(time.time())
    candidates = [j for j in jobs if j["state"] == "PENDING" and j["pending_class"] not in ("scheduled", "throttled")
                  and not j["system"] and j["start_time"] and j["start_time"] > now_ts]
    next_job = min(candidates, key=lambda j: j["start_time"]) if candidates else None
    now = now_ts
    main = by_qos[QOS_MAIN]
    # Priority a new du.j job would roughly get: the lowest among the group's current main-QOS jobs
    # (age only raises it later; hpg-dev has its own boost). None if the group has no such job.
    priorities = [number(source.get("priority")) for source in raw["jobs"] if source.get("account") == "du.j"
                  and (source.get("qos") or QOS_MAIN) == QOS_MAIN and source.get("name") not in SYSTEM_JOBS
                  and source.get("partition") != "hpg-dev" and number(source.get("priority"))]
    ref_priority = min(priorities) if priorities else None
    partitions = optional("cluster", cluster)
    if partitions:
        optional("contention", lambda: contention(partitions, ref_priority))
    competing = empty()
    for name in ("cluster", "group_limit"):
        add(competing, classes[name], 1)
    storage_summary = optional("storage", storage)
    if storage_summary:
        storage_summary["history"] = optional("storage_history", lambda: storage_history(storage_summary)) or []
    return {"schema_version": 2, "visibility": "public", "account": "du.j", "generated_at": now,
            "slurm_last_update": timestamp(raw.get("last_update")) or now, "publish_every_s": 300,
            "summary": {"running_jobs": main["running_jobs"], "pending_jobs": sum(c["tasks"] for k, c in classes.items() if k != "scheduled"),
                        "allocated": main["allocated"], "queued": competing, "limits": limits[QOS_MAIN],
                        "gpu_types": main["allocated"]["gpu_types"]},
            "qos": {name: {"limits": limits[name], **by_qos.get(name, {"allocated": empty(), "running_jobs": 0})}
                    for name in limits if limits[name]},
            "pending": classes, "system": system,
            "next_start": {"job_id": next_job["job_id"], "name": next_job["name"], "user": next_job["user"], "gpu": next_job["gpu_label"],
                           "start_time": next_job["start_time"], "end_time": next_job["end_time"]} if next_job else None,
            "users": sorted(users.values(), key=lambda u: (-u["gpu"], u["user"])), "jobs": jobs, "storage": storage_summary,
            "cluster": partitions, "estimates": optional("estimates", estimates),
            "usage": optional("usage", usage), "stale": False,
            "disclosure": {"identities": "visible", "node_names": "excluded", "commands": "excluded", "credentials": "excluded",
                           "storage": "per-member totals only; paths excluded"}}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    with (BASE / "publisher.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Another publisher is active; skipping")
            return
        snapshot = collect()
        if args.dry_run:
            print(json.dumps(snapshot, separators=(",", ":")))
            return
        # The checkout is unique per invocation and cleaned on success or failure.
        temp_root = BASE / "tmp"
        temp_root.mkdir(exist_ok=True)
        os.environ["GIT_SSH_COMMAND"] = SSH
        with tempfile.TemporaryDirectory(prefix="snapshot-", dir=temp_root) as temporary:
            checkout = Path(temporary) / "checkout"
            run(["git", "clone", "--depth", "1", "--single-branch", "--branch", "data", REPO, str(checkout)])
            run(["git", "config", "user.name", "ICIC Resource Snapshot"], cwd=checkout)
            run(["git", "config", "user.email", "icic-resource-snapshot@users.noreply.github.com"], cwd=checkout)
            (checkout / "status.json").write_text(json.dumps(snapshot, separators=(",", ":")) + "\n")
            run(["git", "add", "--", "status.json"], cwd=checkout)
            run(["git", "commit", "-m", "Publish resource snapshot " + snapshot["generated_at"]], cwd=checkout)
            run(["git", "push", "origin", "HEAD:data"], cwd=checkout)
            print("PUBLISHED " + snapshot["generated_at"])
        print("TEMP_CHECKOUT_CLEANED")
        # Bound scheduler logs without touching source/configuration files.
        for log in [*(BASE / "logs").glob("github-publish-*.log"), *(BASE / "logs").glob("storage-scan-*.log")]:
            if log.stat().st_mtime < time.time() - 7 * 86400:
                log.unlink()

if __name__ == "__main__":
    main()
