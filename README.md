# ICIC Resource Board

English | [中文](README.zh-CN.md)

[Open the live dashboard](https://icic-robot.github.io/icic-resource-board/)

ICIC Resource Board is a public, read-only view of the `du.j` group's shared UF HiPerGator allocation, Slurm queue, and `/blue/du.j` storage usage. It helps group members see current demand, understand shared QOS headroom, and choose a reasonable time and resource request for their next job.

The board is independent of UF and does not replace Slurm as the source of truth.

## Read-only boundary

The board cannot submit, cancel, requeue, prioritize, or modify any HiPerGator job. It also cannot change accounts, QOS limits, partitions, reservations, or allocations. The collector only reads scheduler information and publishes a bounded snapshot for display. Start estimates come from `sbatch --test-only`, which makes Slurm compute a hypothetical start time without submitting anything.

The public snapshot includes usernames, job names and IDs, requested resources, job states, scheduling windows, and per-member storage totals. Other groups' pending demand is published only as per-partition totals (GPUs, cores, job counts), with no users or jobs. It excludes node names, commands, working directories, environment variables, credentials, and unrecognized Slurm fields. No UF password, SSH key, or login session is collected by the website.

## How it runs

1. HiPerGator Slurm `scrontab` starts `duj-github-snapshot` every five minutes.
2. Each run requests 1 CPU, 512 MiB (0.5 GiB) of memory, no GPU, and at most two minutes in `hpg-dev`.
3. The collector reads the `du.j` Slurm queue, the `du.j` and `du.j-b` (burst) QOS, 7-day `sacct` history, per-partition `sinfo` availability and pending demand, `sbatch --test-only` estimates for a few standard requests, and `/blue/du.j` quotas (about 5–7 s in total), then creates a public `status.json` snapshot (about 20 KB).
4. A repository-scoped GitHub deploy key pushes the snapshot to the `data` branch.
5. GitHub Pages serves the dashboard from `main`. The browser checks the snapshot every 60 s with an ETag conditional request: an unchanged snapshot returns 304, which does not count against the unauthenticated API limit of 60 requests per hour per IP. It also checks when the tab becomes visible again, and caches the last successful copy.

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

The sidebar groups sections into Right now / Cluster / Group / Info; on a phone it opens from the menu button.

### Data time

The top bar shows when the snapshot was generated (Eastern time), how long ago, and roughly when the next one is published (every five minutes). The badge at the bottom of the sidebar shows the source: **Live snapshot**, **Browser cache** (live endpoint unavailable) or **Preview data**. A snapshot older than 15 minutes shows a delay notice; check HiPerGator directly then.

### Available now

One card per GPU type plus one for CPU jobs:

- **Startable now** = the smaller of the group's free QOS quota and the partition's free capacity minus what is queued ahead of us.
- **Queued ahead of us**: pending requests on that partition waiting for `Resources`/`Priority` with a priority at least that of a new du.j job (all users, aggregated per partition). Free GPUs that higher-priority requests are already waiting for are not counted as available. A new du.j job's priority is approximated by the lowest priority among the group's current main-QOS jobs.
- **Max on one node**: the most GPUs a single job can get (one node's free GPUs).

### Group quota

`du.j` (main) and `du.j-b` (burst) are shown separately, each with in use, free and limit, split by member. Pending jobs take nothing until they start.

- **du.j**: normal priority; GPU jobs must use this QOS.
- **du.j-b (burst)**: CPU only (0 GPUs), up to 4 days per job, much lower priority, runs only on spare cluster capacity; it does not count against du.j.

The board's own collector jobs (`duj-github-snapshot` and friends) are labeled "Board collector" and attributed to no member.

### Queue

Pending jobs are grouped by why they wait; only the first group competes with new requests:

- **Waiting for resources**: waiting for nodes or quota (`Resources`, `Priority`, `QOSGrp*`, …), plus the currently free slots of throttled arrays.
- **Array throttle**: waiting on the array's own `%N` limit (`JobArrayTaskLimit`). Such a task starts only when another task of the same array ends, so it takes no extra quota. An `--array=0-413%8` array never runs more than 8 at once; the other few hundred tasks only queue behind each other. Each array is listed with its remaining tasks and concurrency.
- **Dependency / held / limits**: waiting on another job, held, or over a per-user limit.
- **Scheduled**: set to start later (`--begin`, scrontab).

### Partitions

From `sinfo`: physically free GPUs (cores for `hpg-default`) per partition for all users, the most free on one node, nodes up, and the GPUs other users have queued there (and how many of those rank ahead of du.j). Down, drained or maintenance nodes are excluded.

### How soon can I start

For a few standard requests (1× B200 / RTX PRO 6000 / L4, 8 CPU cores, and burst; 4 h each):

1. **Now** when the group has quota left, a node has enough free, and no higher-priority request is waiting for that capacity.
2. When the group quota is full: **by** the latest time running jobs reach their time limits and free a slot; earlier if they finish sooner.
3. When the partition is taken by higher-priority requests: **≈** Slurm's estimate.

Slurm's estimate (`sbatch --test-only`) assumes every job runs to its limit, so it is a conservative upper bound that can move; it is hidden when a job can start now.

### Check a request

Given a partition, GPUs, CPU, memory and time, it checks the QOS ceiling and wall-time limit, the group's current headroom (and when enough frees if full), group demand already waiting, whether one node can fit the request, and whether higher-priority requests are queued; CPU-only requests also get a pointer to burst. Inputs are saved in the browser. The chart shows group GPUs over the next 24 h if running jobs use their full limits.

### Members and jobs

The member table shows running, waiting and array-queued tasks, GPUs by type, CPU, memory, burst CPU and storage; click a member to filter jobs.

Jobs are split into Running / Waiting / Array throttle / Scheduled & other, with identical requests grouped as `×N`. Running jobs show "ends by X" (start + time limit; they often end earlier); waiting jobs show Slurm's start estimate; throttled array tasks start as their array frees a slot.

### Last 7 days, storage

Unchanged: hourly use from `sacct`, daily GPU/CPU-hours per member with failure rates; `/blue/du.j` usage per member with source tags and growth trend.

### Links and sharing

Filters are kept in the URL, so `?member=xianyao.li&filter=waiting&lang=zh` opens the same view (`filter` is one of `running`, `waiting`, `throttled`, `other`).

## How to use the information

1. Check that the data time in the top bar is a few minutes old at most.
2. In **Available now**, check that the GPU type you need has at least your per-job count startable, and mind **Max on one node**.
3. If not, **How soon can I start** tells you whether the group quota is full (wait for a group job to end) or the partition is taken by higher-priority requests (see Slurm's estimate, or try another GPU type).
4. CPU-only jobs up to 4 days can use burst (`--qos=du.j-b`), which takes no group quota.
5. Throttle large batches with `--array=...%N` to leave quota for others; the board shows array throttling apart from real contention.

After submitting, find your job in **Jobs**; its state and reason say more than the totals. Use HiPerGator's own commands and documentation for authoritative information.

## License

MIT
