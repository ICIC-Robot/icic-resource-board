# ICIC Resource Board

English | [中文](README.zh-CN.md)

[Open the live dashboard](https://icic-robot.github.io/icic-resource-board/)

ICIC Resource Board is a public, read-only view of the `du.j` group's shared UF HiPerGator allocation, Slurm queue, and `/blue/du.j` storage usage. It helps group members see current demand, understand shared QOS headroom, and choose a reasonable time and resource request for their next job.

The board is independent of UF and does not replace Slurm as the source of truth.

## Read-only boundary

The board cannot submit, cancel, requeue, prioritize, or modify any HiPerGator job. It also cannot change accounts, QOS limits, partitions, reservations, or allocations. The collector only reads scheduler information and publishes a bounded snapshot for display.

The public snapshot includes usernames, job names and IDs, requested resources, job states, scheduling windows, and per-member storage totals. It excludes node names, commands, working directories, environment variables, credentials, and unrecognized Slurm fields. No UF password, SSH key, or login session is collected by the website.

## How it runs

1. HiPerGator Slurm `scrontab` starts `duj-github-snapshot` every five minutes.
2. Each run requests 1 CPU, 512 MiB (0.5 GiB) of memory, no GPU, and at most two minutes in `hpg-dev`.
3. The collector reads the `du.j` Slurm queue and QOS, 7-day `sacct` history, per-partition `sinfo` availability, and `/blue/du.j` quotas (about 2–3 s in total), then creates a public `status.json` snapshot (about 20 KB).
4. A repository-scoped GitHub deploy key pushes the snapshot to the `data` branch.
5. GitHub Pages serves the dashboard from `main`. A visitor's browser checks the snapshot every two minutes and caches the last successful copy.

The publishing job itself appears briefly in the queue because it is an ordinary Slurm job. It does not run continuously and does not reserve a GPU.

### Storage collection

Lustre lets each user read only their own quota, so per-member storage comes from two sources:

| Source | How | Shown as |
| --- | --- | --- |
| Group total | `lfs quota -p` on the `/blue/du.j` project, every five minutes | exact |
| Publisher owner | the publisher runs as jinjiaguo, so it reads that account's `lfs quota -u` directly every five minutes | **exact** |
| Self-report (opt-in) | the member's own scrontab runs a private copy of `report_storage.sh` (in `~/.local/bin`) every 3 hours and writes their own `lfs quota -u` total to `storage-reports/<uid>.json` | **exact** |
| Daily scan (fallback) | `scan_storage.py` runs `du` over each member's top-level folder at 04:30 (`hpg-default`, 4 CPU, 2 GiB, ≤ 3 h) | **scan**, or **≥ partial scan** when some subfolders are unreadable to the group, or **folder not readable** |

Anything not attributed to a member is shown as **Unattributed** (group total − counted members), which mostly reflects unreadable folders. Only totals and file counts are published, never paths. The publisher accepts a self-report only when the file is owned by the user it describes.

To share your exact usage, run this once on HiPerGator (`--uninstall` stops it):

```bash
/blue/du.j/jinjiaguo/duj-github-snapshot/report_storage.sh --install
```

The collector sources are versioned in [`collector/`](collector/) and deployed to `/blue/du.j/jinjiaguo/duj-github-snapshot/`.

## Reading the board

### Sync status and source badge

The header shows the snapshot generation time, not the time when you opened the page. **Live snapshot** means live GitHub data, **Browser cache** means the last successful copy saved by your browser, and **Preview data** is demonstration data rather than the live queue. A delayed or stale badge means the numbers should not be used for scheduling decisions until the feed recovers.

### Resource overview

- **CPU cores, Memory, and GPUs** show resources allocated to running group jobs against the shared QOS ceiling. Each bar is split by member (colors match the member list); the hatched extension is queued demand.
- **Storage** shows `/blue/du.j` usage against the group quota, split by member and Unattributed.
- Cards are flagged **Near limit** at 85% and **At limit** when full. The remaining value is QOS headroom, not a promise that physical nodes are immediately available.

Allocation is not utilization. A job may hold four GPUs while using them poorly; this board reports the four allocated GPUs. Use job logs and node-level tools for utilization analysis.

### Members

One row per member with running/pending jobs, allocated CPU, memory, and GPU, and storage with its source tag. Click a column header to sort, and click a member to filter the job list to them.

### Next expected start

This panel shows the pending job with the nearest reported estimated start, together with its expected end. Slurm estimates can move when priorities, reservations, dependencies, job durations, or cluster availability change. Treat the countdown as planning guidance, not a reservation guarantee.

### Queued requests

These totals are the CPU, memory, and GPU capacity requested by pending group jobs. They are demand waiting in line, not resources already consumed. A large queued total suggests more contention and potentially longer waits.

### QOS envelope

- **Group TRES** is the reported shared ceiling for CPU, memory, and GPU requests.
- **Maximum wall time** is the longest permitted requested runtime under the QOS.
- **Submitted jobs / user** is the reported per-user submission ceiling.

Partition policies, reservations, account associations, and physical cluster availability can impose additional constraints, so QOS headroom alone does not guarantee that a new job can start.

### Cluster right now

Physically free GPUs (and idle CPU cores on `hpg-default`) per partition across all HiPerGator users, from `sinfo`, aggregated so node names are never published. **Up to N on one node** matters for multi-GPU jobs: a job requesting 8 GPUs on one node cannot use 14 free cards spread two per node. Nodes that are down, draining, or in maintenance are not counted.

### Can my job start?

Enter a GPU type, GPU count, CPUs, memory, and time. The planner checks, in order: the QOS ceiling and wall-time limit (a request above them never starts), current group headroom (and, if the group is at its limit, when enough would free up if running jobs used their full time limits), group demand already queued, and whether a single node on that partition has enough free GPUs or cores. Inputs are remembered in your browser. It is guidance only; Slurm priority and backfill decide the real order.

The chart below it shows the group's allocated GPUs over the next 24 hours assuming running jobs use their full time limits, so it is a worst case. Jobs usually finish earlier.

### Jobs

Identical requests from the same member (for example array tasks) are grouped into one row with a `×N` count; **Show IDs** expands the individual job IDs. Timing shows how long until a running job ends or a pending job is expected to start. Slurm reason codes are translated into plain language; hover to see the original code.

- **Running** means Slurm has allocated the requested resources.
- **Pending** means the job is waiting; read the detail to understand why.
- **Scheduled** means a job set to start later (`--begin` or scrontab). It is not counted as queued demand.
- Times and reasons are snapshots and may change at the next scheduler update.

### Last 7 days

From `sacct`, including finished jobs: the hourly-average GPU (or CPU) in use against the QOS limit, GPU/CPU-hours per day stacked by member, and per-member totals with finished-job count and failure rate (failed, timeout, out-of-memory, or node-fail ÷ finished). Hover the charts for details. Use the GPU/CPU toggle to switch.

### Storage trend

The publisher keeps one storage point every ~6 hours for 90 days on HiPerGator. Once there is about a day of history, the storage panel shows the average growth per day over the last week and the estimated days until the quota is full.

### Links and sharing

Filters are kept in the URL, so a link such as `?member=xianyao.li&filter=pending&lang=zh` opens the same view.

## How to use the information

Before submitting a job:

1. Confirm that the header says it synced recently and the footer badge says **Live snapshot** and the synchronization time is recent. If it is delayed, check HiPerGator directly.
2. Compare your CPU, memory, GPU, and wall-time request with the QOS envelope. A request outside those limits needs to be changed before submission.
3. Look at current allocation and queued demand together. When the relevant resource is near its shared ceiling or already heavily queued, expect a wait and coordinate with the current allocation owners when timing matters.
4. Check GPU types instead of relying only on the total GPU count when your job requires a specific model.
5. Use **Can my job start?** and **Next expected start** for rough timing only. Slurm, not the board, makes the final scheduling decision.
6. Check **Cluster right now** for whether a single node can fit your GPU count.

After submitting, find your job in **Jobs**. Its state and reason are more useful than the aggregate totals for diagnosing that specific job. Use HiPerGator's own commands and documentation when you need authoritative or more detailed information.

## License

MIT
