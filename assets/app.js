(() => {
  "use strict";

  const config = window.ICIC_BOARD_CONFIG || {};
  const API_URL = config.apiUrl || "";
  const REFRESH_MS = Number(config.refreshMs) || 60000;
  const STALE_AFTER_MS = Number(config.staleAfterMs) || 900000;
  const TIME_ZONE = config.timeZone || "America/New_York";
  const CACHE_KEY = "icic-resource-board:last-snapshot";
  const LANG_KEY = "icic-resource-board:language";
  const MEMBER_COLORS = 8;

  const messages = {
    en: {
      skip: "Skip to content", refresh: "Refresh", loading: "Loading…",
      cpuCores: "CPU cores", memory: "Memory", gpus: "GPUs", storage: "Storage", memoryShort: "Mem",
      free: "{value} free", queuedPlus: "+{value} queued", atLimit: "At limit", nearLimit: "Near limit",
      ofQuota: "of {value} quota", storageFree: "{value} free",
      membersTitle: "Members", member: "Member", jobs: "Jobs",
      membersNote: "Compute is current Slurm allocation; storage is usage on /blue/du.j. Click a member to filter jobs.",
      runShort: "{value} run", pendShort: "{value} pend", noMembers: "No members to show.",
      unattributed: "Unattributed", unattributedNote: "Group total minus counted members",
      exact: "exact", scanned: "scan", partial: "≥ partial scan", unreadable: "folder not readable",
      exactTitle: "Self-reported Lustre quota, {time}", scanTitle: "Daily folder scan, {time}",
      partialTitle: "Daily folder scan could not read some subfolders, so this is a lower bound ({time})",
      unreadableTitle: "The group cannot read this member's folder; their usage is inside Unattributed",
      nextStart: "Next expected start", queuedTitle: "Waiting in queue", gbMemory: "GB mem",
      queuedNote: "Requested by pending jobs, not yet allocated.",
      qosTitle: "QOS limits", groupTres: "Group TRES", maxWall: "Max wall time", jobsPerUser: "Submitted jobs / user",
      qosNote: "Partition policy and cluster availability can add further constraints.",
      storageTitle: "Storage · /blue/du.j", storageSummary: "{used} of {quota} used · {files} files · per-member scan {scan}",
      storageUnavailable: "Storage data is not available in this snapshot yet.", free_: "Free", never: "not yet run",
      optinSummary: "Why are some numbers marked ≥ or estimated? Share your exact usage",
      optinBody: "Lustre only lets each person read their own quota, so the board estimates other members from a daily scan of their folder. Folders the group cannot read are not counted. Run this once on HiPerGator to share your exact usage, which refreshes every 3 hours:",
      optinUninstall: "Stop at any time with --uninstall. Only your total size and file count are shared, never paths.",
      copy: "Copy", copied: "Copied",
      jobsTitle: "Jobs", jobsSummary: "{running} running · {pending} pending · identical requests grouped",
      searchPlaceholder: "Search job, member, ID", all: "All", running: "Running", pending: "Pending",
      job: "Job", status: "Status", scheduled: "Scheduled", request: "Request (each)", timing: "Timing", detail: "Detail",
      noJobs: "No jobs match this view.", clearFilter: "Clear filter: {user}", showIds: "Show {count} IDs", hideIds: "Hide IDs",
      endsIn: "ends in {value}", startsIn: "starts in {value}", started: "started {value}", overdue: "ending now",
      notScheduled: "Not scheduled", notReported: "Not reported", noGpu: "No GPU",
      starting: "Starting", daysHours: "{days}d {hours}h", hoursMinutes: "{hours}h {minutes}m", minutes: "{minutes}m",
      justNow: "Synced just now", syncedAgo: "Synced {time} ago", syncDetail: "{time} · checks every {every} min",
      publicSnapshot: "Live snapshot", cachedSnapshot: "Browser cache", previewData: "Preview data", stale: "Delayed",
      refreshFailedCache: "The live endpoint is unavailable. Showing the last snapshot saved in this browser.",
      refreshFailedDemo: "The live endpoint is unavailable. Showing labeled preview data.",
      staleNotice: "This snapshot is older than expected. Check HiPerGator directly before relying on it.",
      apiMissing: "Set apiUrl in config.js to connect the board to a public snapshot endpoint.",
      invalidData: "The resource endpoint returned an unexpected data format.",
      refreshError: "The cached snapshot is temporarily unavailable.",
      footerNote: "Public, read-only, cached data. No UF credentials are collected. An independent group dashboard, not an official UF service. Allocation is not utilization.",
      clusterTitle: "Cluster right now", clusterNote: "Physically free capacity on HiPerGator for everyone, independent of our QOS.",
      freeOf: "{free} free / {total}", largestNode: "up to {value} on one node", idleCores: "{value} idle cores",
      nodesUp: "{up}/{total} nodes up", cpuOnly: "CPU only", clusterUnavailable: "Cluster data is not in this snapshot yet.",
      plannerTitle: "Can my job start?", plannerNote: "Checks a request against the QOS ceiling, group headroom, and free cluster nodes.",
      gpuType: "GPU type", gpuCount: "GPUs", memGb: "Memory (GB)", hours: "Time (h)",
      vGo: "Likely to start soon", vWait: "Expect a wait", vNo: "Won't start as requested",
      chkCeilingOk: "Within the group ceiling ({ceiling}) and the {wall} wall-time limit",
      chkCeilingBad: "Exceeds the group QOS ceiling: {what}. Reduce the request.",
      chkHeadOk: "Group has room now: {what} free under QOS",
      chkHeadWait: "Group is at its QOS limit ({what}). Enough frees around {time} if running jobs use their full time",
      chkHeadLong: "Group is at its QOS limit ({what}); running jobs alone won't free enough in their time limits",
      chkQueued: "{value} already queued by the group may start first",
      chkClusterOk: "{partition}: a node has {value} free {type} right now",
      chkClusterSplit: "{partition}: {value} {type} free in total, but at most {node} on one node",
      chkClusterBusy: "{partition}: only {value} {type} free cluster-wide; expect to wait for other users",
      chkCpuOk: "{partition}: a node has {value} idle cores", chkCpuBusy: "{partition}: no node has {need} idle cores (max {value})",
      noLimit: "QOS limit", quotaLabel: "Quota", forecastTitle: "Group GPUs, next 24 h, if running jobs use their full time", now: "Now",
      historyTitle: "Last 7 days", historyNote: "From Slurm accounting, including finished jobs. Times in Eastern time.",
      inUseTitle: "{res} in use (hourly average) vs QOS limit", dailyTitle: "{res}-hours per day, by member",
      finished: "Finished jobs", failedRate: "Failed", historyUnavailable: "Usage history is not in this snapshot yet.",
      inUseTip: "{value} {res} in use", hoursTip: "{value} {res}·h", total: "Total",
      storageTrend: "≈ {rate}/day over the last {days} d · full in ~{eta}", storageTrendFull: "≈ {rate}/day over the last {days} d",
      storageTrendFlat: "Flat or shrinking over the last {days} d", storageTrendCollecting: "Growth trend appears after about a day of history.",
      days: "{value} days",
      reasons: {
        Resources: "Waiting for free nodes", Priority: "Other jobs have priority", QOSGrpGRES: "Group GPU limit reached",
        QOSGrpCpuLimit: "Group CPU limit reached", QOSGrpMemLimit: "Group memory limit reached",
        JobArrayTaskLimit: "Array throttle (%) reached", Dependency: "Waiting on dependency",
        BeginTime: "Scheduled for later", ReqNodeNotAvail: "Requested node unavailable",
        QOSMaxJobsPerUserLimit: "Per-user job limit reached", AssocGrpGRES: "Account GPU limit reached"
      }
    },
    zh: {
      skip: "跳到主要内容", refresh: "刷新", loading: "载入中…",
      cpuCores: "CPU 核心", memory: "内存", gpus: "GPU", storage: "存储", memoryShort: "内存",
      free: "剩余 {value}", queuedPlus: "+{value} 排队", atLimit: "已满", nearLimit: "接近上限",
      ofQuota: "配额 {value}", storageFree: "剩余 {value}",
      membersTitle: "成员", member: "成员", jobs: "任务",
      membersNote: "计算资源为当前 Slurm 分配量；存储为 /blue/du.j 上的使用量。点击成员可筛选任务。",
      runShort: "{value} 运行", pendShort: "{value} 排队", noMembers: "暂无成员数据。",
      unattributed: "未归属", unattributedNote: "组总量减去已统计成员",
      exact: "精确", scanned: "扫描", partial: "≥ 部分扫描", unreadable: "目录不可读",
      exactTitle: "成员自报的 Lustre 配额，{time}", scanTitle: "每日目录扫描，{time}",
      partialTitle: "每日扫描无法读取部分子目录，此数为下限（{time}）",
      unreadableTitle: "组成员无法读取该目录，其用量计入「未归属」",
      nextStart: "下一个预计启动", queuedTitle: "排队中的请求", gbMemory: "GB 内存",
      queuedNote: "排队任务请求的资源，尚未分配。",
      qosTitle: "QOS 限额", groupTres: "组 TRES", maxWall: "最长运行时限", jobsPerUser: "每人可提交任务数",
      qosNote: "分区策略与集群可用性可能带来额外限制。",
      storageTitle: "存储 · /blue/du.j", storageSummary: "已用 {used} / {quota} · {files} 个文件 · 成员扫描 {scan}",
      storageUnavailable: "当前快照尚无存储数据。", free_: "剩余", never: "尚未运行",
      optinSummary: "为什么有些数字带 ≥ 或为估算？分享你的精确用量",
      optinBody: "Lustre 只允许每个人查看自己的配额，因此看板通过每日扫描成员目录来估算他人用量，组内无法读取的目录不会被计入。在 HiPerGator 上运行一次以下命令即可分享你的精确用量（每 3 小时自动更新）：",
      optinUninstall: "随时可用 --uninstall 停止。仅分享总大小与文件数，不包含路径。",
      copy: "复制", copied: "已复制",
      jobsTitle: "任务", jobsSummary: "{running} 运行中 · {pending} 排队中 · 相同请求已合并",
      searchPlaceholder: "搜索任务、成员或 ID", all: "全部", running: "运行中", pending: "排队中",
      job: "任务", status: "状态", scheduled: "已预约", request: "单个请求", timing: "时间", detail: "详情",
      noJobs: "当前视图没有匹配的任务。", clearFilter: "清除筛选：{user}", showIds: "显示 {count} 个 ID", hideIds: "隐藏 ID",
      endsIn: "{value}后结束", startsIn: "{value}后开始", started: "已运行 {value}", overdue: "即将结束",
      notScheduled: "尚未排期", notReported: "未报告", noGpu: "无 GPU",
      starting: "即将启动", daysHours: "{days}天{hours}小时", hoursMinutes: "{hours}小时{minutes}分", minutes: "{minutes}分钟",
      justNow: "刚刚同步", syncedAgo: "{time}前同步", syncDetail: "{time} · 每 {every} 分钟检查",
      publicSnapshot: "实时快照", cachedSnapshot: "浏览器缓存", previewData: "预览数据", stale: "数据延迟",
      refreshFailedCache: "实时接口暂时不可用，当前显示此浏览器保存的最近一次快照。",
      refreshFailedDemo: "实时接口暂时不可用，当前显示带有明确标记的预览数据。",
      staleNotice: "该快照比预期更旧，请先在 HiPerGator 上直接确认。",
      apiMissing: "请在 config.js 中设置 apiUrl，以连接公开快照接口。",
      invalidData: "资源接口返回了无法识别的数据格式。", refreshError: "缓存快照暂时不可用。",
      footerNote: "公开、只读的缓存数据，不收集 UF 登录信息。本页面为组内独立看板，并非 UF 官方服务。分配量不等于利用率。",
      clusterTitle: "集群实时空闲", clusterNote: "HiPerGator 上所有用户共享的物理空闲资源，与本组 QOS 无关。",
      freeOf: "空闲 {free} / {total}", largestNode: "单节点最多 {value}", idleCores: "{value} 个空闲核心",
      nodesUp: "{up}/{total} 个节点可用", cpuOnly: "仅 CPU", clusterUnavailable: "当前快照尚无集群数据。",
      plannerTitle: "我的任务能启动吗？", plannerNote: "将请求与 QOS 上限、组内余量和集群空闲节点对比。",
      gpuType: "GPU 类型", gpuCount: "GPU 数", memGb: "内存 (GB)", hours: "时长 (小时)",
      vGo: "很可能很快启动", vWait: "预计需要等待", vNo: "按当前请求无法启动",
      chkCeilingOk: "在组上限（{ceiling}）与 {wall} 运行时限之内",
      chkCeilingBad: "超出组 QOS 上限：{what}。请减少请求。",
      chkHeadOk: "组内当前有余量：QOS 下剩余 {what}",
      chkHeadWait: "组已达 QOS 上限（{what}）。若运行中任务用满时限，约 {time} 释放足够资源",
      chkHeadLong: "组已达 QOS 上限（{what}）；仅靠运行中任务在时限内无法释放足够资源",
      chkQueued: "组内已有 {value} 在排队，可能先于你启动",
      chkClusterOk: "{partition}：当前有节点空闲 {value} 张 {type}",
      chkClusterSplit: "{partition}：共空闲 {value} 张 {type}，但单节点最多 {node} 张",
      chkClusterBusy: "{partition}：全集群仅空闲 {value} 张 {type}，需要等待其他用户释放",
      chkCpuOk: "{partition}：有节点空闲 {value} 个核心", chkCpuBusy: "{partition}：没有节点空闲 {need} 个核心（最多 {value}）",
      noLimit: "QOS 上限", quotaLabel: "配额", forecastTitle: "未来 24 小时组内 GPU 占用（假设运行中任务用满时限）", now: "现在",
      historyTitle: "最近 7 天", historyNote: "来自 Slurm 记账数据，包含已结束任务。时间为美东时间。",
      inUseTitle: "{res} 使用量（小时平均）与 QOS 上限", dailyTitle: "每日 {res}·小时，按成员",
      finished: "已结束任务", failedRate: "失败", historyUnavailable: "当前快照尚无使用历史。",
      inUseTip: "使用 {value} {res}", hoursTip: "{value} {res}·小时", total: "合计",
      storageTrend: "最近 {days} 天约 {rate}/天 · 预计 ~{eta}后用满", storageTrendFull: "最近 {days} 天约 {rate}/天",
      storageTrendFlat: "最近 {days} 天持平或下降", storageTrendCollecting: "积累约一天历史后显示增长趋势。",
      days: "{value} 天",
      reasons: {
        Resources: "等待空闲节点", Priority: "其他任务优先级更高", QOSGrpGRES: "已达组 GPU 上限",
        QOSGrpCpuLimit: "已达组 CPU 上限", QOSGrpMemLimit: "已达组内存上限",
        JobArrayTaskLimit: "已达数组并发上限 (%)", Dependency: "等待依赖任务",
        BeginTime: "预定稍后开始", ReqNodeNotAvail: "指定节点不可用",
        QOSMaxJobsPerUserLimit: "已达个人任务上限", AssocGrpGRES: "已达账户 GPU 上限"
      }
    }
  };

  const readStorage = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

  const state = {
    lang: readStorage(LANG_KEY) === "zh" ? "zh" : "en",
    snapshot: null, source: "live", noticeKey: "",
    filter: "ALL", search: "", member: "", expanded: new Set(),
    sortKey: "default", sortDir: -1, loading: false, metric: "gpu",
    plan: (() => { try { return JSON.parse(readStorage("icic-resource-board:plan") || "null") || {}; } catch { return {}; } })()
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
  const pct = (used, limit) => (Number(limit) > 0 ? Math.min(100, (Number(used) / Number(limit)) * 100) : 0);

  // Storage values are GiB; show TB (TiB, as blue_quota does) once they pass 1024.
  const bytes = (gib) => {
    const value = Number(gib) || 0;
    return value >= 1024 ? `${num(value / 1024, 2)} TB` : `${num(value, value >= 100 ? 0 : 1)} GB`;
  };

  function dateTime(value) {
    if (!value) return t("notScheduled");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t("notScheduled");
    return new Intl.DateTimeFormat(locale(), { timeZone: TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed);
  }

  function duration(ms) {
    const total = Math.max(0, Math.round(ms / 60000));
    const days = Math.floor(total / 1440), hours = Math.floor((total % 1440) / 60), minutes = total % 60;
    if (days) return t("daysHours", { days, hours });
    if (hours) return t("hoursMinutes", { hours, minutes });
    return t("minutes", { minutes });
  }

  // Stable member colors: assigned by sorted username so a person keeps one color across the page.
  let colorIndex = new Map();
  function assignColors(users) {
    colorIndex = new Map([...new Set(users)].sort().map((user, index) => [user, index % MEMBER_COLORS]));
  }
  const colorVar = (user) => (colorIndex.has(user) ? `var(--m${colorIndex.get(user)})` : "var(--muted)");

  function validateSnapshot(value) {
    return Boolean(value && typeof value === "object" && value.summary && value.summary.allocated && value.summary.queued
      && value.summary.limits && Array.isArray(value.jobs) && Array.isArray(value.users) && value.generated_at);
  }

  function isStale(snapshot) {
    return Boolean(snapshot.stale) || Date.now() - new Date(snapshot.generated_at).getTime() > STALE_AFTER_MS;
  }

  /* ---------- KPI cards ---------- */

  function stacked(segments, limit, queued = 0) {
    const parts = segments.filter((s) => s.value > 0).map((s) =>
      `<i style="width:${pct(s.value, limit)}%;background:${s.color}" title="${safe(s.label)}: ${safe(s.text)}"></i>`).join("");
    const used = segments.reduce((sum, s) => sum + s.value, 0);
    const room = Math.max(0, 100 - pct(used, limit));
    const ghost = queued > 0 && room > 0 ? `<i class="ghost" style="width:${Math.min(room, pct(queued, limit))}%"></i>` : "";
    return `<div class="meter" role="img">${parts}${ghost}</div>`;
  }

  function kpi(id, { title, used, limit, unit, segments, queued, foot, format = num }) {
    const share = pct(used, limit);
    const flag = limit > 0 && share >= 99.5 ? `<span class="flag full">${safe(t("atLimit"))}</span>`
      : limit > 0 && share >= 85 ? `<span class="flag near">${safe(t("nearLimit"))}</span>` : "";
    el(id).className = `kpi ${share >= 99.5 ? "is-full" : share >= 85 ? "is-near" : ""}`;
    el(id).innerHTML = `
      <div class="kpi-head"><span>${safe(title)}</span>${flag}</div>
      <div class="kpi-value"><strong>${format(used)}</strong>${limit > 0 ? `<span>/ ${format(limit)}${unit ? ` ${unit}` : ""}</span>` : ""}<em>${limit > 0 ? `${num(share, 0)}%` : ""}</em></div>
      ${stacked(segments, limit, queued)}
      <p>${foot}</p>`;
  }

  function renderKpis() {
    const { allocated, queued, limits } = state.snapshot.summary;
    const users = state.snapshot.users || [];
    const seg = (key, unitText) => users.map((u) => ({ value: Number(u[key]) || 0, color: colorVar(u.user), label: u.user, text: `${num(u[key])}${unitText}` }));
    const foot = (free, queuedValue) => [free, queuedValue > 0 ? `<b class="queued">${safe(t("queuedPlus", { value: num(queuedValue) }))}</b>` : ""].filter(Boolean).join(" · ");

    kpi("kpiCpu", { title: t("cpuCores"), used: allocated.cpu, limit: limits.cpu, segments: seg("cpu", " CPU"), queued: queued.cpu,
      foot: foot(safe(t("free", { value: num(Math.max(0, limits.cpu - allocated.cpu)) })), queued.cpu) });
    kpi("kpiMemory", { title: t("memory"), used: allocated.memory_gb, limit: limits.memory_gb, unit: "GB", segments: seg("memory_gb", " GB"), queued: queued.memory_gb,
      foot: foot(safe(t("free", { value: `${num(Math.max(0, limits.memory_gb - allocated.memory_gb))} GB` })), queued.memory_gb) });
    const types = Object.entries(allocated.gpu_types || {}).map(([name, count]) => `${num(count)}× ${safe(name.replace(/_/g, " "))}`).join(" · ");
    kpi("kpiGpu", { title: t("gpus"), used: allocated.gpu, limit: limits.gpu, segments: seg("gpu", " GPU"), queued: queued.gpu,
      foot: foot(types || safe(t("free", { value: num(Math.max(0, limits.gpu - allocated.gpu)) })), queued.gpu) });

    const storage = state.snapshot.storage;
    if (storage && storage.used_gb != null) {
      const members = storage.members || [];
      const segments = members.map((m) => ({ value: Number(m.used_gb) || 0, color: colorVar(m.user), label: m.user, text: bytes(m.used_gb) }));
      if (storage.unattributed_gb > 0) segments.push({ value: storage.unattributed_gb, color: "var(--unattributed)", label: t("unattributed"), text: bytes(storage.unattributed_gb) });
      kpi("kpiStorage", { title: t("storage"), used: storage.used_gb, limit: storage.quota_gb || 0, segments, format: bytes,
        foot: storage.quota_gb ? safe(t("storageFree", { value: bytes(Math.max(0, storage.quota_gb - storage.used_gb)) })) : "/blue/du.j" });
    } else {
      el("kpiStorage").className = "kpi is-empty";
      el("kpiStorage").innerHTML = `<div class="kpi-head"><span>${safe(t("storage"))}</span></div><div class="kpi-value"><strong>—</strong></div><div class="meter"></div><p>${safe(t("storageUnavailable"))}</p>`;
    }
  }

  function renderLegend(people) {
    el("legend").innerHTML = people.map((user) => `<span><i style="background:${colorVar(user)}"></i>${safe(user)}</span>`).join("")
      + `<span><i class="ghost"></i>${safe(t("pending"))}</span>`;
  }

  /* ---------- Members ---------- */

  function memberRows() {
    const rows = new Map();
    const row = (user) => {
      if (!rows.has(user)) rows.set(user, { user, running: 0, pending: 0, cpu: 0, memory_gb: 0, gpu: 0, gpu_types: {}, storage: null });
      return rows.get(user);
    };
    (state.snapshot.users || []).forEach((u) => Object.assign(row(u.user), {
      running: u.running_jobs || 0, pending: u.pending_jobs || 0, cpu: u.cpu || 0, memory_gb: u.memory_gb || 0, gpu: u.gpu || 0, gpu_types: u.gpu_types || {}
    }));
    (state.snapshot.storage?.members || []).forEach((m) => { row(m.user).storage = m; });
    return [...rows.values()];
  }

  function storageBadge(member) {
    const m = member.storage;
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
    const storageMax = Math.max(1, ...rows.map((r) => Number(r.storage?.used_gb) || 0), Number(storage?.unattributed_gb) || 0);
    const sortValue = (r, key) => key === "user" ? r.user : key === "jobs" ? r.running + r.pending : key === "storage" ? Number(r.storage?.used_gb) || 0 : Number(r[key]) || 0;
    rows.sort((a, b) => {
      if (state.sortKey === "default") return (b.gpu - a.gpu) || (b.cpu - a.cpu) || ((b.storage?.used_gb || 0) - (a.storage?.used_gb || 0)) || a.user.localeCompare(b.user);
      const x = sortValue(a, state.sortKey), y = sortValue(b, state.sortKey);
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.sortDir;
    });
    document.querySelectorAll("[data-sort]").forEach((th) => {
      th.setAttribute("aria-sort", th.dataset.sort === state.sortKey ? (state.sortDir > 0 ? "ascending" : "descending") : "none");
    });

    if (!rows.length) { el("membersBody").innerHTML = `<tr><td colspan="6" class="empty">${safe(t("noMembers"))}</td></tr>`; return; }
    const cell = (value, suffix = "") => (Number(value) > 0 ? `${num(value)}${suffix}` : `<span class="zero">0</span>`);
    const storageCell = (gib, color, badge, prefix = "") => gib == null
      ? `<td class="storage-col"><div class="mini"><span class="zero">—</span>${badge}</div></td>`
      : `<td class="storage-col"><div class="mini"><span class="mini-bar"><i style="width:${pct(gib, storageMax)}%;background:${color}"></i></span><b>${prefix}${bytes(gib)}</b>${badge}</div></td>`;

    let html = rows.map((r) => {
      const types = Object.entries(r.gpu_types).map(([k, v]) => `${v}× ${k.replace(/_/g, " ")}`).join(", ");
      const jobs = r.running || r.pending
        ? `${r.running ? safe(t("runShort", { value: num(r.running) })) : ""}${r.running && r.pending ? " · " : ""}${r.pending ? `<span class="pend">${safe(t("pendShort", { value: num(r.pending) }))}</span>` : ""}`
        : `<span class="zero">—</span>`;
      return `<tr class="member-row ${state.member === r.user ? "selected" : ""}" data-user="${safe(r.user)}" tabindex="0">
        <td><span class="who"><i style="background:${colorVar(r.user)}"></i>${safe(r.user)}</span></td>
        <td class="num">${jobs}</td><td class="num">${cell(r.cpu)}</td><td class="num">${cell(r.memory_gb, " GB")}</td>
        <td class="num" title="${safe(types)}">${cell(r.gpu)}</td>
        ${r.storage ? storageCell(r.storage.used_gb, colorVar(r.user), storageBadge(r), r.storage.source === "scan" && !r.storage.complete ? "≥ " : "") : `<td class="storage-col"><span class="zero">—</span></td>`}
      </tr>`;
    }).join("");
    if (storage && storage.unattributed_gb > 0) {
      html += `<tr class="unattributed-row"><td><span class="who"><i style="background:var(--unattributed)"></i>${safe(t("unattributed"))}</span><small class="row-note">${safe(t("unattributedNote"))}</small></td>
        <td></td><td></td><td></td><td></td>${storageCell(storage.unattributed_gb, "var(--unattributed)", "")}</tr>`;
    }
    el("membersBody").innerHTML = html;
  }

  /* ---------- Storage ---------- */

  function renderStorage() {
    const storage = state.snapshot.storage;
    if (!storage || storage.used_gb == null) {
      el("storageSummary").textContent = t("storageUnavailable");
      el("storageBar").innerHTML = ""; el("storageLegend").innerHTML = "";
      return;
    }
    const total = storage.quota_gb || storage.used_gb;
    el("storageSummary").textContent = t("storageSummary", {
      used: bytes(storage.used_gb), quota: storage.quota_gb ? bytes(storage.quota_gb) : "—",
      files: num(storage.files, 0), scan: storage.scanned_at ? dateTime(storage.scanned_at) : t("never")
    });
    const items = (storage.members || []).filter((m) => Number(m.used_gb) > 0)
      .map((m) => ({ label: m.user, value: m.used_gb, color: colorVar(m.user), prefix: m.source === "scan" && !m.complete ? "≥ " : "" }));
    if (storage.unattributed_gb > 0) items.push({ label: t("unattributed"), value: storage.unattributed_gb, color: "var(--unattributed)", prefix: "" });
    if (storage.quota_gb) items.push({ label: t("free_"), value: Math.max(0, storage.quota_gb - storage.used_gb), color: "transparent", free: true, prefix: "" });
    el("storageBar").innerHTML = items.map((item) => {
      const width = pct(item.value, total);
      return `<i class="${item.free ? "free" : ""}" style="width:${width}%;background:${item.color}" title="${safe(item.label)}: ${item.prefix}${bytes(item.value)}">${width > 9 ? `<span>${safe(item.label)}</span>` : ""}</i>`;
    }).join("");
    el("storageLegend").innerHTML = items.map((item) => `<li><i class="${item.free ? "free" : ""}" style="background:${item.color}"></i><span>${safe(item.label)}</span><b>${item.prefix}${bytes(item.value)}</b><small>${num(pct(item.value, total), 0)}%</small></li>`).join("");
  }

  /* ---------- Jobs ---------- */

  const isScheduled = (job) => String(job.state).toUpperCase() === "PENDING" && job.reason === "BeginTime";

  function groupJobs(jobs) {
    const groups = new Map();
    jobs.forEach((job) => {
      const stateName = isScheduled(job) ? "SCHEDULED" : String(job.state || "").toUpperCase();
      const key = [job.user, job.name, stateName, job.partition, job.cpu, job.memory_gb, job.gpu_label, stateName === "PENDING" ? job.reason : ""].join("|");
      if (!groups.has(key)) groups.set(key, { key, state: stateName, jobs: [], count: 0, first: job });
      const group = groups.get(key);
      group.jobs.push(job);
      group.count += Number(job.task_count) || 1;
    });
    return [...groups.values()];
  }

  function timing(group) {
    const now = Date.now();
    if (group.state === "PENDING" || group.state === "SCHEDULED") {
      const starts = group.jobs.map((j) => j.start_time).filter(Boolean).sort();
      if (!starts.length) return `<span class="zero">${safe(t("notScheduled"))}</span>`;
      const start = new Date(starts[0]).getTime();
      return `<b>${safe(start > now ? t("startsIn", { value: duration(start - now) }) : t("starting"))}</b><small>${safe(dateTime(starts[0]))}</small>`;
    }
    const ends = group.jobs.map((j) => j.end_time).filter(Boolean).sort();
    if (!ends.length) return "—";
    const first = new Date(ends[0]).getTime(), last = ends[ends.length - 1];
    const range = ends.length > 1 && ends[0] !== last ? `${dateTime(ends[0])} – ${dateTime(last)}` : dateTime(ends[0]);
    return `<b>${safe(first > now ? t("endsIn", { value: duration(first - now) }) : t("overdue"))}</b><small>${safe(range)}</small>`;
  }

  function reason(job) {
    const code = String(job.reason || "");
    if (!code || code === "None" || code === "—") return `<span class="zero">—</span>`;
    const lookup = (lang) => (Object.prototype.hasOwnProperty.call(messages[lang].reasons, code) ? messages[lang].reasons[code] : "");
    const label = lookup(state.lang) || lookup("en");
    return label ? `<span title="${safe(code)}">${safe(label)}</span>` : safe(code);
  }

  function renderJobs() {
    const jobs = state.snapshot?.jobs || [];
    const query = state.search.trim().toLowerCase();
    const running = jobs.filter((j) => j.state === "RUNNING").reduce((s, j) => s + (Number(j.task_count) || 1), 0);
    const pending = jobs.filter((j) => j.state === "PENDING" && !isScheduled(j)).reduce((s, j) => s + (Number(j.task_count) || 1), 0);
    el("jobsSummary").innerHTML = safe(t("jobsSummary", { running: num(running), pending: num(pending) }))
      + (state.member ? ` <button type="button" class="chip" id="clearMember">${safe(t("clearFilter", { user: state.member }))} ✕</button>` : "");

    const filtered = jobs.filter((job) => {
      const s = String(job.state).toUpperCase();
      const stateOk = state.filter === "ALL" || s === state.filter || (state.filter === "RUNNING" && s !== "PENDING");
      const memberOk = !state.member || job.user === state.member;
      const searchOk = !query || [job.name, job.user, job.job_id, job.partition].some((v) => String(v || "").toLowerCase().includes(query));
      return stateOk && memberOk && searchOk;
    });
    if (!filtered.length) { el("jobsBody").innerHTML = `<tr><td colspan="6" class="empty">${safe(t("noJobs"))}</td></tr>`; return; }

    el("jobsBody").innerHTML = groupJobs(filtered).map((group) => {
      const job = group.first;
      const label = group.state === "RUNNING" ? t("running") : group.state === "PENDING" ? t("pending") : group.state === "SCHEDULED" ? t("scheduled") : group.state;
      const gpu = job.gpu_label ? safe(job.gpu_label.replace(/_/g, " ")) : `<span class="zero">${safe(t("noGpu"))}</span>`;
      const ids = group.jobs.map((j) => j.job_id);
      const open = state.expanded.has(group.key);
      const idLine = ids.length === 1 ? `#${safe(ids[0])}`
        : `<button type="button" class="link" data-expand="${safe(group.key)}">${safe(open ? t("hideIds") : t("showIds", { count: ids.length }))}</button>`;
      return `<tr>
        <td><div class="job-name"><strong>${safe(job.name || `#${job.job_id}`)}</strong>${group.count > 1 ? `<span class="count">×${num(group.count)}</span>` : ""}</div>
          <small>${idLine} · ${safe(job.partition || "—")}</small>${open ? `<div class="ids">${ids.map((id) => `#${safe(id)}`).join(" ")}</div>` : ""}</td>
        <td><span class="who"><i style="background:${colorVar(job.user)}"></i>${safe(job.user || "—")}</span></td>
        <td><span class="status status-${safe(group.state.toLowerCase())}">${safe(label)}</span></td>
        <td class="request">${num(job.cpu)} CPU · ${num(job.memory_gb)} GB · ${gpu}</td>
        <td class="timing">${timing(group)}</td>
        <td class="reason">${reason(job)}</td>
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
    tip.innerHTML = html;
    tip.hidden = false;
    const { innerWidth } = window;
    const box = tip.getBoundingClientRect();
    const left = Math.min(innerWidth - box.width - 8, event.clientX + 14);
    const top = event.clientY - box.height - 12 < 8 ? event.clientY + 16 : event.clientY - box.height - 12;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${top}px`;
  }
  const hideTip = () => { el("tooltip").hidden = true; };

  // Line (or step) chart over time with an optional dashed limit and a crosshair tooltip.
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
    const area = `${line}${step ? "" : ""}V${y(0)}H${x(points[0].t).toFixed(1)}Z`.replace(/V[\d.]+H[\d.]+Z$/, `L${x(end).toFixed(1)},${y(0)}L${x(points[0].t).toFixed(1)},${y(0)}Z`);
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

  // Stacked bars per day; each member keeps their color. A full-height hit area per day shows the breakdown.
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

  /* ---------- Cluster availability ---------- */

  const typeName = (value) => String(value || "").replace(/_/g, " ");

  function renderCluster() {
    const partitions = state.snapshot.cluster;
    if (!Array.isArray(partitions) || !partitions.length) {
      el("partitions").innerHTML = `<p class="empty">${safe(t("clusterUnavailable"))}</p>`;
      return;
    }
    el("partitions").innerHTML = partitions.map((p) => {
      const gpu = p.gpu_total > 0;
      const free = gpu ? p.gpu_free : p.cpu_idle, total = gpu ? p.gpu_total : p.cpu_total;
      const share = pct(free, total);
      const tone = share < 3 ? "low" : share < 15 ? "mid" : "high";
      return `<div class="partition">
        <div class="partition-head"><strong>${safe(gpu ? typeName(p.gpu_type) : t("cpuOnly"))}</strong><small>${safe(p.partition)}</small></div>
        <div class="partition-value"><b class="${tone}">${num(free, 0)}</b><span>/ ${num(total, 0)} ${gpu ? "GPU" : "CPU"}</span></div>
        <div class="meter free-meter"><i class="${tone}" style="width:${share}%"></i></div>
        <small>${safe(gpu ? t("largestNode", { value: num(p.max_gpu_free_node, 0) }) : t("largestNode", { value: `${num(p.max_cpu_free_node, 0)} CPU` }))} · ${safe(t("nodesUp", { up: p.nodes_up, total: p.nodes }))}</small>
      </div>`;
    }).join("");
  }

  /* ---------- Planner ---------- */

  const PLAN_KEY = "icic-resource-board:plan";
  function wallHours(text) {
    const match = /^(?:(\d+)-)?(\d+):(\d+):(\d+)$/.exec(String(text || ""));
    return match ? Number(match[1] || 0) * 24 + Number(match[2]) + Number(match[3]) / 60 : Infinity;
  }

  function renderPlannerOptions() {
    const partitions = (state.snapshot.cluster || []);
    const select = el("planType");
    const options = partitions.length ? partitions : [{ partition: "hpg-b200", gpu_type: "B200", gpu_total: 1 }, { partition: "hpg-default", gpu_total: 0 }];
    const current = select.value || state.plan.partition;
    select.innerHTML = options.map((p) => `<option value="${safe(p.partition)}">${safe(p.gpu_total > 0 ? `${typeName(p.gpu_type)} · ${p.partition}` : `${t("cpuOnly")} · ${p.partition}`)}</option>`).join("");
    if (options.some((p) => p.partition === current)) select.value = current;
  }

  function renderPlanner() {
    const snapshot = state.snapshot;
    const { allocated, queued, limits } = snapshot.summary;
    const partition = (snapshot.cluster || []).find((p) => p.partition === el("planType").value);
    const cpuOnly = partition ? !(partition.gpu_total > 0) : el("planType").value === "hpg-default";
    el("planGpu").disabled = cpuOnly;
    const request = {
      gpu: cpuOnly ? 0 : Math.max(0, Number(el("planGpu").value) || 0),
      cpu: Math.max(1, Number(el("planCpu").value) || 1),
      mem: Math.max(1, Number(el("planMem").value) || 1),
      hours: Math.max(1, Number(el("planHours").value) || 1)
    };
    state.plan = { partition: el("planType").value, ...request };
    writeStorage(PLAN_KEY, JSON.stringify(state.plan));

    const checks = [];
    const over = [];
    if (request.gpu > limits.gpu) over.push(`${request.gpu} GPU > ${limits.gpu}`);
    if (request.cpu > limits.cpu) over.push(`${request.cpu} CPU > ${limits.cpu}`);
    if (request.mem > limits.memory_gb) over.push(`${request.mem} GB > ${num(limits.memory_gb)} GB`);
    if (request.hours > wallHours(limits.max_wall)) over.push(`${request.hours} h > ${limits.max_wall}`);
    if (over.length) {
      checks.push(["bad", t("chkCeilingBad", { what: over.join(", ") })]);
    } else {
      checks.push(["ok", t("chkCeilingOk", { ceiling: `${num(limits.cpu)} CPU · ${num(limits.memory_gb)} GB · ${num(limits.gpu)} GPU`, wall: limits.max_wall || "—" })]);
      const deficit = { gpu: allocated.gpu + request.gpu - limits.gpu, cpu: allocated.cpu + request.cpu - limits.cpu, mem: allocated.memory_gb + request.mem - limits.memory_gb };
      const short = [deficit.gpu > 0 && `GPU ${num(allocated.gpu)}/${num(limits.gpu)}`, deficit.cpu > 0 && `CPU ${num(allocated.cpu)}/${num(limits.cpu)}`,
        deficit.mem > 0 && `${num(allocated.memory_gb)}/${num(limits.memory_gb)} GB`].filter(Boolean);
      if (!short.length) {
        checks.push(["ok", t("chkHeadOk", { what: `${num(limits.gpu - allocated.gpu)} GPU · ${num(limits.cpu - allocated.cpu)} CPU · ${num(limits.memory_gb - allocated.memory_gb)} GB` })]);
      } else {
        // Walk running jobs by expected end until the freed resources cover the shortfall.
        const freed = { gpu: 0, cpu: 0, mem: 0 };
        const running = snapshot.jobs.filter((j) => j.state !== "PENDING" && j.end_time).sort((a, b) => a.end_time.localeCompare(b.end_time));
        const when = running.find((j) => {
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
          if (partition.max_gpu_free_node >= request.gpu) checks.push(["ok", t("chkClusterOk", { partition: name, value: num(partition.max_gpu_free_node, 0), type })]);
          else if (partition.gpu_free >= request.gpu) checks.push(["warn", t("chkClusterSplit", { partition: name, value: num(partition.gpu_free, 0), node: num(partition.max_gpu_free_node, 0), type })]);
          else checks.push(["warn", t("chkClusterBusy", { partition: name, value: num(partition.gpu_free, 0), type })]);
        } else if (partition.max_cpu_free_node >= request.cpu) {
          checks.push(["ok", t("chkCpuOk", { partition: name, value: num(partition.max_cpu_free_node, 0) })]);
        } else {
          checks.push(["warn", t("chkCpuBusy", { partition: name, need: request.cpu, value: num(partition.max_cpu_free_node, 0) })]);
        }
      }
    }
    const verdict = checks.some(([level]) => level === "bad") ? "no" : checks.some(([level]) => level === "warn") ? "wait" : "go";
    el("planVerdict").className = `verdict ${verdict}`;
    el("planVerdict").innerHTML = `<i aria-hidden="true">${verdict === "go" ? "✓" : verdict === "wait" ? "◷" : "✕"}</i>${safe(t(verdict === "go" ? "vGo" : verdict === "wait" ? "vWait" : "vNo"))}`;
    const icons = { ok: "✓", warn: "!", bad: "✕", info: "i" };
    el("planChecks").innerHTML = checks.map(([level, text]) => `<li class="${level}"><i aria-hidden="true">${icons[level]}</i><span>${safe(text)}</span></li>`).join("");
  }

  function renderForecast() {
    const snapshot = state.snapshot;
    const now = Date.now(), horizon = now + 24 * 3600000;
    let value = Number(snapshot.summary.allocated.gpu) || 0;
    const points = [{ t: now, v: value }];
    snapshot.jobs.filter((j) => j.state !== "PENDING" && Number(j.gpus) > 0 && j.end_time)
      .map((j) => ({ t: Math.max(now, new Date(j.end_time).getTime()), gpus: Number(j.gpus) * (Number(j.task_count) || 1) }))
      .filter((e) => e.t <= horizon).sort((a, b) => a.t - b.t)
      .forEach((e) => { value = Math.max(0, value - e.gpus); points.push({ t: e.t, v: value }); });
    const ticks = [[now, t("now")]];
    for (let h = 6; h <= 24; h += 6) ticks.push([now + h * 3600000, hourLabel(now + h * 3600000)]);
    ticks[ticks.length - 1][0] -= 1;
    timeChart(el("forecastChart"), { points, t0: now, t1: horizon, limit: Number(snapshot.summary.limits.gpu) || 0, step: true, color: "var(--m0)", height: 130, ticks,
      tip: (p, time) => `<strong>${safe(tipTime(time))}</strong><span class="tip-row">${safe(t("inUseTip", { value: num(p.v), res: "GPU" }))}</span>` });
  }

  /* ---------- 7-day history ---------- */

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
    const limit = Number(metric === "gpu" ? state.snapshot.summary.limits.gpu : state.snapshot.summary.limits.cpu) || 0;
    timeChart(el("inUseChart"), { points, t0: start, t1, limit, color: "var(--m0)", ticks,
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

    const maxHours = Math.max(1, ...usage.members.map((m) => Number(m[key]) || 0));
    el("usageBody").innerHTML = usage.members.length ? usage.members.map((m) => {
      const failRate = m.finished ? (m.failed / m.finished) * 100 : 0;
      const bar = (value, active) => `<div class="mini ${active ? "" : "dim"}"><span class="mini-bar"><i style="width:${pct(value, active ? maxHours : Math.max(1, ...usage.members.map((x) => Number(x[metric === "gpu" ? "cpu_hours" : "gpu_hours"]) || 0)))}%;background:${colorVar(m.user)}"></i></span><b>${num(value, 0)}</b></div>`;
      return `<tr>
        <td><span class="who"><i style="background:${colorVar(m.user)}"></i>${safe(m.user)}</span></td>
        <td class="num">${bar(m.gpu_hours, metric === "gpu")}</td>
        <td class="num">${bar(m.cpu_hours, metric === "cpu")}</td>
        <td class="num">${num(m.finished, 0)}</td>
        <td class="num ${failRate >= 10 ? "fail-high" : ""}" title="${num(m.failed, 0)} / ${num(m.finished, 0)}">${m.finished ? `${num(failRate, 1)}%` : "—"}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="5" class="empty">—</td></tr>`;
  }

  /* ---------- Storage trend ---------- */

  function renderStorageTrend() {
    const storage = state.snapshot.storage;
    const history = (storage?.history || []).map((p) => ({ t: new Date(p.t).getTime(), v: Number(p.used_gb) || 0 })).filter((p) => p.t > 0);
    if (!storage || history.length < 2 || history[history.length - 1].t - history[0].t < 18 * 3600000) {
      el("storageTrend").textContent = storage ? t("storageTrendCollecting") : "";
      el("storageHistory").innerHTML = "";
      return;
    }
    const last = history[history.length - 1];
    const recent = history.filter((p) => last.t - p.t <= 7 * 86400000);
    const first = recent[0];
    const spanDays = (last.t - first.t) / 86400000;
    if (recent.length < 2 || spanDays < 0.75) {
      el("storageTrend").textContent = t("storageTrendCollecting");
      el("storageHistory").innerHTML = "";
      return;
    }
    const rate = (last.v - first.v) / spanDays;
    const days = Math.max(1, Math.round(spanDays));
    if (rate <= 0.5) el("storageTrend").textContent = t("storageTrendFlat", { days });
    else if (storage.quota_gb) el("storageTrend").textContent = t("storageTrend", { rate: bytes(rate), days, eta: t("days", { value: num(Math.max(0, (storage.quota_gb - storage.used_gb) / rate), 0) }) });
    else el("storageTrend").textContent = t("storageTrendFull", { rate: bytes(rate), days });
    const ticks = [[history[0].t, dayLabel(history[0].t)], [last.t - 1, dayLabel(last.t)]];
    timeChart(el("storageHistory"), { points: history, t0: history[0].t, t1: last.t, limit: storage.quota_gb || 0, color: "var(--m2)", height: 120, ticks,
      max: (storage.quota_gb || Math.max(...history.map((p) => p.v))) * 1.08, format: bytes, limitLabel: t("quotaLabel"),
      tip: (p) => `<strong>${safe(tipTime(p.t))}</strong><span class="tip-row">${safe(bytes(p.v))}</span>` });
  }

  /* ---------- URL state ---------- */

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("lang") === "zh" || params.get("lang") === "en") state.lang = params.get("lang");
    if (params.get("member")) state.member = params.get("member");
    if (["RUNNING", "PENDING"].includes((params.get("filter") || "").toUpperCase())) state.filter = params.get("filter").toUpperCase();
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

  /* ---------- Side panels ---------- */

  function renderCountdown() {
    const next = state.snapshot?.next_start;
    if (!next?.start_time) return;
    const remaining = new Date(next.start_time).getTime() - Date.now();
    el("countdown").textContent = remaining > 0 ? duration(remaining) : t("starting");
  }

  function renderSync() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const age = Date.now() - new Date(snapshot.generated_at).getTime();
    const stale = isStale(snapshot);
    el("sync").className = `sync ${stale || state.source !== "live" ? "is-stale" : ""}`;
    el("syncAge").textContent = age < 60000 ? t("justNow") : t("syncedAgo", { time: duration(age) });
    el("syncDetail").textContent = t("syncDetail", { time: dateTime(snapshot.generated_at), every: Math.round(REFRESH_MS / 60000) });
  }

  function render() {
    const snapshot = state.snapshot;
    if (!snapshot) { el("notice").hidden = !state.noticeKey; el("notice").textContent = state.noticeKey ? t(state.noticeKey) : ""; return; }
    const people = [...(snapshot.users || []).map((u) => u.user), ...(snapshot.storage?.members || []).map((m) => m.user),
      ...(snapshot.usage?.members || []).map((m) => m.user), ...(snapshot.usage?.daily || []).flatMap((d) => Object.keys(d.members || {}))];
    assignColors(people);
    const { queued, limits } = snapshot.summary;
    const stale = isStale(snapshot);

    renderSync();
    const noticeKey = state.noticeKey || (stale ? "staleNotice" : "");
    el("notice").hidden = !noticeKey;
    el("notice").textContent = noticeKey ? t(noticeKey) : "";
    el("sourceBadge").textContent = state.source === "demo" ? t("previewData") : state.source === "cache" ? t("cachedSnapshot") : stale ? t("stale") : t("publicSnapshot");
    el("sourceBadge").className = `badge ${stale || state.source !== "live" ? "warn" : ""}`;

    renderKpis();
    const active = (snapshot.users || []).filter((u) => u.cpu || u.gpu || u.memory_gb).map((u) => u.user)
      .concat((snapshot.storage?.members || []).filter((m) => Number(m.used_gb) > 0).map((m) => m.user));
    renderLegend([...new Set(active)].sort());
    renderMembers();
    renderStorage();
    renderStorageTrend();
    renderJobs();
    renderCluster();
    renderPlannerOptions();
    renderPlanner();
    renderForecast();
    renderHistory();
    writeUrl();

    el("queuedCpu").textContent = num(queued.cpu); el("queuedMemory").textContent = num(queued.memory_gb); el("queuedGpu").textContent = num(queued.gpu);
    el("groupTres").textContent = `${num(limits.cpu)} CPU · ${num(limits.memory_gb)} GB · ${num(limits.gpu)} GPU`;
    el("maxWall").textContent = limits.max_wall || t("notReported");
    el("jobsPerUser").textContent = limits.max_submitted_jobs_per_user ? num(limits.max_submitted_jobs_per_user) : t("notReported");

    const next = snapshot.next_start;
    el("nextCard").hidden = !next;
    if (next) {
      el("nextName").textContent = next.name || `#${next.job_id}`;
      el("nextMeta").textContent = `#${next.job_id}${next.gpu ? ` · ${next.gpu.replace(/_/g, " ")}` : ""}`;
      el("nextStart").textContent = dateTime(next.start_time); el("nextEnd").textContent = dateTime(next.end_time);
      renderCountdown();
    }
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

  /* ---------- Data loading ---------- */

  async function loadSnapshot() {
    if (state.loading) return;
    state.loading = true;
    el("refreshButton").classList.add("loading");
    try {
      if (!API_URL) throw new Error("api-missing");
      const response = await fetch(`${API_URL}${API_URL.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store", headers: { Accept: "application/vnd.github.raw+json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      if (!validateSnapshot(snapshot)) throw new Error("invalid-data");
      state.snapshot = snapshot; state.source = "live"; state.noticeKey = "";
      writeStorage(CACHE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      let cached = null;
      try { cached = JSON.parse(readStorage(CACHE_KEY) || "null"); } catch { cached = null; }
      if (validateSnapshot(cached)) {
        state.snapshot = cached; state.source = "cache"; state.noticeKey = "refreshFailedCache";
      } else {
        try {
          const response = await fetch("./demo-status.json", { cache: "no-store" });
          const demo = await response.json();
          if (!validateSnapshot(demo)) throw new Error("invalid-demo");
          state.snapshot = demo; state.source = "demo"; state.noticeKey = API_URL ? "refreshFailedDemo" : "apiMissing";
        } catch {
          state.noticeKey = error?.message === "invalid-data" ? "invalidData" : "refreshError";
        }
      }
    } finally {
      state.loading = false;
      el("refreshButton").classList.remove("loading");
      render();
    }
  }

  /* ---------- Events ---------- */

  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => {
    state.lang = button.dataset.lang === "zh" ? "zh" : "en";
    writeStorage(LANG_KEY, state.lang);
    applyTranslations(); writeUrl();
  }));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderJobs(); writeUrl();
  }));
  document.querySelectorAll("[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (state.sortKey === key) state.sortDir *= -1;
    else { state.sortKey = key; state.sortDir = key === "user" ? 1 : -1; }
    renderMembers();
  }));
  const selectMember = (row) => {
    if (!row) return;
    state.member = state.member === row.dataset.user ? "" : row.dataset.user;
    renderMembers(); renderJobs(); writeUrl();
    if (state.member) document.querySelector(".jobs-card").scrollIntoView({ behavior: "smooth", block: "start" });
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
    resizeTimer = window.setTimeout(() => { if (state.snapshot) { renderForecast(); renderHistory(); renderStorageTrend(); } }, 150);
  });

  readUrl();
  if (state.plan.partition) {
    el("planGpu").value = state.plan.gpu ?? 1; el("planCpu").value = state.plan.cpu ?? 8;
    el("planMem").value = state.plan.mem ?? 64; el("planHours").value = state.plan.hours ?? 24;
  }
  el("jobSearch").value = state.search;
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item.dataset.filter === state.filter));
  applyTranslations();
  loadSnapshot();
  window.setInterval(loadSnapshot, REFRESH_MS);
  window.setInterval(() => { if (state.snapshot) { renderCountdown(); renderSync(); } }, 30000);
})();
