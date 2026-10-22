(() => {
  "use strict";

  const config = window.ICIC_BOARD_CONFIG || {};
  const API_URL = config.apiUrl || "";
  const REFRESH_MS = Number(config.refreshMs) || 60000;
  const STALE_AFTER_MS = Number(config.staleAfterMs) || 900000;
  const TIME_ZONE = config.timeZone || "America/New_York";
  const CACHE_KEY = "icic-resource-board:last-snapshot";
  const LANG_KEY = "icic-resource-board:language";
  const PLAN_KEY = "icic-resource-board:plan";
  const NAV_KEY = "icic-resource-board:nav";
  const MEMBER_COLORS = 8;
  const MAIN = "du.j", BURST = "du.j-b";
  const SYSTEM_JOBS = new Set(["duj-github-snapshot", "duj-storage-scan", "duj-snapshot-watchdog"]);
  // Same grouping as the collector (collector/publish_github_snapshot.py PENDING_CLASSES).
  const PENDING_CLASSES = [
    ["scheduled", ["BeginTime"]], ["throttled", ["JobArrayTaskLimit"]], ["dependency", ["Dependency"]],
    ["held", ["JobHeld"]], ["group_limit", ["QOSGrp", "AssocGrp"]], ["user_limit", ["QOSMaxJobsPerUser", "QOSMaxSubmitJob", "AssocMaxJobs"]],
    ["cluster", ["Resources", "Priority", "ReqNodeNotAvail", "Reservation", "PartitionNodeLimit", "Nodes_required", "BadConstraints"]]
  ];
  const WAITING = new Set(["cluster", "group_limit", "user_limit", "dependency", "held", "other"]);

  const messages = {
    en: {
      skip: "Skip to content", refresh: "Refresh", loading: "Loading…",
      navNow: "Right now", navAvailable: "Available now", navQuota: "Group quota", navQueue: "Queue",
      navCluster: "Cluster", navPartitions: "Partitions", navWait: "How soon can I start", navPlanner: "Check a request",
      navGroup: "Group", navMembers: "Members", navJobs: "Jobs", navHistory: "Last 7 days", navStorage: "Storage",
      navInfo: "Info", navAbout: "Data & definitions",
      availableTitle: "What you can start now",
      availableNote: "Startable now = the smaller of the group's free QOS quota and the partition's free capacity minus what higher-priority pending requests will take first. One job is limited to one node's free GPUs. Slurm still decides the order.",
      ledeGpu: "The group is using <b>{used} of {limit} GPUs</b>; <b>{free} are free</b> under the quota.",
      ledeGpuFull: "The group's GPU quota is <b>full ({used}/{limit})</b>. New GPU jobs wait until a group job ends.",
      ledeBest: "Most room right now: <b>{type}</b> ({value} GPUs startable, up to {node} in one job).", ledeNoneCluster: "No GPU partition has free GPUs right now.",
      ledeQueue: "{value} pending tasks are waiting on their own array limit and take no quota.",
      ledeCompeting: "<b>{value} tasks</b> are waiting for resources ahead of new requests.",
      startable: "startable", startableCpu: "cores startable",
      ringGpu: "GPU", ringCpu: "CPU", ringMem: "Memory", ringFree: "free", ringOf: "of {value}",
      statWaiting: "Waiting for resources", statThrottled: "In array throttle", statBurst: "Burst CPU free",
      groupFree: "Group quota free", partitionFree: "Free on partition", perNode: "Max on one node", nodesUp: "Nodes up",
      stOk: "Available", stGroupFull: "Group quota full", stClusterFull: "Partition busy", stSplit: "Fragmented", stContended: "Others queued first",
      aheadLine: "Queued ahead of us", aheadNote: "requests with higher priority than a new du.j job",
      cpuJobs: "CPU jobs", burstLine: "Burst (CPU only)",
      quotaTitle: "Group quota", quotaSub: "Running jobs against each QOS ceiling. Pending jobs take nothing until they start.",
      mainQos: "du.j — main quota", mainQosNote: "Normal priority. GPU jobs must use this QOS. Max wall {wall}",
      burstQos: "du.j-b — burst", burstQosNote: "CPU only (0 GPU), max wall {wall}, much lower priority: it only runs on capacity the cluster has to spare. Does not count against du.j.",
      inUse: "in use", free: "free", limit: "limit", gpus: "GPUs", cpuCores: "CPU cores", memory: "Memory", system: "Board collector",
      noBurst: "Burst QOS limits are not in this snapshot.",
      queueTitle: "Queue", queueSub: "Pending jobs grouped by why they wait. Only the first group competes with you for resources.",
      qCompeting: "Waiting for resources", qCompetingNote: "Pending jobs that can start as soon as nodes and quota allow (incl. free slots of throttled arrays).",
      qThrottled: "Array throttle", qThrottledNote: "Waiting on their own array's %N limit. They start only when a task of the same array ends, so they take no extra quota.",
      qOther: "Dependency / held / limits", qOtherNote: "Waiting on another job, held, or over a per-user limit.",
      qScheduled: "Scheduled", qScheduledNote: "Set to start later (--begin, scrontab), including this board's collector.",
      tasks: "tasks", throttledRes: "at most {throttle} run at a time ({running} running now)", nextStart: "Next expected start: {name} · {time}", arrayRow: "{remaining} tasks left · {running}/{throttle} running at a time",
      arrayEach: "each {req}",
      clusterTitle: "Partitions", clusterSub: "Physically free capacity on HiPerGator for all users, independent of our quota.",
      ofTotal: "/ {value}", largestNode: "up to {value} on one node", nodes: "{up}/{total} nodes up", cpuOnly: "CPU only",
      partQueued: "{value} GPUs queued by others ({ahead} ahead of du.j)",
      clusterUnavailable: "Cluster data is not in this snapshot yet.",
      waitTitle: "How soon can I start?",
      waitSub: "For a standard 4 h request. \"Now\": quota left, a node has room and no higher-priority request is waiting for it. \"By\": the group is full; the latest time running jobs reach their limits and free a slot. \"≈\": higher-priority requests come first; Slurm's estimate, which assumes every job runs to its limit (an upper bound that can move). Burst jobs rank below everything pending.",
      wNow: "Now", wNowWhy: "Quota {head} free · up to {node} on one node",
      wGroupFull: "Group quota full ({used}/{limit}); a slot frees by {time} at the latest",
      wGroupFullLong: "Group quota full ({used}/{limit}); running jobs alone don't free a slot within their time limits.",
      wCluster: "No node has enough free{res}",
      wContended: "{free} {res} free, but higher-priority requests already need {ahead}",
      wBurst: "Burst runs only on spare capacity at low priority.",
      slurmEst: "Slurm estimate {time}", slurmEstNote: "upper bound", slurmNone: "No Slurm estimate",
      byTime: "by {time}", aboutTime: "≈ {time}", waitUnavailable: "Start estimates are not in this snapshot yet.",
      plannerTitle: "Check a request", plannerSub: "Compares your request with the QOS ceiling, the group's free quota and free nodes.",
      planPartition: "Partition", gpuCount: "GPUs", memGb: "Memory (GB)", hours: "Time (h)",
      vGo: "Likely to start soon", vWait: "Expect a wait", vNo: "Won't start as requested",
      chkCeilingOk: "Within the QOS ceiling ({ceiling}) and the {wall} wall-time limit",
      chkCeilingBad: "Exceeds the QOS ceiling: {what}. Reduce the request.",
      chkHeadOk: "Group has room now: {what} free under the quota",
      chkHeadWait: "Group quota is full ({what}). Enough frees by {time} at the latest",
      chkHeadLong: "Group quota is full ({what}); running jobs alone won't free enough within their time limits",
      chkQueued: "{value} already waiting in the group may start first",
      chkClusterOk: "{partition}: a node has {value} free {type} right now",
      chkClusterSplit: "{partition}: {value} {type} free in total, but at most {node} on one node",
      chkClusterBusy: "{partition}: only {value} {type} free cluster-wide; expect to wait for other users",
      chkContended: "{partition}: {ahead} GPUs of higher-priority requests are queued for the {free} free ones; expect to wait",
      chkCpuOk: "{partition}: a node has {value} idle cores", chkCpuBusy: "{partition}: no node has {need} idle cores (max {value})",
      chkBurst: "CPU-only jobs up to {wall} can also use burst (du.j-b): {free} cores free there, low priority",
      forecastTitle: "Group GPUs over the next 24 h if running jobs use their full time limit", now: "Now", noLimit: "Quota",
      membersTitle: "Members", membersSub: "Current allocation per member. Click a member to filter the job list.",
      member: "Member", jobs: "Jobs", memoryShort: "Memory", storage: "Storage", noMembers: "No members to show.",
      runShort: "{value} running", waitShort: "{value} waiting", throttledShortN: "{value} in array",
      unattributed: "Unattributed", unattributedNote: "Group total minus counted members",
      exact: "exact", scanned: "scan", partial: "≥ partial", unreadable: "not readable",
      exactTitle: "Lustre quota, {time}", scanTitle: "Daily folder scan, {time}",
      partialTitle: "The daily scan could not read some subfolders, so this is a lower bound ({time})",
      unreadableTitle: "The group cannot read this member's folder; their usage is inside Unattributed",
      jobsTitle: "Jobs", jobsSummary: "{running} running · {waiting} waiting for resources · {throttled} in array throttle · {scheduled} scheduled",
      all: "All", running: "Running", waiting: "Waiting", throttledShort: "Array throttle", otherShort: "Scheduled / other",
      searchPlaceholder: "Search job, member, ID", job: "Job", status: "Status", request: "Request (each)", timing: "Time",
      noJobs: "No jobs match this view.", clearFilter: "Clear filter: {user}", showIds: "Show {count} IDs", hideIds: "Hide IDs",
      endsBy: "ends by {time}", endsByNote: "at the latest (time limit); started {ago} ago", startEst: "Slurm estimate {time}",
      notScheduled: "No estimate yet", followsArray: "starts as its array frees a slot", noGpu: "No GPU",
      sRunning: "Running", sThrottled: "Array throttle", sScheduled: "Scheduled", sSystem: "Board collector",
      reasons: {
        Resources: "Waiting for free nodes", Priority: "Other jobs have priority", QOSGrpGRES: "Group GPU quota full",
        QOSGrpCpuLimit: "Group CPU quota full", QOSGrpMemLimit: "Group memory quota full",
        JobArrayTaskLimit: "Array throttle (%N)", Dependency: "Waiting on dependency", BeginTime: "Scheduled for later",
        ReqNodeNotAvail: "Requested node unavailable", QOSMaxJobsPerUserLimit: "Per-user job limit", AssocGrpGRES: "Account GPU limit"
      },
      historyTitle: "Last 7 days", historyNote: "From Slurm accounting, including finished jobs. Eastern time.",
      inUseTitle: "{res} in use (hourly average) vs quota", dailyTitle: "{res}-hours per day, by member",
      finished: "Finished", failedRate: "Failed", historyUnavailable: "Usage history is not in this snapshot yet.",
      inUseTip: "{value} {res} in use", total: "Total",
      storageTitle: "Storage · /blue/du.j", storageSummary: "{used} of {quota} used · {free} free · {files} files · member scan {scan}",
      storageUnavailable: "Storage data is not available in this snapshot yet.", free_: "Free", never: "not yet run",
      storageTrend: "≈ {rate}/day over the last {days} d · full in ~{eta}", storageTrendFull: "≈ {rate}/day over the last {days} d",
      storageTrendFlat: "Flat or shrinking over the last {days} d", storageTrendCollecting: "A growth trend appears after about a day of history.",
      days: "{value} days", quotaLabel: "Quota",
      optinSummary: "Why are some numbers marked ≥ or estimated? Share your exact usage",
      optinBody: "Lustre only lets each person read their own quota, so the board estimates other members from a daily scan of their folder. Folders the group cannot read are not counted. Run this once on HiPerGator to share your exact usage, which refreshes every 3 hours:",
      optinUninstall: "Stop at any time with --uninstall. Only your total size and file count are shared, never paths.",
      copy: "Copy", copied: "Copied",
      aboutTitle: "Data & definitions",
      dSnapshot: "Snapshot", dSnapshotBody: "Generated {time} ET ({ago} ago); Slurm state as of {slurm} ET. HiPerGator publishes every {every} min; this page checks for a new snapshot every {check} s.",
      dInUse: "In use", dInUseBody: "Resources allocated to running jobs, counted against the QOS they run under. Allocation is not utilization.",
      dFree: "Free / startable", dFreeBody: "Free = QOS ceiling − in use. Startable now also requires that the partition physically has free GPUs or cores on one node.",
      dQueue: "Waiting vs. array throttle", dQueueBody: "A task waiting on its own array's %N limit cannot start before another task of that array ends, so it never takes quota from others. Only \"Waiting for resources\" competes with new requests.",
      dBurst: "Burst (du.j-b)", dBurstBody: "A separate CPU-only QOS with its own ceiling and a 4-day limit, at much lower priority. It does not reduce du.j's quota.",
      dTimes: "Times", dTimesBody: "Ends-by times are start + time limit, i.e. the latest moment; jobs often end earlier. Slurm start estimates assume every job runs to its limit, so they are upper bounds that can move.",
      dBoundary: "Read-only", dBoundaryBody: "The collector reads squeue, sacct, sinfo, sacctmgr and quotas, and asks sbatch --test-only for estimates (it submits nothing). No credentials, node names, paths or commands are published.",
      footerNote: "Public, read-only, cached data. No UF credentials are collected. An independent group dashboard, not an official UF service.",
      syncAgo: "Data from {ago} ago", syncJust: "Data just updated", syncDetail: "{time} ET · next publish ≈ {next}",
      publicSnapshot: "Live snapshot", cachedSnapshot: "Browser cache", previewData: "Preview data", stale: "Delayed",
      refreshFailedCache: "The live endpoint is unavailable right now. Showing the last snapshot saved in this browser.",
      refreshFailedDemo: "The live endpoint is unavailable. Showing labeled preview data.",
      staleNotice: "This snapshot is older than expected. Check HiPerGator directly before relying on it.",
      apiMissing: "Set apiUrl in config.js to connect the board to a public snapshot endpoint.",
      invalidData: "The resource endpoint returned an unexpected data format.", refreshError: "The cached snapshot is temporarily unavailable.",
      daysHours: "{days}d {hours}h", hoursMinutes: "{hours}h {minutes}m", minutes: "{minutes} min", seconds: "<1 min"
    },
    zh: {
      skip: "跳到主要内容", refresh: "刷新", loading: "载入中…",
      navNow: "当前", navAvailable: "现在能用多少", navQuota: "组额度", navQueue: "排队",
      navCluster: "集群", navPartitions: "分区空闲", navWait: "多久能排到", navPlanner: "检查我的请求",
      navGroup: "组内", navMembers: "成员", navJobs: "任务", navHistory: "最近 7 天", navStorage: "存储",
      navInfo: "说明", navAbout: "数据与口径",
      availableTitle: "现在可以立即使用",
      availableNote: "可立即启动 = 组 QOS 剩余额度，与\"分区空闲减去排在我们前面（优先级更高）的排队请求\"两者中较小的一个。单个任务受限于一个节点上的空闲 GPU。实际先后仍由 Slurm 决定。",
      ledeGpu: "组内 GPU 额度 <b>{limit} 张中有 {used} 张在用</b>，<b>还剩 {free} 张</b>。",
      ledeGpuFull: "组内 GPU 额度<b>已满（{used}/{limit}）</b>，新的 GPU 任务要等组内任务结束。",
      ledeBest: "现在空间最大的是 <b>{type}</b>（可立即启动 {value} 张，单个任务最多 {node} 张）。", ledeNoneCluster: "各 GPU 分区现在都没有空闲 GPU。",
      ledeQueue: "另有 {value} 个任务在等自己数组的并发上限，不占组额度。",
      ledeCompeting: "有 <b>{value} 个任务</b>在等资源，会排在新请求前面。",
      startable: "张可立即启动", startableCpu: "核可立即启动",
      ringGpu: "GPU", ringCpu: "CPU", ringMem: "内存", ringFree: "空闲", ringOf: "共 {value}",
      statWaiting: "等待资源", statThrottled: "数组排队", statBurst: "Burst 空闲 CPU",
      groupFree: "组额度剩余", partitionFree: "分区空闲", perNode: "单节点最多", nodesUp: "可用节点",
      stOk: "有空闲", stGroupFull: "组额度已满", stClusterFull: "分区繁忙", stSplit: "空闲分散", stContended: "他人排在前面",
      aheadLine: "排在我们前面", aheadNote: "优先级高于本组新任务的请求",
      cpuJobs: "CPU 任务", burstLine: "Burst（仅 CPU）",
      quotaTitle: "组额度", quotaSub: "运行中的任务占用各 QOS 的上限。排队中的任务在启动前不占任何额度。",
      mainQos: "du.j · 主额度", mainQosNote: "正常优先级，GPU 任务只能用这个 QOS。单任务最长 {wall}",
      burstQos: "du.j-b · Burst", burstQosNote: "仅 CPU（0 张 GPU），单任务最长 {wall}，优先级低得多，只用集群富余的资源。不占 du.j 额度。",
      inUse: "在用", free: "空闲", limit: "上限", gpus: "GPU", cpuCores: "CPU 核心", memory: "内存", system: "看板采集",
      noBurst: "当前快照没有 Burst QOS 的额度信息。",
      queueTitle: "排队", queueSub: "按等待原因分组。只有第一组会和你争资源。",
      qCompeting: "等待资源", qCompetingNote: "资源和额度一到位就能启动的任务（含限速数组的空余槽位）。",
      qThrottled: "数组限速", qThrottledNote: "在等自己数组的 %N 并发上限：同一数组有任务结束才会启动，不额外占用组额度。",
      qOther: "依赖 / 暂停 / 个人上限", qOtherNote: "在等其他任务、被暂停，或超过个人上限。",
      qScheduled: "预约", qScheduledNote: "设定稍后开始（--begin、scrontab），包括看板自己的采集任务。",
      tasks: "个任务", throttledRes: "每次最多 {throttle} 个在跑（现在 {running} 个）", nextStart: "下一个预计启动：{name} · {time}", arrayRow: "还剩 {remaining} 个任务 · 每次最多 {throttle} 个，正在跑 {running} 个",
      arrayEach: "每个 {req}",
      clusterTitle: "分区空闲", clusterSub: "HiPerGator 上所有用户共享的物理空闲资源，与本组额度无关。",
      ofTotal: "/ {value}", largestNode: "单节点最多 {value}", nodes: "{up}/{total} 个节点可用", cpuOnly: "仅 CPU",
      partQueued: "他人排队 {value} 张（{ahead} 张优先于本组）",
      clusterUnavailable: "当前快照尚无集群数据。",
      waitTitle: "多久能排到？",
      waitSub: "按 4 小时的标准请求计算。\"现在\"：组额度有余、有节点放得下、且没有更高优先级的请求在等这些资源。\"最晚\"：组额度已满，按运行中任务到时限推算最晚空出槽位的时间。\"约\"：更高优先级的请求排在前面，取 Slurm 的估计；它假设所有任务用满时限，是会变动的保守上界。Burst 的优先级低于所有排队任务。",
      wNow: "现在", wNowWhy: "组额度剩 {head} · 单节点最多 {node}",
      wGroupFull: "组额度已满（{used}/{limit}），最晚 {time} 空出槽位",
      wGroupFullLong: "组额度已满（{used}/{limit}），仅靠运行中任务在时限内释放不出槽位。",
      wCluster: "没有节点有足够的空闲{res}",
      wContended: "空闲 {free} {res}，但优先级更高的排队请求需要 {ahead} {res}",
      wBurst: "Burst 只用富余资源，优先级低。",
      slurmEst: "Slurm 估计 {time}", slurmEstNote: "保守上界", slurmNone: "Slurm 未给出估计",
      byTime: "最晚 {time}", aboutTime: "约 {time}", waitUnavailable: "当前快照尚无启动时间估计。",
      plannerTitle: "检查我的请求", plannerSub: "把你的请求与 QOS 上限、组内剩余额度和空闲节点对比。",
      planPartition: "分区", gpuCount: "GPU 数", memGb: "内存 (GB)", hours: "时长 (小时)",
      vGo: "很可能马上启动", vWait: "预计需要等待", vNo: "按当前请求无法启动",
      chkCeilingOk: "在 QOS 上限（{ceiling}）与 {wall} 运行时限之内",
      chkCeilingBad: "超出 QOS 上限：{what}。请减少请求。",
      chkHeadOk: "组内现在有余量：额度剩余 {what}",
      chkHeadWait: "组额度已满（{what}）。最晚 {time} 释放足够资源",
      chkHeadLong: "组额度已满（{what}）；仅靠运行中任务在时限内释放不够",
      chkQueued: "组内已有 {value} 在等资源，可能先于你启动",
      chkClusterOk: "{partition}：现在有节点空闲 {value} 张 {type}",
      chkClusterSplit: "{partition}：共空闲 {value} 张 {type}，但单节点最多 {node} 张",
      chkClusterBusy: "{partition}：全集群只空闲 {value} 张 {type}，需要等其他用户",
      chkContended: "{partition}：空闲 {free} 张，但有 {ahead} 张优先级更高的请求在排队，需要等待",
      chkCpuOk: "{partition}：有节点空闲 {value} 个核心", chkCpuBusy: "{partition}：没有节点空闲 {need} 个核心（最多 {value}）",
      chkBurst: "不超过 {wall} 的纯 CPU 任务也可以用 Burst（du.j-b）：剩 {free} 核，优先级低",
      forecastTitle: "未来 24 小时组内 GPU 占用（假设运行中任务用满时限）", now: "现在", noLimit: "额度",
      membersTitle: "成员", membersSub: "每位成员当前的分配量。点击成员可筛选任务列表。",
      member: "成员", jobs: "任务", memoryShort: "内存", storage: "存储", noMembers: "暂无成员数据。",
      runShort: "{value} 运行", waitShort: "{value} 等资源", throttledShortN: "{value} 数组排队",
      unattributed: "未归属", unattributedNote: "组总量减去已统计成员",
      exact: "精确", scanned: "扫描", partial: "≥ 部分", unreadable: "不可读",
      exactTitle: "Lustre 配额，{time}", scanTitle: "每日目录扫描，{time}",
      partialTitle: "每日扫描无法读取部分子目录，此数为下限（{time}）",
      unreadableTitle: "组内无法读取该成员的目录，其用量计入「未归属」",
      jobsTitle: "任务", jobsSummary: "{running} 运行中 · {waiting} 等资源 · {throttled} 数组排队 · {scheduled} 预约",
      all: "全部", running: "运行中", waiting: "等资源", throttledShort: "数组限速", otherShort: "预约 / 其他",
      searchPlaceholder: "搜索任务、成员或 ID", job: "任务", status: "状态", request: "单个请求", timing: "时间",
      noJobs: "当前视图没有匹配的任务。", clearFilter: "清除筛选：{user}", showIds: "显示 {count} 个 ID", hideIds: "隐藏 ID",
      endsBy: "最晚 {time} 结束", endsByNote: "按时限计算；已运行 {ago}", startEst: "Slurm 估计 {time}",
      notScheduled: "暂无估计", followsArray: "随数组空出槽位依次启动", noGpu: "无 GPU",
      sRunning: "运行中", sThrottled: "数组限速", sScheduled: "预约", sSystem: "看板采集",
      reasons: {
        Resources: "等待空闲节点", Priority: "其他任务优先级更高", QOSGrpGRES: "组 GPU 额度已满",
        QOSGrpCpuLimit: "组 CPU 额度已满", QOSGrpMemLimit: "组内存额度已满",
        JobArrayTaskLimit: "数组并发上限 (%N)", Dependency: "等待依赖任务", BeginTime: "预定稍后开始",
        ReqNodeNotAvail: "指定节点不可用", QOSMaxJobsPerUserLimit: "个人任务上限", AssocGrpGRES: "账户 GPU 上限"
      },
      historyTitle: "最近 7 天", historyNote: "来自 Slurm 记账数据，包含已结束任务。美东时间。",
      inUseTitle: "{res} 使用量（小时平均）与额度", dailyTitle: "每日 {res}·小时，按成员",
      finished: "已结束", failedRate: "失败", historyUnavailable: "当前快照尚无使用历史。",
      inUseTip: "使用 {value} {res}", total: "合计",
      storageTitle: "存储 · /blue/du.j", storageSummary: "已用 {used} / {quota} · 剩余 {free} · {files} 个文件 · 成员扫描 {scan}",
      storageUnavailable: "当前快照尚无存储数据。", free_: "剩余", never: "尚未运行",
      storageTrend: "最近 {days} 天约 {rate}/天 · 预计 ~{eta}后用满", storageTrendFull: "最近 {days} 天约 {rate}/天",
      storageTrendFlat: "最近 {days} 天持平或下降", storageTrendCollecting: "积累约一天历史后显示增长趋势。",
      days: "{value} 天", quotaLabel: "配额",
      optinSummary: "为什么有些数字带 ≥ 或为估算？分享你的精确用量",
      optinBody: "Lustre 只允许每个人查看自己的配额，因此看板通过每日扫描成员目录来估算他人用量，组内无法读取的目录不会被计入。在 HiPerGator 上运行一次以下命令即可分享你的精确用量（每 3 小时自动更新）：",
      optinUninstall: "随时可用 --uninstall 停止。仅分享总大小与文件数，不包含路径。",
      copy: "复制", copied: "已复制",
      aboutTitle: "数据与口径",
      dSnapshot: "快照", dSnapshotBody: "生成于美东 {time}（{ago}前），Slurm 状态截至美东 {slurm}。HiPerGator 每 {every} 分钟发布一次；本页每 {check} 秒检查是否有新快照。",
      dInUse: "在用", dInUseBody: "分配给运行中任务的资源，计入它所用的 QOS。分配量不等于利用率。",
      dFree: "空闲 / 可立即启动", dFreeBody: "空闲 = QOS 上限 − 在用。可立即启动还要求该分区在某个节点上确实有空闲的 GPU 或核心。",
      dQueue: "等资源与数组限速", dQueueBody: "在等自己数组 %N 上限的任务，必须等同一数组的任务结束才能启动，所以不会占用别人的额度。只有\"等待资源\"一组会和新请求竞争。",
      dBurst: "Burst（du.j-b）", dBurstBody: "独立的纯 CPU QOS，有自己的上限，单任务最长 4 天，优先级低得多。不减少 du.j 的额度。",
      dTimes: "时间", dTimesBody: "\"最晚结束\"= 开始时间 + 时限，任务通常更早结束。Slurm 的启动估计假设所有任务用满时限，是会变动的保守上界。",
      dBoundary: "只读", dBoundaryBody: "采集器只读取 squeue、sacct、sinfo、sacctmgr 与配额，并用 sbatch --test-only 取估计（不提交任何任务）。不发布登录凭据、节点名、路径或命令。",
      footerNote: "公开、只读的缓存数据，不收集 UF 登录信息。本页面为组内独立看板，并非 UF 官方服务。",
      syncAgo: "数据来自 {ago}前", syncJust: "数据刚刚更新", syncDetail: "美东 {time} · 下次发布约 {next}",
      publicSnapshot: "实时快照", cachedSnapshot: "浏览器缓存", previewData: "预览数据", stale: "数据延迟",
      refreshFailedCache: "实时接口暂时不可用，当前显示此浏览器保存的最近一次快照。",
      refreshFailedDemo: "实时接口暂时不可用，当前显示带有明确标记的预览数据。",
      staleNotice: "该快照比预期更旧，请先在 HiPerGator 上直接确认。",
      apiMissing: "请在 config.js 中设置 apiUrl，以连接公开快照接口。",
      invalidData: "资源接口返回了无法识别的数据格式。", refreshError: "缓存快照暂时不可用。",
      daysHours: "{days}天{hours}小时", hoursMinutes: "{hours}小时{minutes}分", minutes: "{minutes} 分钟", seconds: "不到 1 分钟"
    }
  };

  const readStorage = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };
  const preferredLang = () => {
    const saved = readStorage(LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
    return /^zh/i.test(navigator.language || "") ? "zh" : "en";
  };

  const state = {
    lang: preferredLang(), snapshot: null, source: "live", noticeKey: "", etag: "", lastCheck: 0,
    filter: "ALL", search: "", member: "", expanded: new Set(),
    sortKey: "default", sortDir: -1, loading: false, metric: "gpu",
    plan: (() => { try { return JSON.parse(readStorage(PLAN_KEY) || "null") || {}; } catch { return {}; } })()
  };

  const el = (id) => document.getElementById(id);
  const t = (key, values = {}) => {
    let value = messages[state.lang][key] ?? messages.en[key] ?? key;
    Object.entries(values).forEach(([name, replacement]) => { value = value.split(`{${name}}`).join(String(replacement)); });
    return value;
  };
  const locale = () => (state.lang === "zh" ? "zh-CN" : "en-US");
  const num = (value, digits = 1) => new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(Number(value) || 0);
  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  const pct = (used, limit) => (Number(limit) > 0 ? Math.max(0, Math.min(100, (Number(used) / Number(limit)) * 100)) : 0);
  const typeName = (value) => String(value || "").replace(/_/g, " ");
  const bytes = (gib) => {
    const value = Number(gib) || 0;
    return value >= 1024 ? `${num(value / 1024, 2)} TB` : `${num(value, value >= 100 ? 0 : 1)} GB`;
  };
  const gb = (value) => `${num(value, value >= 100 ? 0 : 1)} GB`;

  function dateTime(value, withDay = true) {
    const parsed = new Date(value);
    if (!value || Number.isNaN(parsed.getTime())) return "—";
    const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(parsed) === new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
    return new Intl.DateTimeFormat(locale(), { timeZone: TIME_ZONE, ...(withDay && !sameDay ? { month: "short", day: "numeric" } : {}), hour: "numeric", minute: "2-digit" }).format(parsed);
  }
  const clock = (value) => new Intl.DateTimeFormat(locale(), { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(value));

  function duration(ms) {
    const total = Math.max(0, Math.round(ms / 60000));
    if (!total) return t("seconds");
    const days = Math.floor(total / 1440), hours = Math.floor((total % 1440) / 60), minutes = total % 60;
    if (days) return t("daysHours", { days, hours });
    if (hours) return t("hoursMinutes", { hours, minutes });
    return t("minutes", { minutes });
  }

  let colorIndex = new Map();
  function assignColors(users) { colorIndex = new Map([...new Set(users)].sort().map((user, index) => [user, index % MEMBER_COLORS])); }
  const colorVar = (user) => (colorIndex.has(user) ? `var(--m${colorIndex.get(user)})` : "var(--faint)");

  /* ---------- Snapshot normalization (v1 caches and demo data use the same views) ---------- */

  const emptyRes = () => ({ cpu: 0, memory_gb: 0, gpu: 0, gpu_types: {} });
  const classify = (reason) => (PENDING_CLASSES.find(([, codes]) => codes.some((c) => String(reason || "").startsWith(c))) || ["other"])[0];

  function normalize(s) {
    s.jobs = (s.jobs || []).map((j) => ({ ...j, qos: j.qos || MAIN, system: j.system ?? SYSTEM_JOBS.has(j.name),
      pending_class: j.state === "PENDING" ? (j.pending_class || classify(j.reason)) : null }));
    if (!s.qos) s.qos = { [MAIN]: { limits: s.summary.limits, allocated: s.summary.allocated, running_jobs: s.summary.running_jobs } };
    if (!s.pending) {
      const classes = {};
      s.jobs.filter((j) => j.state === "PENDING").forEach((j) => {
        const c = classes[j.pending_class] || (classes[j.pending_class] = { tasks: 0, ...emptyRes() });
        const n = Number(j.task_count) || 1;
        c.tasks += n; c.cpu += j.cpu * n; c.memory_gb += j.memory_gb * n; c.gpu += (j.gpus || 0) * n;
      });
      s.pending = classes;
      s.summary.queued = ["cluster", "group_limit"].reduce((acc, k) => {
        const c = classes[k]; if (c) { acc.cpu += c.cpu; acc.memory_gb += c.memory_gb; acc.gpu += c.gpu; } return acc;
      }, emptyRes());
    }
    return s;
  }

  function validateSnapshot(value) {
    return Boolean(value && typeof value === "object" && value.summary && value.summary.allocated
      && value.summary.limits && Array.isArray(value.jobs) && Array.isArray(value.users) && value.generated_at);
  }
  const isStale = (s) => Boolean(s.stale) || Date.now() - new Date(s.generated_at).getTime() > STALE_AFTER_MS;

  const qosOf = (name) => state.snapshot.qos?.[name] || null;
  const head = (name, key) => { const q = qosOf(name); return q ? Math.max(0, (Number(q.limits[key]) || 0) - (Number(q.allocated[key]) || 0)) : 0; };
  const pendingClass = (name) => state.snapshot.pending?.[name] || { tasks: 0, ...emptyRes() };
  const runningJobs = () => state.snapshot.jobs.filter((j) => j.state !== "PENDING");

  // Latest time by which running jobs of a QOS (ending at their limits) free `need` of `key`.
  function freedBy(qos, key, need) {
    const q = qosOf(qos);
    if (!q) return null;
    const deficit = (Number(q.allocated[key]) || 0) + need - (Number(q.limits[key]) || 0);
    if (deficit <= 0) return new Date().toISOString();
    let freed = 0;
    const field = key === "gpu" ? "gpus" : key;
    const hit = runningJobs().filter((j) => j.qos === qos && j.end_time).sort((a, b) => a.end_time.localeCompare(b.end_time))
      .find((j) => { freed += (Number(j[field]) || 0) * (Number(j.task_count) || 1); return freed >= deficit; });
    return hit ? hit.end_time : null;
  }

  /* ---------- Available now ---------- */

  function gpuPartitions() { return (state.snapshot.cluster || []).filter((p) => p.gpu_total > 0); }
  function cpuPartition() { return (state.snapshot.cluster || []).find((p) => !(p.gpu_total > 0)); }

  // Free GPUs that higher-priority pending requests will take first are not available to us.
  function availability(p) {
    const groupFree = head(MAIN, "gpu");
    const ahead = Number(p.pending_gpu_ahead) || 0;
    const effective = Math.max(0, p.gpu_free - ahead);
    const startable = Math.min(groupFree, effective);
    const perNode = effective > 0 ? Math.min(groupFree, p.max_gpu_free_node) : 0;
    const status = groupFree <= 0 ? "groupFull" : p.gpu_free <= 0 ? "clusterFull" : effective <= 0 ? "contended"
      : p.max_gpu_free_node <= 1 && startable > 1 ? "split" : "ok";
    return { groupFree, ahead, startable, perNode, status };
  }
  const statusBadge = (status) => ({
    ok: `<span class="badge ok">${safe(t("stOk"))}</span>`, groupFull: `<span class="badge bad">${safe(t("stGroupFull"))}</span>`,
    clusterFull: `<span class="badge warn">${safe(t("stClusterFull"))}</span>`, split: `<span class="badge warn">${safe(t("stSplit"))}</span>`,
    contended: `<span class="badge warn">${safe(t("stContended"))}</span>`
  })[status];

  function ring(id, used, limit, label, format) {
    const share = pct(used, limit) / 100;
    const r = 44, c = 2 * Math.PI * r;
    return `<article class="ring-card">
      <div class="ring"><svg viewBox="0 0 104 104" aria-hidden="true">
        <defs><linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c9bff"/><stop offset=".6" stop-color="#7b61ff"/><stop offset="1" stop-color="#c25cff"/></linearGradient></defs>
        <circle class="track" cx="52" cy="52" r="${r}"/>
        <circle class="arc" cx="52" cy="52" r="${r}" stroke="url(#g-${id})" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - share)).toFixed(1)}"/>
      </svg><div class="center"><b>${format(used)}</b><small>${safe(t("ringOf", { value: format(limit) }))}</small></div></div>
      <div class="ring-meta"><span class="label">${safe(label)}</span>
        <span class="free"><em>${format(Math.max(0, limit - used))}</em>${safe(t("ringFree"))}</span>
        <small>du.j · ${num(share * 100, 0)}%</small></div>
    </article>`;
  }

  function renderAvailable() {
    const main = qosOf(MAIN);
    const limit = Number(main.limits.gpu) || 0;
    const parts = gpuPartitions().map((p) => ({ p, a: availability(p) }));
    const competing = pendingClass("cluster").tasks + pendingClass("group_limit").tasks;
    const throttled = pendingClass("throttled").tasks;
    const burst = qosOf(BURST);
    const stat = (label, value, color) => `<div class="stat"><span><i class="dotc" style="background:${color};box-shadow:0 0 8px ${color}"></i>${safe(label)}</span><b>${value}</b></div>`;
    el("hero").innerHTML = ring("gpu", Number(main.allocated.gpu) || 0, limit, t("ringGpu"), (v) => num(v, 0))
      + ring("cpu", Number(main.allocated.cpu) || 0, Number(main.limits.cpu) || 0, t("ringCpu"), (v) => num(v, 0))
      + ring("mem", Number(main.allocated.memory_gb) || 0, Number(main.limits.memory_gb) || 0, t("ringMem"), (v) => (v >= 1000 ? `${num(v / 1024, 1)}T` : `${num(v, 0)}G`))
      + `<div class="stats">${stat(t("statWaiting"), num(competing, 0), competing ? "var(--warn)" : "var(--faint)")}
          ${stat(t("statThrottled"), num(throttled, 0), "var(--accent)")}
          ${burst ? stat(t("statBurst"), num(head(BURST, "cpu"), 0), "var(--ok)") : ""}</div>`;

    const tone = (status) => (status === "ok" ? "ok" : status === "groupFull" ? "bad" : "warn");
    const tiles = parts.map(({ p, a }) => `<article class="tile ${tone(a.status)}">
        <div class="tile-head"><span>${safe(typeName(p.gpu_type))}</span>${statusBadge(a.status)}</div>
        <div class="big">${num(a.startable, 0)}<small>${safe(t("startable"))}</small></div>
        <div class="tile-sub">${safe(p.partition)}</div>
        <ul class="kv">
          <li><span>${safe(t("groupFree"))}</span><b>${num(a.groupFree, 0)}<span class="zero"> / ${num(limit, 0)}</span></b></li>
          <li><span>${safe(t("partitionFree"))}</span><b>${num(p.gpu_free, 0)}</b></li>
          <li><span>${safe(t("perNode"))}</span><b>${num(p.max_gpu_free_node, 0)}</b></li>
          ${p.pending_gpu_ahead != null ? `<li><span>${safe(t("aheadLine"))}</span><b>${num(a.ahead, 0)}</b></li>` : ""}
        </ul>
      </article>`);
    const cpu = cpuPartition();
    if (cpu) {
      const cpuHead = head(MAIN, "cpu"), memHead = head(MAIN, "memory_gb");
      const startable = Math.max(0, Math.min(cpuHead, cpu.cpu_idle - (Number(cpu.pending_cpu_ahead) || 0)));
      const burst = qosOf(BURST);
      const burstHead = burst ? head(BURST, "cpu") : null;
      const ok = cpuHead > 0 && startable > 0;
      tiles.push(`<article class="tile ${ok ? "ok" : cpuHead > 0 ? "warn" : "bad"}">
        <div class="tile-head"><span>${safe(t("cpuJobs"))}</span>${ok ? statusBadge("ok") : statusBadge(cpuHead > 0 ? "clusterFull" : "groupFull")}</div>
        <div class="big">${num(startable, 0)}<small>${safe(t("startableCpu"))}</small></div>
        <div class="tile-sub">${safe(cpu.partition)}</div>
        <ul class="kv">
          <li><span>${safe(t("groupFree"))}</span><b>${num(cpuHead, 0)}</b></li>
          <li><span>${safe(t("memory"))}</span><b>${gb(memHead)}</b></li>
          <li><span>${safe(t("perNode"))}</span><b>${num(cpu.max_cpu_free_node, 0)}</b></li>
          ${burstHead != null ? `<li><span>${safe(t("burstLine"))}</span><b>${num(burstHead, 0)}</b></li>` : ""}
        </ul>
      </article>`);
    }
    el("availableTiles").innerHTML = tiles.join("") || `<p class="empty">${safe(t("clusterUnavailable"))}</p>`;
  }

  /* ---------- Quota ---------- */

  function meter(segments, limit) {
    return `<div class="meter" role="img">${segments.filter((s) => s.value > 0).map((s) =>
      `<i style="width:${pct(s.value, limit)}%;background:${s.color}" title="${safe(s.label)}: ${safe(s.text)}"></i>`).join("")}</div>`;
  }

  function quotaBlock(title, used, limit, segments, format) {
    return `<div class="meter-block">
      <div class="meter-head"><h3>${safe(title)}</h3>
        <div class="meter-nums"><span><b>${format(used)}</b>${safe(t("inUse"))}</span><span><b>${format(Math.max(0, limit - used))}</b>${safe(t("free"))}</span><span><b>${format(limit)}</b>${safe(t("limit"))}</span></div>
      </div>${meter(segments, limit)}</div>`;
  }

  function renderQuota() {
    const snapshot = state.snapshot;
    const main = qosOf(MAIN);
    const users = snapshot.users || [];
    const sys = snapshot.system || emptyRes();
    const seg = (key, suffix, source = (u) => u) => users.map((u) => ({ value: Number(source(u)?.[key]) || 0, color: colorVar(u.user), label: u.user, text: `${num(source(u)?.[key])}${suffix}` }));
    const withSys = (list, key, suffix) => (Number(sys[key]) > 0 ? [...list, { value: Number(sys[key]), color: "var(--unattributed)", label: t("system"), text: `${num(sys[key])}${suffix}` }] : list);
    const types = Object.entries(main.allocated.gpu_types || {}).filter(([, v]) => v > 0).map(([k, v]) => `${num(v, 0)}× ${typeName(k)}`).join(" · ");
    const people = users.filter((u) => u.gpu || u.cpu || u.memory_gb || u.burst?.cpu).map((u) => u.user);
    const qosHead = (title, note, chips) => `<div class="card-head"><div class="title"><h3>${safe(title)}</h3>${chips.map((c) => `<span class="badge">${safe(c)}</span>`).join("")}<button type="button" class="info" data-tip-text="${safe(note)}" aria-label="Info">i</button></div></div>`;
    el("mainQuota").innerHTML = `${qosHead(t("mainQos"), t("mainQosNote", { wall: wallText(main.limits.max_wall) }), [`≤ ${wallText(main.limits.max_wall)}`, ...(types ? [types] : [])])}
      ${quotaBlock(t("gpus"), main.allocated.gpu, main.limits.gpu, seg("gpu", " GPU"), (v) => num(v, 0))}
      ${quotaBlock(t("cpuCores"), main.allocated.cpu, main.limits.cpu, withSys(seg("cpu", " CPU"), "cpu", " CPU"), (v) => num(v, 0))}
      ${quotaBlock(t("memory"), main.allocated.memory_gb, main.limits.memory_gb, withSys(seg("memory_gb", " GB"), "memory_gb", " GB"), gb)}
      <div class="legend">${people.map((u) => `<span><i style="background:${colorVar(u)}"></i>${safe(u)}</span>`).join("")}${Number(sys.cpu) > 0 ? `<span><i style="background:var(--unattributed)"></i>${safe(t("system"))}</span>` : ""}</div>`;
    const burst = qosOf(BURST);
    el("burstQuota").innerHTML = burst ? `${qosHead(t("burstQos"), t("burstQosNote", { wall: wallText(burst.limits.max_wall) }), [`≤ ${wallText(burst.limits.max_wall)}`, t("cpuOnly")])}
      ${quotaBlock(t("cpuCores"), burst.allocated.cpu, burst.limits.cpu, seg("cpu", " CPU", (u) => u.burst), (v) => num(v, 0))}
      ${quotaBlock(t("memory"), burst.allocated.memory_gb, burst.limits.memory_gb, seg("memory_gb", " GB", (u) => u.burst), bytes)}`
      : `<p class="empty">${safe(t("noBurst"))}</p>`;
  }

  /* ---------- Queue ---------- */

  const resLine = (c) => [c.gpu ? `${num(c.gpu, 0)} GPU` : "", c.cpu ? `${num(c.cpu, 0)} CPU` : "", c.memory_gb ? gb(c.memory_gb) : ""].filter(Boolean).join(" · ") || "—";
  const reqLine = (j) => `${num(j.cpu, 0)} CPU · ${gb(j.memory_gb)} · ${j.gpu_label ? safe(typeName(j.gpu_label)) : safe(t("noGpu"))}`;

  function renderQueue() {
    const sum = (names) => names.reduce((acc, n) => { const c = pendingClass(n); acc.tasks += c.tasks; acc.cpu += c.cpu; acc.memory_gb += c.memory_gb; acc.gpu += c.gpu; return acc; }, { tasks: 0, ...emptyRes() });
    const competing = sum(["cluster", "group_limit"]);
    const other = sum(["dependency", "held", "user_limit", "other"]);
    const throttled = pendingClass("throttled"), scheduled = pendingClass("scheduled");
    const next = state.snapshot.next_start;
    const card = (title, c, note, tone, extra = "", res = resLine(c)) => `<article class="qcard ${c.tasks ? (tone === "warn" ? "hot" : "") : "calm"}">
      <div class="qtop"><h3>${safe(title)}</h3><button type="button" class="info" data-tip="${safe(note)}" aria-label="Info">i</button></div>
      <div class="qnum">${num(c.tasks, 0)}<small>${safe(t("tasks"))}</small></div>
      <p>${safe(res)}</p>${extra}</article>`;
    // Throttled arrays: their total request is not demand, so show the concurrency instead.
    const arrays = state.snapshot.jobs.filter((j) => j.state === "PENDING" && j.pending_class === "throttled");
    const throttleSum = arrays.reduce((sum, j) => sum + (Number(j.array_throttle) || 0), 0);
    const runningSum = arrays.reduce((sum, j) => sum + (Number(j.array_running) || 0), 0);
    el("queueCards").innerHTML = [
      card(t("qCompeting"), competing, "qCompetingNote", "warn", next ? `<p><b>${safe(t("nextStart", { name: next.name || `#${next.job_id}`, time: dateTime(next.start_time) }))}</b></p>` : ""),
      card(t("qThrottled"), throttled, "qThrottledNote", "", "", throttled.tasks && throttleSum ? t("throttledRes", { throttle: num(throttleSum, 0), running: num(runningSum, 0) }) : resLine(throttled)),
      card(t("qOther"), other, "qOtherNote", ""),
      card(t("qScheduled"), scheduled, "qScheduledNote", "")
    ].join("");
    el("arrayList").innerHTML = arrays.map((j) => {
      const throttle = Number(j.array_throttle) || 0;
      const running = Number(j.array_running ?? 0);
      return `<div class="array-row">
        <div><strong>${safe(j.name)}</strong> <span class="who" style="margin-left:8px"><i style="background:${colorVar(j.user)}"></i>${safe(j.user)}</span>
          <small>#${safe(j.job_id)} · ${safe(j.partition)} · ${safe(t("arrayEach", { req: "" }).trim())} ${reqLine(j)}</small></div>
        <span class="badge accent">${safe(t("arrayRow", { remaining: num(j.task_count, 0), running: num(running, 0), throttle: throttle ? num(throttle, 0) : "—" }))}</span>
        ${throttle ? meter([{ value: running, color: colorVar(j.user), label: j.user, text: `${running}/${throttle}` }], throttle).replace('class="meter"', 'class="meter thin"') : ""}
      </div>`;
    }).join("");
    const badge = el("navQueueBadge");
    badge.hidden = !competing.tasks;
    badge.className = "badge warn";
    badge.textContent = num(competing.tasks, 0);
  }

  /* ---------- Cluster ---------- */

  function renderCluster() {
    const partitions = state.snapshot.cluster;
    if (!Array.isArray(partitions) || !partitions.length) { el("partitions").innerHTML = `<p class="empty">${safe(t("clusterUnavailable"))}</p>`; return; }
    el("partitions").innerHTML = partitions.map((p) => {
      const gpu = p.gpu_total > 0;
      const free = gpu ? p.gpu_free : p.cpu_idle, total = gpu ? p.gpu_total : p.cpu_total;
      const share = pct(free, total);
      const tone = share < 3 ? "low" : share < 15 ? "mid" : "high";
      return `<article class="part">
        <div class="ptitle"><h3>${safe(gpu ? typeName(p.gpu_type) : t("cpuOnly"))}</h3><small>${safe(p.partition)}</small></div>
        <div class="pval">${num(free, 0)}<span>${safe(t("ofTotal", { value: num(total, 0) }))} ${gpu ? "GPU" : "CPU"}</span></div>
        <div class="meter thin"><i class="tone-${tone}" style="width:${share}%"></i></div>
        <p>${safe(gpu ? t("largestNode", { value: num(p.max_gpu_free_node, 0) }) : t("largestNode", { value: `${num(p.max_cpu_free_node, 0)} CPU` }))} · ${safe(t("nodes", { up: p.nodes_up, total: p.nodes }))}</p>
        ${gpu && p.pending_gpu != null ? `<p>${safe(t("partQueued", { value: num(p.pending_gpu, 0), ahead: num(p.pending_gpu_ahead, 0) }))}</p>` : ""}
      </article>`;
    }).join("");
  }

  /* ---------- How soon can I start ---------- */

  function renderWait() {
    const est = state.snapshot.estimates;
    const partitions = state.snapshot.cluster || [];
    if (!est || !Array.isArray(est.probes)) { el("waitList").innerHTML = `<p class="empty">${safe(t("waitUnavailable"))}</p>`; return; }
    el("waitList").innerHTML = est.probes.map((probe) => {
      const p = partitions.find((x) => x.partition === probe.partition);
      const gpuNeed = probe.gpus ? Number(String(probe.gpus).split(":").pop()) || 1 : 0;
      const type = probe.gpus ? typeName(String(probe.gpus).split(":")[0].toUpperCase()) : "";
      const label = `${gpuNeed ? `${gpuNeed}× ${type} · ` : ""}${probe.cpu} CPU · ${probe.mem} · ${parseInt(probe.time, 10)} h`;
      const qos = probe.qos;
      const key = gpuNeed ? "gpu" : "cpu", need = gpuNeed || probe.cpu;
      const q = qosOf(qos);
      const groupHead = q ? head(qos, key) : 0;
      const nodeFree = p ? (gpuNeed ? p.max_gpu_free_node : p.max_cpu_free_node) : 0;
      let badge, why;
      // Burst jobs rank below everything pending, so all pending demand is ahead of them.
      const ahead = p ? Number(gpuNeed ? p.pending_gpu_ahead : qos === BURST ? p.pending_cpu : p.pending_cpu_ahead) || 0 : 0;
      const contended = Boolean(p) && (gpuNeed ? p.gpu_free : p.cpu_idle) - ahead < need;
      const unit = gpuNeed ? (state.lang === "zh" ? "张 GPU" : "GPUs") : (state.lang === "zh" ? "核" : "cores");
      if (q && groupHead >= need && nodeFree >= need && !contended) {
        badge = `<span class="badge ok">${safe(t("wNow"))}</span>`;
        why = t("wNowWhy", { head: `${num(groupHead, 0)} ${gpuNeed ? "GPU" : "CPU"}`, node: `${num(nodeFree, 0)} ${gpuNeed ? "GPU" : "CPU"}` });
      } else if (q && groupHead < need) {
        const by = freedBy(qos, key, need);
        badge = by ? `<span class="badge warn">${safe(t("byTime", { time: dateTime(by) }))}</span>` : `<span class="badge bad">${safe(t("stGroupFull"))}</span>`;
        why = by ? t("wGroupFull", { used: num(q.allocated[key], 0), limit: num(q.limits[key], 0), time: dateTime(by) }) : t("wGroupFullLong", { used: num(q.allocated[key], 0), limit: num(q.limits[key], 0) });
      } else {
        badge = probe.start_time ? `<span class="badge warn">${safe(t("aboutTime", { time: dateTime(probe.start_time) }))}</span>` : `<span class="badge">—</span>`;
        why = contended && nodeFree >= need ? t("wContended", { free: num(gpuNeed ? p.gpu_free : p.cpu_idle, 0), ahead: num(ahead, 0), res: unit })
          : t("wCluster", { res: gpuNeed ? " GPU" : (state.lang === "zh" ? "核心" : " cores") });
      }
      // When it can start now, Slurm's conservative plan only adds noise.
      const slurm = badge.includes(t("wNow")) ? "" : probe.start_time ? `${t("slurmEst", { time: dateTime(probe.start_time) })} · ${t("slurmEstNote")}` : t("slurmNone");
      return `<div class="wait-row">
        <div><strong>${safe(label)}</strong><small>${safe(probe.partition)} · ${safe(qos)}</small></div>
        <div class="why">${safe(why)}${slurm ? `<small>${safe(slurm)}</small>` : ""}</div>
        ${badge}
      </div>`;
    }).join("");
  }

  /* ---------- Planner ---------- */

  const wallText = (text) => {
    const match = /^(?:(\d+)-)?(\d+):(\d+):(\d+)$/.exec(String(text || ""));
    if (!match) return text || "—";
    const days = Number(match[1] || 0), hours = Number(match[2]);
    return days ? (state.lang === "zh" ? `${days} 天${hours ? ` ${hours} 小时` : ""}` : `${days} d${hours ? ` ${hours} h` : ""}`) : (state.lang === "zh" ? `${hours} 小时` : `${hours} h`);
  };

  function wallHours(text) {
    const match = /^(?:(\d+)-)?(\d+):(\d+):(\d+)$/.exec(String(text || ""));
    return match ? Number(match[1] || 0) * 24 + Number(match[2]) + Number(match[3]) / 60 : Infinity;
  }

  function renderPlannerOptions() {
    const partitions = state.snapshot.cluster || [];
    const select = el("planType");
    const options = partitions.length ? partitions : [{ partition: "hpg-b200", gpu_type: "B200", gpu_total: 1 }, { partition: "hpg-default", gpu_total: 0 }];
    const current = select.value || state.plan.partition;
    select.innerHTML = options.map((p) => `<option value="${safe(p.partition)}">${safe(p.gpu_total > 0 ? `${typeName(p.gpu_type)} · ${p.partition}` : `${t("cpuOnly")} · ${p.partition}`)}</option>`).join("");
    if (options.some((p) => p.partition === current)) select.value = current;
  }

  function renderPlanner() {
    const snapshot = state.snapshot;
    const main = qosOf(MAIN);
    const { allocated, limits } = main;
    const queued = snapshot.summary.queued || emptyRes();
    const partition = (snapshot.cluster || []).find((p) => p.partition === el("planType").value);
    const cpuOnly = partition ? !(partition.gpu_total > 0) : el("planType").value === "hpg-default";
    el("planGpu").disabled = cpuOnly;
    const request = {
      gpu: cpuOnly ? 0 : Math.max(0, Number(el("planGpu").value) || 0), cpu: Math.max(1, Number(el("planCpu").value) || 1),
      mem: Math.max(1, Number(el("planMem").value) || 1), hours: Math.max(1, Number(el("planHours").value) || 1)
    };
    state.plan = { partition: el("planType").value, ...request };
    writeStorage(PLAN_KEY, JSON.stringify(state.plan));

    const checks = [], over = [];
    if (request.gpu > limits.gpu) over.push(`${request.gpu} GPU > ${limits.gpu}`);
    if (request.cpu > limits.cpu) over.push(`${request.cpu} CPU > ${limits.cpu}`);
    if (request.mem > limits.memory_gb) over.push(`${request.mem} GB > ${num(limits.memory_gb)} GB`);
    if (request.hours > wallHours(limits.max_wall)) over.push(`${request.hours} h > ${limits.max_wall}`);
    if (over.length) {
      checks.push(["bad", t("chkCeilingBad", { what: over.join(", ") })]);
    } else {
      checks.push(["ok", t("chkCeilingOk", { ceiling: `${num(limits.cpu)} CPU · ${num(limits.memory_gb)} GB · ${num(limits.gpu)} GPU`, wall: wallText(limits.max_wall) })]);
      const deficit = { gpu: allocated.gpu + request.gpu - limits.gpu, cpu: allocated.cpu + request.cpu - limits.cpu, mem: allocated.memory_gb + request.mem - limits.memory_gb };
      const short = [deficit.gpu > 0 && `GPU ${num(allocated.gpu)}/${num(limits.gpu)}`, deficit.cpu > 0 && `CPU ${num(allocated.cpu)}/${num(limits.cpu)}`,
        deficit.mem > 0 && `${num(allocated.memory_gb)}/${num(limits.memory_gb)} GB`].filter(Boolean);
      if (!short.length) {
        checks.push(["ok", t("chkHeadOk", { what: `${num(limits.gpu - allocated.gpu)} GPU · ${num(limits.cpu - allocated.cpu)} CPU · ${num(limits.memory_gb - allocated.memory_gb)} GB` })]);
      } else {
        const freed = { gpu: 0, cpu: 0, mem: 0 };
        const when = runningJobs().filter((j) => j.qos === MAIN && j.end_time).sort((a, b) => a.end_time.localeCompare(b.end_time)).find((j) => {
          const n = Number(j.task_count) || 1;
          freed.gpu += (Number(j.gpus) || 0) * n; freed.cpu += (Number(j.cpu) || 0) * n; freed.mem += (Number(j.memory_gb) || 0) * n;
          return freed.gpu >= deficit.gpu && freed.cpu >= deficit.cpu && freed.mem >= deficit.mem;
        });
        checks.push(["warn", when ? t("chkHeadWait", { what: short.join(", "), time: dateTime(when.end_time) }) : t("chkHeadLong", { what: short.join(", ") })]);
      }
      if (request.gpu > 0 && queued.gpu > 0) checks.push(["info", t("chkQueued", { value: `${num(queued.gpu)} GPU` })]);
      else if (!request.gpu && queued.cpu > 0) checks.push(["info", t("chkQueued", { value: `${num(queued.cpu)} CPU` })]);
      if (partition) {
        const name = partition.partition, type = typeName(partition.gpu_type);
        if (request.gpu > 0) {
          const ahead = Number(partition.pending_gpu_ahead) || 0;
          if (partition.gpu_free - ahead < request.gpu && partition.gpu_free >= request.gpu) checks.push(["warn", t("chkContended", { partition: name, free: num(partition.gpu_free, 0), ahead: num(ahead, 0) })]);
          else if (partition.max_gpu_free_node >= request.gpu) checks.push(["ok", t("chkClusterOk", { partition: name, value: num(partition.max_gpu_free_node, 0), type })]);
          else if (partition.gpu_free >= request.gpu) checks.push(["warn", t("chkClusterSplit", { partition: name, value: num(partition.gpu_free, 0), node: num(partition.max_gpu_free_node, 0), type })]);
          else checks.push(["warn", t("chkClusterBusy", { partition: name, value: num(partition.gpu_free, 0), type })]);
        } else if (partition.max_cpu_free_node >= request.cpu) {
          checks.push(["ok", t("chkCpuOk", { partition: name, value: num(partition.max_cpu_free_node, 0) })]);
        } else {
          checks.push(["warn", t("chkCpuBusy", { partition: name, need: request.cpu, value: num(partition.max_cpu_free_node, 0) })]);
        }
      }
      const burst = qosOf(BURST);
      if (!request.gpu && burst && request.hours <= wallHours(burst.limits.max_wall)) checks.push(["info", t("chkBurst", { wall: wallText(burst.limits.max_wall), free: num(head(BURST, "cpu"), 0) })]);
    }
    const verdict = checks.some(([level]) => level === "bad") ? "no" : checks.some(([level]) => level === "warn") ? "wait" : "go";
    el("planVerdict").className = `verdict ${verdict}`;
    el("planVerdict").innerHTML = `<i aria-hidden="true">${verdict === "go" ? "✓" : verdict === "wait" ? "◷" : "✕"}</i>${safe(t(verdict === "go" ? "vGo" : verdict === "wait" ? "vWait" : "vNo"))}`;
    const icons = { ok: "✓", warn: "!", bad: "✕", info: "i" };
    el("planChecks").innerHTML = checks.map(([level, text]) => `<li class="lv-${level}"><i aria-hidden="true">${icons[level]}</i><span>${safe(text)}</span></li>`).join("");
  }

  /* ---------- Members ---------- */

  function memberRows() {
    const rows = new Map();
    const row = (user) => {
      if (!rows.has(user)) rows.set(user, { user, running: 0, waiting: 0, throttled: 0, cpu: 0, memory_gb: 0, gpu: 0, gpu_types: {}, burst: 0, storage: null });
      return rows.get(user);
    };
    (state.snapshot.users || []).forEach((u) => Object.assign(row(u.user), {
      running: u.running_jobs || 0, cpu: u.cpu || 0, memory_gb: u.memory_gb || 0, gpu: u.gpu || 0, gpu_types: u.gpu_types || {}, burst: u.burst?.cpu || 0
    }));
    state.snapshot.jobs.filter((j) => j.state === "PENDING" && !j.system).forEach((j) => {
      const r = row(j.user), n = Number(j.task_count) || 1;
      if (j.pending_class === "throttled") r.throttled += n; else if (WAITING.has(j.pending_class)) r.waiting += n;
    });
    (state.snapshot.storage?.members || []).forEach((m) => { row(m.user).storage = m; });
    return [...rows.values()];
  }

  function storageBadge(m) {
    if (!m) return "";
    const time = dateTime(m.measured_at);
    if (m.source === "quota") return `<span class="tag ok" title="${safe(t("exactTitle", { time }))}">${safe(t("exact"))}</span>`;
    if (m.source === "unreadable") return `<span class="tag warn" title="${safe(t("unreadableTitle"))}">${safe(t("unreadable"))}</span>`;
    if (!m.complete) return `<span class="tag warn" title="${safe(t("partialTitle", { time }))}">${safe(t("partial"))}</span>`;
    return `<span class="tag" title="${safe(t("scanTitle", { time }))}">${safe(t("scanned"))}</span>`;
  }

  function renderMembers() {
    const rows = memberRows();
    const storage = state.snapshot.storage;
    const sortValue = (r, key) => key === "user" ? r.user : key === "jobs" ? r.running + r.waiting + r.throttled : key === "storage" ? Number(r.storage?.used_gb) || 0 : Number(r[key]) || 0;
    rows.sort((a, b) => {
      if (state.sortKey === "default") return (b.gpu - a.gpu) || (b.cpu - a.cpu) || ((b.storage?.used_gb || 0) - (a.storage?.used_gb || 0)) || a.user.localeCompare(b.user);
      const x = sortValue(a, state.sortKey), y = sortValue(b, state.sortKey);
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.sortDir;
    });
    document.querySelectorAll("[data-sort]").forEach((th) => th.setAttribute("aria-sort", th.dataset.sort === state.sortKey ? (state.sortDir > 0 ? "ascending" : "descending") : "none"));
    if (!rows.length) { el("membersBody").innerHTML = `<tr><td colspan="7" class="empty">${safe(t("noMembers"))}</td></tr>`; return; }
    const cell = (value, suffix = "") => (Number(value) > 0 ? `${num(value)}${suffix}` : `<span class="zero">0</span>`);
    let html = rows.map((r) => {
      const types = Object.entries(r.gpu_types).filter(([, v]) => v > 0).map(([k, v]) => `${v}× ${typeName(k)}`).join(", ");
      const jobs = [r.running && t("runShort", { value: num(r.running, 0) }), r.waiting && t("waitShort", { value: num(r.waiting, 0) }), r.throttled && t("throttledShortN", { value: num(r.throttled, 0) })].filter(Boolean);
      const st = r.storage;
      return `<tr class="member-row ${state.member === r.user ? "selected" : ""}" data-user="${safe(r.user)}" tabindex="0">
        <td><span class="who"><i style="background:${colorVar(r.user)}"></i>${safe(r.user)}</span></td>
        <td class="num">${jobs.length ? safe(jobs.join(" · ")) : `<span class="zero">—</span>`}</td>
        <td class="num">${cell(r.gpu)}${types ? `<small>${safe(types)}</small>` : ""}</td>
        <td class="num">${cell(r.cpu)}</td><td class="num">${cell(r.memory_gb, " GB")}</td><td class="num">${cell(r.burst)}</td>
        <td class="num">${st ? `${st.used_gb == null ? "—" : `${st.source === "scan" && !st.complete ? "≥ " : ""}${bytes(st.used_gb)}`}${storageBadge(st)}` : `<span class="zero">—</span>`}</td>
      </tr>`;
    }).join("");
    if (storage && storage.unattributed_gb > 0) {
      html += `<tr><td><span class="who"><i style="background:var(--unattributed)"></i>${safe(t("unattributed"))}</span><small>${safe(t("unattributedNote"))}</small></td>
        <td></td><td></td><td></td><td></td><td></td><td class="num">${bytes(storage.unattributed_gb)}</td></tr>`;
    }
    el("membersBody").innerHTML = html;
  }

  /* ---------- Jobs ---------- */

  const jobCategory = (j) => (j.system ? "OTHER" : j.state !== "PENDING" ? "RUNNING" : j.pending_class === "throttled" ? "THROTTLED" : j.pending_class === "scheduled" ? "OTHER" : "WAITING");

  function groupJobs(jobs) {
    const groups = new Map();
    jobs.forEach((job) => {
      const cat = jobCategory(job);
      const key = [job.user, job.name, cat, job.partition, job.cpu, job.memory_gb, job.gpu_label, cat === "WAITING" ? job.reason : ""].join("|");
      if (!groups.has(key)) groups.set(key, { key, cat, jobs: [], count: 0, first: job });
      const group = groups.get(key);
      group.jobs.push(job);
      group.count += Number(job.task_count) || 1;
    });
    return [...groups.values()];
  }

  function reasonLabel(code) {
    const table = messages[state.lang].reasons, fallback = messages.en.reasons;
    return Object.prototype.hasOwnProperty.call(table, code) ? table[code] : Object.prototype.hasOwnProperty.call(fallback, code) ? fallback[code] : code;
  }

  function statusCell(group) {
    const job = group.first;
    if (job.system) return `<span class="badge">${safe(t("sSystem"))}</span>`;
    if (group.cat === "RUNNING") return `<span class="badge ok">${safe(t("sRunning"))}</span>`;
    if (group.cat === "THROTTLED") return `<span class="badge accent">${safe(t("sThrottled"))}</span>`;
    if (job.pending_class === "scheduled") return `<span class="badge">${safe(t("sScheduled"))}</span>`;
    return `<span class="badge warn" title="${safe(job.reason)}">${safe(reasonLabel(job.reason))}</span>`;
  }

  function timingCell(group) {
    const now = Date.now();
    if (group.cat === "RUNNING") {
      const ends = group.jobs.map((j) => j.end_time).filter(Boolean).sort();
      const starts = group.jobs.map((j) => j.start_time).filter(Boolean).sort();
      if (!ends.length) return "—";
      const range = ends.length > 1 && ends[0] !== ends[ends.length - 1] ? `${dateTime(ends[0])} – ${dateTime(ends[ends.length - 1])}` : dateTime(ends[0]);
      return `${safe(t("endsBy", { time: range }))}<small>${safe(t("endsByNote", { ago: starts.length ? duration(now - new Date(starts[0]).getTime()) : "—" }))}</small>`;
    }
    if (group.cat === "THROTTLED") return `<span class="zero">${safe(t("followsArray"))}</span>`;
    const starts = group.jobs.map((j) => j.start_time).filter(Boolean).sort();
    return starts.length ? `${safe(t("startEst", { time: dateTime(starts[0]) }))}<small>${safe(t("slurmEstNote"))}</small>` : `<span class="zero">${safe(t("notScheduled"))}</span>`;
  }

  function renderJobs() {
    const jobs = state.snapshot?.jobs || [];
    const count = (cat) => jobs.filter((j) => jobCategory(j) === cat && !j.system).reduce((s, j) => s + (Number(j.task_count) || 1), 0);
    const scheduled = jobs.filter((j) => j.pending_class === "scheduled" && !j.system).reduce((s, j) => s + (Number(j.task_count) || 1), 0);
    el("jobsSummary").innerHTML = safe(t("jobsSummary", { running: num(count("RUNNING"), 0), waiting: num(count("WAITING"), 0), throttled: num(count("THROTTLED"), 0), scheduled: num(scheduled, 0) }))
      + (state.member ? ` <button type="button" class="chip" id="clearMember">${safe(t("clearFilter", { user: state.member }))} ✕</button>` : "");
    const query = state.search.trim().toLowerCase();
    const filtered = jobs.filter((job) => (state.filter === "ALL" || jobCategory(job) === state.filter)
      && (!state.member || job.user === state.member)
      && (!query || [job.name, job.user, job.job_id, job.partition].some((v) => String(v || "").toLowerCase().includes(query))));
    if (!filtered.length) { el("jobsBody").innerHTML = `<tr><td colspan="5" class="empty">${safe(t("noJobs"))}</td></tr>`; return; }
    const order = { RUNNING: 0, WAITING: 1, THROTTLED: 2, OTHER: 3 };
    el("jobsBody").innerHTML = groupJobs(filtered).sort((a, b) => order[a.cat] - order[b.cat]).map((group) => {
      const job = group.first;
      const ids = group.jobs.map((j) => j.job_id);
      const open = state.expanded.has(group.key);
      const idLine = ids.length === 1 ? `#${safe(ids[0])}` : `<button type="button" class="link" data-expand="${safe(group.key)}">${safe(open ? t("hideIds") : t("showIds", { count: ids.length }))}</button>`;
      return `<tr>
        <td><div class="job-name"><strong>${safe(job.name || `#${job.job_id}`)}</strong>${group.count > 1 ? `<span class="count">×${num(group.count, 0)}</span>` : ""}</div>
          <small>${idLine} · ${safe(job.partition || "—")} · ${safe(job.qos)}</small>${open ? `<div class="ids">${ids.map((id) => `#${safe(id)}`).join(" ")}</div>` : ""}</td>
        <td><span class="who"><i style="background:${colorVar(job.user)}"></i>${safe(job.user || "—")}</span></td>
        <td>${statusCell(group)}</td>
        <td>${reqLine(job)}</td>
        <td>${timingCell(group)}</td>
      </tr>`;
    }).join("");
  }

  /* ---------- Charts (inline SVG, one y-axis each) ---------- */

  function niceMax(value) {
    if (!(value > 0)) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    return [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= value);
  }
  const zoned = (options) => new Intl.DateTimeFormat(locale(), { timeZone: TIME_ZONE, ...options });
  const localHour = (ms) => Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(ms));
  const dayLabel = (ms) => zoned({ month: "short", day: "numeric" }).format(ms);
  const weekdayLabel = (ms) => zoned({ weekday: "short", day: "numeric" }).format(ms);
  const hourLabel = (ms) => zoned({ hour: "numeric" }).format(ms);
  const tipTime = (ms) => zoned({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(ms);

  function contentWidth(node) {
    const style = window.getComputedStyle(node);
    return node.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
  }
  function showTip(html, event) {
    const tip = el("tooltip");
    tip.innerHTML = html; tip.hidden = false;
    const box = tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - box.width - 8, event.clientX + 14);
    const top = event.clientY - box.height - 12 < 8 ? event.clientY + 16 : event.clientY - box.height - 12;
    tip.style.left = `${Math.max(8, left)}px`; tip.style.top = `${top}px`;
  }
  const hideTip = () => { el("tooltip").hidden = true; };

  function timeChart(container, { points, t0, t1, limit = 0, step = false, color = "var(--m0)", height = 170, tip, ticks, max: fixedMax, format = (v) => num(v, v < 10 ? 1 : 0), limitLabel = t("noLimit") }) {
    if (!points.length) { container.innerHTML = ""; return; }
    const width = Math.max(240, contentWidth(container));
    const pad = { l: 44, r: 10, t: 14, b: 24 };
    const max = fixedMax || niceMax(Math.max(limit, ...points.map((p) => p.v)) * 1.05);
    const x = (time) => pad.l + ((time - t0) / (t1 - t0)) * (width - pad.l - pad.r);
    const y = (value) => pad.t + (1 - value / max) * (height - pad.t - pad.b);
    let line = "";
    points.forEach((p, i) => {
      if (!i) line += `M${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
      else line += step ? `H${x(p.t).toFixed(1)}V${y(p.v).toFixed(1)}` : `L${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
    });
    if (step) line += `H${x(t1).toFixed(1)}`;
    const end = step ? t1 : points[points.length - 1].t;
    const area = `${line}L${x(end).toFixed(1)},${y(0)}L${x(points[0].t).toFixed(1)},${y(0)}Z`;
    const grid = [0, max / 2, max].map((v) => `<line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${safe(format(v))}</text>`).join("");
    const spacing = ticks.length > 1 ? Math.abs(x(ticks[1][0]) - x(ticks[0][0])) : Infinity;
    const every = spacing < 52 ? Math.ceil(52 / spacing) : 1;
    const xTicks = ticks.filter((_, i) => i % every === 0).map(([time, label]) => `<text class="axis" x="${x(time)}" y="${height - 6}" text-anchor="middle">${safe(label)}</text>`).join("");
    const limitLine = limit > 0 ? `<line class="limit" x1="${pad.l}" x2="${width - pad.r}" y1="${y(limit)}" y2="${y(limit)}"/>
      <text class="limit-label" x="${width - pad.r}" y="${y(limit) - 5}" text-anchor="end">${safe(limitLabel)} ${safe(format(limit))}</text>` : "";
    container.innerHTML = `<svg width="${width}" height="${height}" role="img">${grid}${xTicks}
      <path class="area" d="${area}" style="fill:${color}"/>${limitLine}<path class="line" d="${line}" style="stroke:${color}"/>
      <line class="cross" y1="${pad.t}" y2="${y(0)}"/><circle class="dot" r="4" style="fill:${color}"/>
      <rect class="hit" x="${pad.l}" y="0" width="${width - pad.l - pad.r}" height="${height}"/></svg>`;
    const svg = container.firstElementChild;
    const hit = svg.querySelector(".hit");
    hit.addEventListener("mousemove", (event) => {
      const rect = svg.getBoundingClientRect();
      const time = t0 + ((event.clientX - rect.left - pad.l) / (width - pad.l - pad.r)) * (t1 - t0);
      let point = points[0];
      if (step) points.forEach((p) => { if (p.t <= time) point = p; });
      else point = points.reduce((best, p) => (Math.abs(p.t - time) < Math.abs(best.t - time) ? p : best), points[0]);
      const px = step ? x(Math.max(t0, Math.min(t1, time))) : x(point.t);
      svg.classList.add("hovering");
      svg.querySelector(".cross").setAttribute("x1", px); svg.querySelector(".cross").setAttribute("x2", px);
      svg.querySelector(".dot").setAttribute("cx", px); svg.querySelector(".dot").setAttribute("cy", y(point.v));
      showTip(tip(point, step ? time : point.t), event);
    });
    hit.addEventListener("mouseleave", () => { svg.classList.remove("hovering"); hideTip(); });
  }

  function stackedBars(container, { days, unit, height = 170 }) {
    if (!days.length) { container.innerHTML = ""; return; }
    const width = Math.max(240, contentWidth(container));
    const pad = { l: 44, r: 6, t: 18, b: 24 };
    const totals = days.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0));
    const max = niceMax(Math.max(...totals) * 1.05);
    const band = (width - pad.l - pad.r) / days.length;
    const barWidth = Math.min(40, band * 0.62);
    const y = (value) => pad.t + (1 - value / max) * (height - pad.t - pad.b);
    const grid = [0, max / 2, max].map((v) => `<line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${num(v, 0)}</text>`).join("");
    const bars = days.map((day, i) => {
      const x = pad.l + band * i + (band - barWidth) / 2;
      let base = 0;
      const visible = day.segments.filter((s) => s.value > 0);
      const rects = visible.map((s, k) => {
        const top = y(base + s.value), bottom = y(base) - (k ? 2 : 0);
        base += s.value;
        const h = Math.max(0, bottom - top);
        if (k === visible.length - 1 && h > 0) {
          const r = Math.min(4, h, barWidth / 2);
          return `<path d="M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + barWidth - r}Q${x + barWidth},${top} ${x + barWidth},${top + r}V${bottom}Z" style="fill:${s.color}"/>`;
        }
        return `<rect x="${x}" y="${top}" width="${barWidth}" height="${h}" style="fill:${s.color}"/>`;
      }).join("");
      const label = totals[i] > 0 ? `<text class="bar-total" x="${x + barWidth / 2}" y="${y(totals[i]) - 5}" text-anchor="middle">${num(totals[i], 0)}</text>` : "";
      return `${rects}${label}<text class="axis" x="${x + barWidth / 2}" y="${height - 6}" text-anchor="middle">${safe(band < 46 ? day.short : day.label)}</text>
        <rect class="hit" data-day="${i}" x="${pad.l + band * i}" y="0" width="${band}" height="${height}"/>`;
    }).join("");
    container.innerHTML = `<svg width="${width}" height="${height}" role="img">${grid}${bars}</svg>`;
    container.firstElementChild.addEventListener("mousemove", (event) => {
      const target = event.target.closest("[data-day]");
      if (!target) return hideTip();
      const day = days[Number(target.dataset.day)];
      const rows = day.segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
        .map((s) => `<span class="tip-row"><i style="background:${s.color}"></i>${safe(s.label)}<b>${num(s.value)} ${unit}</b></span>`).join("");
      showTip(`<strong>${safe(day.title)}</strong>${rows}<span class="tip-row total">${safe(t("total"))}<b>${num(totals[Number(target.dataset.day)])} ${unit}</b></span>`, event);
    });
    container.firstElementChild.addEventListener("mouseleave", hideTip);
  }

  function renderForecast() {
    const now = Date.now(), horizon = now + 24 * 3600000;
    let value = Number(qosOf(MAIN).allocated.gpu) || 0;
    const points = [{ t: now, v: value }];
    runningJobs().filter((j) => j.qos === MAIN && Number(j.gpus) > 0 && j.end_time)
      .map((j) => ({ t: Math.max(now, new Date(j.end_time).getTime()), gpus: Number(j.gpus) * (Number(j.task_count) || 1) }))
      .filter((e) => e.t <= horizon).sort((a, b) => a.t - b.t)
      .forEach((e) => { value = Math.max(0, value - e.gpus); points.push({ t: e.t, v: value }); });
    const ticks = [[now, t("now")]];
    for (let h = 6; h <= 24; h += 6) ticks.push([now + h * 3600000, hourLabel(now + h * 3600000)]);
    ticks[ticks.length - 1][0] -= 1;
    timeChart(el("forecastChart"), { points, t0: now, t1: horizon, limit: Number(qosOf(MAIN).limits.gpu) || 0, step: true, height: 130, ticks,
      tip: (p, time) => `<strong>${safe(tipTime(time))}</strong><span class="tip-row">${safe(t("inUseTip", { value: num(p.v), res: "GPU" }))}</span>` });
  }

  function renderHistory() {
    const usage = state.snapshot.usage;
    const metric = state.metric;
    const res = metric === "gpu" ? "GPU" : "CPU";
    el("inUseTitle").textContent = t("inUseTitle", { res });
    el("dailyTitle").textContent = t("dailyTitle", { res });
    document.querySelectorAll("[data-metric]").forEach((b) => b.classList.toggle("active", b.dataset.metric === metric));
    if (!usage || !Array.isArray(usage.gpu_in_use) || !Array.isArray(usage.cpu_in_use) || !Array.isArray(usage.daily) || !Array.isArray(usage.members)) {
      el("inUseChart").innerHTML = `<p class="empty">${safe(t("historyUnavailable"))}</p>`;
      el("dailyChart").innerHTML = ""; el("usageBody").innerHTML = "";
      return;
    }
    const start = new Date(usage.start).getTime(), stepMs = (usage.hour_seconds || 3600) * 1000;
    const series = metric === "gpu" ? usage.gpu_in_use : usage.cpu_in_use;
    const points = series.map((v, i) => ({ t: start + i * stepMs, v }));
    const t1 = start + series.length * stepMs;
    const ticks = points.filter((p) => localHour(p.t) === 0).map((p) => [p.t, dayLabel(p.t)]);
    const limit = Number(qosOf(MAIN).limits[metric === "gpu" ? "gpu" : "cpu"]) || 0;
    timeChart(el("inUseChart"), { points, t0: start, t1, limit, ticks,
      tip: (p) => `<strong>${safe(tipTime(p.t))}</strong><span class="tip-row">${safe(t("inUseTip", { value: num(p.v), res }))}</span>` });
    const key = metric === "gpu" ? "gpu_hours" : "cpu_hours";
    const people = [...new Set(usage.daily.flatMap((d) => Object.keys(d.members)))];
    stackedBars(el("dailyChart"), {
      unit: `${res}·h`,
      days: usage.daily.map((d) => {
        const ms = new Date(`${d.date}T12:00:00Z`).getTime();
        return { label: weekdayLabel(ms), short: zoned({ day: "numeric", timeZone: "UTC" }).format(ms), title: zoned({ weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(ms),
          segments: people.map((user) => ({ label: user, color: colorVar(user), value: Number(d.members[user]?.[key]) || 0 })) };
      })
    });
    const maxOf = (k) => Math.max(1, ...usage.members.map((m) => Number(m[k]) || 0));
    el("usageBody").innerHTML = usage.members.length ? usage.members.map((m) => {
      const failRate = m.finished ? (m.failed / m.finished) * 100 : 0;
      const bar = (k) => `<div class="mini"><span class="mini-bar"><i style="width:${pct(m[k], maxOf(k))}%;background:${colorVar(m.user)}"></i></span><b>${num(m[k], 0)}</b></div>`;
      return `<tr><td><span class="who"><i style="background:${colorVar(m.user)}"></i>${safe(m.user)}</span></td>
        <td class="num">${bar("gpu_hours")}</td><td class="num">${bar("cpu_hours")}</td><td class="num">${num(m.finished, 0)}</td>
        <td class="num ${failRate >= 10 ? "fail-high" : ""}" title="${num(m.failed, 0)} / ${num(m.finished, 0)}">${m.finished ? `${num(failRate, 1)}%` : "—"}</td></tr>`;
    }).join("") : `<tr><td colspan="5" class="empty">—</td></tr>`;
  }

  /* ---------- Storage ---------- */

  function renderStorage() {
    const storage = state.snapshot.storage;
    if (!storage || storage.used_gb == null) {
      el("storageSummary").textContent = t("storageUnavailable");
      el("storageBar").innerHTML = ""; el("storageLegend").innerHTML = ""; el("storageTrend").textContent = ""; el("storageHistory").innerHTML = "";
      return;
    }
    const total = storage.quota_gb || storage.used_gb;
    el("storageSummary").textContent = t("storageSummary", {
      used: bytes(storage.used_gb), quota: storage.quota_gb ? bytes(storage.quota_gb) : "—", free: storage.quota_gb ? bytes(Math.max(0, storage.quota_gb - storage.used_gb)) : "—",
      files: num(storage.files, 0), scan: storage.scanned_at ? dateTime(storage.scanned_at) : t("never")
    });
    const items = (storage.members || []).filter((m) => Number(m.used_gb) > 0)
      .map((m) => ({ label: m.user, value: m.used_gb, color: colorVar(m.user), prefix: m.source === "scan" && !m.complete ? "≥ " : "" }));
    if (storage.unattributed_gb > 0) items.push({ label: t("unattributed"), value: storage.unattributed_gb, color: "var(--unattributed)", prefix: "" });
    if (storage.quota_gb) items.push({ label: t("free_"), value: Math.max(0, storage.quota_gb - storage.used_gb), color: "transparent", free: true, prefix: "" });
    el("storageBar").innerHTML = items.map((item) => {
      const width = pct(item.value, total);
      return `<i class="${item.free ? "free" : ""}" style="width:${width}%;background:${item.color}" title="${safe(item.label)}: ${item.prefix}${bytes(item.value)}">${width > 9 && !item.free ? `<span>${safe(item.label)}</span>` : ""}</i>`;
    }).join("");
    el("storageLegend").innerHTML = items.map((item) => `<li><i class="dot ${item.free ? "free" : ""}" style="background:${item.color}"></i><span>${safe(item.label)}</span><b>${item.prefix}${bytes(item.value)}</b><small>${num(pct(item.value, total), 0)}%</small></li>`).join("");

    const history = (storage.history || []).map((p) => ({ t: new Date(p.t).getTime(), v: Number(p.used_gb) || 0 })).filter((p) => p.t > 0);
    const last = history[history.length - 1];
    const recent = last ? history.filter((p) => last.t - p.t <= 7 * 86400000) : [];
    const spanDays = recent.length > 1 ? (last.t - recent[0].t) / 86400000 : 0;
    if (spanDays < 0.75) { el("storageTrend").textContent = t("storageTrendCollecting"); el("storageHistory").innerHTML = ""; return; }
    const rate = (last.v - recent[0].v) / spanDays, days = Math.max(1, Math.round(spanDays));
    if (rate <= 0.5) el("storageTrend").textContent = t("storageTrendFlat", { days });
    else if (storage.quota_gb) el("storageTrend").textContent = t("storageTrend", { rate: bytes(rate), days, eta: t("days", { value: num(Math.max(0, (storage.quota_gb - storage.used_gb) / rate), 0) }) });
    else el("storageTrend").textContent = t("storageTrendFull", { rate: bytes(rate), days });
    timeChart(el("storageHistory"), { points: history, t0: history[0].t, t1: last.t, limit: storage.quota_gb || 0, color: "var(--m2)", height: 120,
      ticks: [[history[0].t, dayLabel(history[0].t)], [last.t - 1, dayLabel(last.t)]],
      max: (storage.quota_gb || Math.max(...history.map((p) => p.v))) * 1.08, format: bytes, limitLabel: t("quotaLabel"),
      tip: (p) => `<strong>${safe(tipTime(p.t))}</strong><span class="tip-row">${safe(bytes(p.v))}</span>` });
  }

  /* ---------- About & sync ---------- */

  function publishEveryMs() { return (Number(state.snapshot?.publish_every_s) || 300) * 1000; }

  function renderAbout() {
    const s = state.snapshot;
    const defs = [
      ["dSnapshot", t("dSnapshotBody", { time: clock(s.generated_at), ago: duration(Date.now() - new Date(s.generated_at).getTime()), slurm: clock(s.slurm_last_update || s.generated_at),
        every: Math.round(publishEveryMs() / 60000), check: Math.round(REFRESH_MS / 1000) })],
      ["dInUse", t("dInUseBody")], ["dFree", t("dFreeBody")], ["dQueue", t("dQueueBody")],
      ["dBurst", t("dBurstBody")], ["dTimes", t("dTimesBody")], ["dBoundary", t("dBoundaryBody")]
    ];
    el("aboutDefs").innerHTML = defs.map(([k, body]) => `<div><dt>${safe(t(k))}</dt><dd>${safe(body)}</dd></div>`).join("");
  }

  function renderSync() {
    const s = state.snapshot;
    if (!s) return;
    const generated = new Date(s.generated_at).getTime();
    const age = Date.now() - generated;
    const stale = isStale(s);
    let next = generated + publishEveryMs();
    while (next < Date.now() - 60000) next += publishEveryMs();
    el("sync").className = `sync ${stale || state.source !== "live" ? "is-stale" : ""}`;
    el("syncAge").textContent = age < 60000 ? t("syncJust") : t("syncAgo", { ago: duration(age) });
    el("syncDetail").textContent = t("syncDetail", { time: clock(s.generated_at), next: dateTime(new Date(next).toISOString(), false) });
  }

  function render() {
    const s = state.snapshot;
    if (!s) { el("notice").hidden = !state.noticeKey; el("notice").textContent = state.noticeKey ? t(state.noticeKey) : ""; return; }
    assignColors([...(s.users || []).map((u) => u.user), ...(s.storage?.members || []).map((m) => m.user), ...s.jobs.map((j) => j.user),
      ...(s.usage?.members || []).map((m) => m.user), ...(s.usage?.daily || []).flatMap((d) => Object.keys(d.members || {}))]);
    const stale = isStale(s);
    renderSync();
    const noticeKey = state.noticeKey || (stale ? "staleNotice" : "");
    el("notice").hidden = !noticeKey;
    el("notice").textContent = noticeKey ? t(noticeKey) : "";
    el("sourceBadge").textContent = state.source === "demo" ? t("previewData") : state.source === "cache" ? t("cachedSnapshot") : stale ? t("stale") : t("publicSnapshot");
    el("sourceBadge").className = `badge ${stale || state.source !== "live" ? "warn" : "ok"}`;
    renderAvailable(); renderQuota(); renderQueue(); renderCluster(); renderWait();
    renderPlannerOptions(); renderPlanner(); renderForecast();
    renderMembers(); renderJobs(); renderHistory(); renderStorage(); renderAbout();
    writeUrl();
  }

  function applyTranslations() {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-title]").forEach((node) => { node.title = t(node.dataset.i18nTitle); });
    document.querySelectorAll("[data-lang]").forEach((button) => {
      const active = button.dataset.lang === state.lang;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    render();
  }

  /* ---------- URL state ---------- */

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("lang") === "zh" || params.get("lang") === "en") state.lang = params.get("lang");
    if (params.get("member")) state.member = params.get("member");
    const filter = (params.get("filter") || "").toUpperCase();
    if (["RUNNING", "WAITING", "THROTTLED", "OTHER"].includes(filter)) state.filter = filter;
    if (params.get("q")) state.search = params.get("q");
    if (params.get("metric") === "cpu") state.metric = "cpu";
  }
  function writeUrl() {
    const params = new URLSearchParams();
    if (state.member) params.set("member", state.member);
    if (state.filter !== "ALL") params.set("filter", state.filter.toLowerCase());
    if (state.search.trim()) params.set("q", state.search.trim());
    if (state.metric !== "gpu") params.set("metric", state.metric);
    if (state.lang === "zh") params.set("lang", "zh");
    const query = params.toString();
    try { window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`); } catch { /* sandboxed */ }
  }

  /* ---------- Data loading ---------- */

  // Conditional requests: GitHub answers 304 for an unchanged snapshot, and 304s do not count
  // against the 60 requests/hour unauthenticated limit (shared by everyone behind one IP).
  async function loadSnapshot() {
    if (state.loading) return;
    state.loading = true;
    el("refreshButton").classList.add("loading");
    try {
      if (!API_URL) throw new Error("api-missing");
      const headers = { Accept: "application/vnd.github.raw+json" };
      if (state.etag && state.source === "live") headers["If-None-Match"] = state.etag;
      const response = await fetch(API_URL, { cache: "no-store", headers });
      state.lastCheck = Date.now();
      if (response.status === 304) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      if (!validateSnapshot(snapshot)) throw new Error("invalid-data");
      state.etag = response.headers.get("ETag") || "";
      state.snapshot = normalize(snapshot); state.source = "live"; state.noticeKey = "";
      writeStorage(CACHE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      if (state.snapshot && state.source === "live") {
        state.noticeKey = "refreshFailedCache";
      } else {
        let cached = null;
        try { cached = JSON.parse(readStorage(CACHE_KEY) || "null"); } catch { cached = null; }
        if (validateSnapshot(cached)) {
          state.snapshot = normalize(cached); state.source = "cache"; state.noticeKey = "refreshFailedCache";
        } else {
          try {
            const response = await fetch("./demo-status.json", { cache: "no-store" });
            const demo = await response.json();
            if (!validateSnapshot(demo)) throw new Error("invalid-demo");
            state.snapshot = normalize(demo); state.source = "demo"; state.noticeKey = API_URL ? "refreshFailedDemo" : "apiMissing";
          } catch {
            state.noticeKey = error?.message === "invalid-data" ? "invalidData" : "refreshError";
          }
        }
      }
    } finally {
      state.loading = false;
      el("refreshButton").classList.remove("loading");
      render();
    }
  }

  /* ---------- Navigation ---------- */

  function setupNav() {
    const collapsed = new Set((readStorage(NAV_KEY) || "").split(",").filter(Boolean));
    document.querySelectorAll(".nav-group").forEach((group, index) => {
      const button = group.querySelector(":scope > button");
      const set = (closed) => { group.classList.toggle("collapsed", closed); button.setAttribute("aria-expanded", String(!closed)); };
      set(collapsed.has(String(index)));
      button.addEventListener("click", () => {
        const closed = !group.classList.contains("collapsed");
        set(closed);
        if (closed) collapsed.add(String(index)); else collapsed.delete(String(index));
        writeStorage(NAV_KEY, [...collapsed].join(","));
      });
    });
    const links = [...document.querySelectorAll(".nav-group a")];
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const visible = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0));
      const top = [...document.querySelectorAll("main .section")].find((section) => (visible.get(section.id) || 0) > 0);
      if (top) links.forEach((a) => a.classList.toggle("active", a === byId.get(top.id)));
    }, { rootMargin: "-70px 0px -55% 0px", threshold: [0, 0.01, 0.5] });
    document.querySelectorAll("main .section").forEach((section) => observer.observe(section));
    const toggle = (open) => { document.body.classList.toggle("nav-open", open); el("menuButton").setAttribute("aria-expanded", String(open)); };
    el("menuButton").addEventListener("click", () => toggle(!document.body.classList.contains("nav-open")));
    links.forEach((a) => a.addEventListener("click", () => toggle(false)));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") toggle(false); });
  }

  /* ---------- Events ---------- */

  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => {
    state.lang = button.dataset.lang === "zh" ? "zh" : "en";
    writeStorage(LANG_KEY, state.lang);
    applyTranslations();
  }));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderJobs(); writeUrl();
  }));
  document.querySelectorAll("[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (state.sortKey === key) state.sortDir *= -1; else { state.sortKey = key; state.sortDir = key === "user" ? 1 : -1; }
    renderMembers();
  }));
  const selectMember = (row) => {
    if (!row) return;
    state.member = state.member === row.dataset.user ? "" : row.dataset.user;
    renderMembers(); renderJobs(); writeUrl();
    if (state.member) el("jobs").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  el("membersBody").addEventListener("click", (event) => selectMember(event.target.closest(".member-row")));
  el("membersBody").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectMember(event.target.closest(".member-row")); }
  });
  el("jobsBody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-expand]");
    if (!button) return;
    const key = button.dataset.expand;
    if (state.expanded.has(key)) state.expanded.delete(key); else state.expanded.add(key);
    renderJobs();
  });
  el("jobsSummary").addEventListener("click", (event) => {
    if (event.target.closest("#clearMember")) { state.member = ""; renderMembers(); renderJobs(); writeUrl(); }
  });
  el("jobSearch").addEventListener("input", (event) => { state.search = event.target.value; renderJobs(); writeUrl(); });
  el("refreshButton").addEventListener("click", loadSnapshot);
  el("copyCommand").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el("optinCommand").textContent);
      el("copyCommand").textContent = t("copied");
      setTimeout(() => { el("copyCommand").textContent = t("copy"); }, 1600);
    } catch { /* clipboard unavailable; the command stays selectable */ }
  });
  ["planType", "planGpu", "planCpu", "planMem", "planHours"].forEach((id) => el(id).addEventListener("input", () => { if (state.snapshot) renderPlanner(); }));
  el("plannerForm").addEventListener("submit", (event) => event.preventDefault());
  document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => {
    state.metric = button.dataset.metric === "cpu" ? "cpu" : "gpu";
    renderHistory(); writeUrl();
  }));
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { if (state.snapshot) { renderForecast(); renderHistory(); renderStorage(); } }, 150);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - state.lastCheck > REFRESH_MS / 2) loadSnapshot(); });

  // Info buttons carry a message key; hover/focus shows it, tap toggles it on touch screens.
  let pinnedTip = null;
  const tipFor = (button) => `<span>${safe(button.dataset.tipText || t(button.dataset.tip))}</span>`;
  const tipAt = (button) => { const r = button.getBoundingClientRect(); return { clientX: r.left, clientY: r.bottom + 4 + 0 * r.top }; };
  document.addEventListener("mouseover", (event) => { const b = event.target.closest(".info"); if (b) showTip(tipFor(b), event); });
  document.addEventListener("mouseout", (event) => { if (event.target.closest(".info") && !pinnedTip) hideTip(); });
  document.addEventListener("focusin", (event) => { const b = event.target.closest(".info"); if (b) showTip(tipFor(b), tipAt(b)); });
  document.addEventListener("focusout", (event) => { if (event.target.closest(".info")) { pinnedTip = null; hideTip(); } });
  document.addEventListener("click", (event) => {
    const b = event.target.closest(".info");
    if (b) { pinnedTip = pinnedTip === b ? null : b; if (pinnedTip) showTip(tipFor(b), tipAt(b)); else hideTip(); }
    else if (pinnedTip) { pinnedTip = null; hideTip(); }
  });

  const THEME_KEY = "icic-resource-board:theme";
  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    writeStorage(THEME_KEY, theme);
    document.querySelectorAll("[data-theme-set]").forEach((b) => b.classList.toggle("active", b.dataset.themeSet === theme));
  };
  document.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));
  setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");

  readUrl();
  if (state.plan.partition) {
    el("planGpu").value = state.plan.gpu ?? 1; el("planCpu").value = state.plan.cpu ?? 8;
    el("planMem").value = state.plan.mem ?? 64; el("planHours").value = state.plan.hours ?? 24;
  }
  el("jobSearch").value = state.search;
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item.dataset.filter === state.filter));
  setupNav();
  applyTranslations();
  loadSnapshot();
  window.setInterval(() => { if (!document.hidden) loadSnapshot(); }, REFRESH_MS);
  window.setInterval(() => { if (state.snapshot) { renderSync(); } }, 20000);
})();
