# ICIC Resource Board

English | [中文](README.zh-CN.md)

[Open the live dashboard](https://icic-robot.github.io/icic-resource-board/)

ICIC Resource Board is a public, read-only view of the `du.j` group's shared UF HiPerGator allocation and Slurm queue. It helps group members see current demand, understand shared QOS headroom, and choose a reasonable time and resource request for their next job.

The board is independent of UF and does not replace Slurm as the source of truth.

## Read-only boundary

The board cannot submit, cancel, requeue, prioritize, or modify any HiPerGator job. It also cannot change accounts, QOS limits, partitions, reservations, or allocations. The collector only reads scheduler information and publishes a bounded snapshot for display.

The public snapshot includes usernames, job names and IDs, requested resources, job states, and scheduling windows. It excludes node names, commands, working directories, environment variables, credentials, and unrecognized Slurm fields. No UF password, SSH key, or login session is collected by the website.

## How it runs

1. HiPerGator Slurm `scrontab` starts `duj-github-snapshot` every five minutes.
2. Each run requests 1 CPU, 512 MiB (0.5 GiB) of memory, no GPU, and at most two minutes in `hpg-dev`.
3. The collector reads the `du.j` Slurm queue and QOS, then creates a public `status.json` snapshot.
4. A repository-scoped GitHub deploy key pushes the snapshot to the `data` branch.
5. GitHub Pages serves the dashboard from `main`. A visitor's browser checks the snapshot every two minutes and caches the last successful copy.

The publishing job itself appears briefly in the queue because it is an ordinary Slurm job. It does not run continuously and does not reserve a GPU.

## Reading the board

### Last synchronized and source badge

This is the snapshot generation time, not the time when you opened the page. **Public snapshot** means live GitHub data, **Browser cache** means the last successful copy saved by your browser, and **Preview data** is demonstration data rather than the live queue. A delayed or stale badge means the numbers should not be used for scheduling decisions until the feed recovers.

### Resource overview

- **CPU cores, Memory, and GPUs** show resources currently allocated to running group jobs against the reported shared QOS ceiling.
- The remaining value is QOS headroom, not a promise that physical nodes are immediately available.
- GPU types describe allocated or requested devices when Slurm reports the model.
- **Active work** counts running and pending jobs. Array elements are counted as individual jobs.

Allocation is not utilization. A job may hold four GPUs while using them poorly; this board reports the four allocated GPUs. Use job logs and node-level tools for utilization analysis.

### Next expected start

This panel shows the pending job with the nearest reported estimated start, together with its expected end. Slurm estimates can move when priorities, reservations, dependencies, job durations, or cluster availability change. Treat the countdown as planning guidance, not a reservation guarantee.

### Queued requests

These totals are the CPU, memory, and GPU capacity requested by pending group jobs. They are demand waiting in line, not resources already consumed. A large queued total suggests more contention and potentially longer waits.

### QOS envelope

- **Group TRES** is the reported shared ceiling for CPU, memory, and GPU requests.
- **Maximum wall time** is the longest permitted requested runtime under the QOS.
- **Submitted jobs / user** is the reported per-user submission ceiling.

Partition policies, reservations, account associations, and physical cluster availability can impose additional constraints, so QOS headroom alone does not guarantee that a new job can start.

### Live queue

Each row shows the job owner, state, requested resources, start and expected end, and Slurm's current reason. Use the search box to find a user, job name, or ID, and use the filters to separate running and pending work.

- **RUNNING** means Slurm has allocated the requested resources.
- **PENDING** means the job is waiting; read the reason to understand why.
- Times and reasons are snapshots and may change at the next scheduler update.

### By member

This section aggregates each member's current running and pending jobs and their allocated CPU, memory, and GPU resources. It is useful for coordination and identifying who to contact. It does not measure application efficiency or device utilization.

## How to use the information

Before submitting a job:

1. Confirm that the source is **Public snapshot** and the synchronization time is recent. If it is delayed, check HiPerGator directly.
2. Compare your CPU, memory, GPU, and wall-time request with the QOS envelope. A request outside those limits needs to be changed before submission.
3. Look at current allocation and queued demand together. When the relevant resource is near its shared ceiling or already heavily queued, expect a wait and coordinate with the current allocation owners when timing matters.
4. Check GPU types instead of relying only on the total GPU count when your job requires a specific model.
5. Use **Next expected start** for rough timing only. Slurm, not the board, makes the final scheduling decision.

After submitting, find your job in **Live queue**. Its state and reason are more useful than the aggregate totals for diagnosing that specific job. Use HiPerGator's own commands and documentation when you need authoritative or more detailed information.

## License

MIT
