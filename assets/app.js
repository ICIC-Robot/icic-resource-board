(() => {
  "use strict";

  const config = window.ICIC_BOARD_CONFIG || {};
  const API_URL = config.apiUrl || "";
  const REFRESH_MS = Number(config.refreshMs) || 60000;
  const STALE_AFTER_MS = Number(config.staleAfterMs) || 900000;
  const TIME_ZONE = config.timeZone || "America/New_York";
  const CACHE_KEY = "icic-resource-board:last-snapshot";
  const LANG_KEY = "icic-resource-board:language";

  const messages = {
    en: {
      skip: "Skip to content", publicReadOnly: "Public · read only", refresh: "Refresh",
      eyebrow: "SHARED COMPUTE, CLEARLY SEEN", heroLine1: "See the workload.", heroLine2: "Plan the next move.",
      heroDescription: "A live, cached view of ICIC group allocations, queued requests, and shared QOS headroom on UF HiPerGator.",
      lastSync: "Last synchronized", overviewEyebrow: "CURRENT ALLOCATION", overviewTitle: "Resource overview",
      cpuCores: "CPU cores", memory: "Memory", gpus: "GPUs", activeWork: "Active work", running: "Running",
      pending: "Pending", pendingLower: "pending", arrayNote: "Array elements are counted as individual jobs.",
      nextReserved: "NEXT EXPECTED START", startsIn: "Starts in", estimatedStart: "Estimated start", expectedEnd: "Expected end",
      queuedEyebrow: "QUEUED REQUESTS", queuedTitle: "Demand waiting in line", gbMemory: "GB memory",
      queuedNote: "Pending totals describe requested capacity, not resources currently consumed.",
      qosEyebrow: "QOS ENVELOPE", qosTitle: "Shared request ceiling", groupTres: "Group TRES",
      maxWall: "Maximum wall time", jobsPerUser: "Submitted jobs / user",
      qosNote: "Limits reflect the reported Slurm QOS. Partition and cluster availability may add constraints.",
      queueEyebrow: "LIVE QUEUE", groupJobs: "Group jobs", searchPlaceholder: "Search job or owner", all: "All",
      job: "Job", owner: "Owner", status: "Status", request: "Request", start: "Start", detail: "Detail",
      loading: "Loading resource data…", membersEyebrow: "BY MEMBER", allocationOwners: "Current allocation owners",
      allocationNote: "Slurm allocation, not device utilization",
      footerNote: "Public cached data. No UF credentials are collected. This is an independent group dashboard, not an official UF service.",
      publicSnapshot: "Public snapshot", cachedSnapshot: "Browser cache", previewData: "Preview data", current: "Current",
      delayed: "Delayed", updatedAgo: "Updated {time} ago · checks every 2 minutes", justNow: "just now",
      coresAvailable: "{value} cores available under QOS", memoryAvailable: "{value} GB available under QOS",
      noGpu: "No GPUs allocated", noGpuAllocation: "No GPU allocation", noGpuRequest: "No GPU",
      tasks: "{count} tasks × ", noJobs: "No jobs match this view.", noMembers: "No current allocation owners.",
      runningLower: "running", notScheduled: "Not scheduled", notReported: "Not reported", jobPrefix: "JOB {id}",
      starting: "Starting", calculating: "Calculating", daysHours: "{days}d {hours}h", hoursMinutes: "{hours}h {minutes}m",
      refreshFailedCache: "The live endpoint is unavailable. Showing the last snapshot saved in this browser.",
      refreshFailedDemo: "The live endpoint is unavailable. Showing labeled preview data.",
      apiMissing: "Set apiUrl in config.js to connect the board to a public snapshot endpoint.",
      invalidData: "The resource endpoint returned an unexpected data format.",
      refreshError: "The cached snapshot is temporarily unavailable."
    },
    zh: {
      skip: "跳到主要内容", publicReadOnly: "公开 · 只读", refresh: "刷新",
      eyebrow: "共享算力，一目了然", heroLine1: "看清当前负载，", heroLine2: "规划下一步任务。",
      heroDescription: "实时查看 ICIC 组在 UF HiPerGator 上的资源分配、排队请求和共享 QOS 余量。数据经过缓存并公开展示。",
      lastSync: "最近同步", overviewEyebrow: "当前分配", overviewTitle: "资源概览",
      cpuCores: "CPU 核心", memory: "内存", gpus: "GPU", activeWork: "活跃任务", running: "运行中",
      pending: "排队中", pendingLower: "个排队中", arrayNote: "作业数组中的每个元素按一个独立任务计数。",
      nextReserved: "下一个预计启动任务", startsIn: "距离启动", estimatedStart: "预计开始", expectedEnd: "预计结束",
      queuedEyebrow: "排队请求", queuedTitle: "正在等待的资源需求", gbMemory: "GB 内存",
      queuedNote: "排队总量代表待调度请求，并非当前已经占用的资源。",
      qosEyebrow: "QOS 配额", qosTitle: "组内共享请求上限", groupTres: "组 TRES",
      maxWall: "最长运行时限", jobsPerUser: "每位用户可提交任务数",
      qosNote: "此处显示 Slurm 报告的 QOS 限额；分区策略与集群可用性可能带来额外限制。",
      queueEyebrow: "实时队列", groupJobs: "组内任务", searchPlaceholder: "搜索任务或用户", all: "全部",
      job: "任务", owner: "用户", status: "状态", request: "请求资源", start: "开始时间", detail: "状态详情",
      loading: "正在载入资源数据…", membersEyebrow: "按成员统计", allocationOwners: "当前资源分配用户",
      allocationNote: "显示 Slurm 分配量，并非设备实际利用率",
      footerNote: "公开缓存数据，不收集 UF 登录信息。本页面为组内独立看板，并非 UF 官方服务。",
      publicSnapshot: "公开快照", cachedSnapshot: "浏览器缓存", previewData: "预览数据", current: "数据正常",
      delayed: "数据延迟", updatedAgo: "更新于 {time}前 · 每 2 分钟检查一次", justNow: "刚刚",
      coresAvailable: "QOS 下尚可申请 {value} 个核心", memoryAvailable: "QOS 下尚可申请 {value} GB",
      noGpu: "当前未分配 GPU", noGpuAllocation: "未分配 GPU", noGpuRequest: "未请求 GPU",
      tasks: "{count} 个任务 × ", noJobs: "当前视图没有匹配的任务。", noMembers: "当前没有资源分配用户。",
      runningLower: "个运行中", notScheduled: "尚未排期", notReported: "未报告", jobPrefix: "任务 {id}",
      starting: "即将启动", calculating: "计算中", daysHours: "{days}天 {hours}小时", hoursMinutes: "{hours}小时 {minutes}分",
      refreshFailedCache: "实时接口暂时不可用，当前显示此浏览器保存的最近一次快照。",
      refreshFailedDemo: "实时接口暂时不可用，当前显示带有明确标记的预览数据。",
      apiMissing: "请在 config.js 中设置 apiUrl，以连接公开快照接口。",
      invalidData: "资源接口返回了无法识别的数据格式。", refreshError: "缓存快照暂时不可用。"
    }
  };

  const state = {
    lang: localStorage.getItem(LANG_KEY) === "zh" ? "zh" : "en",
    snapshot: null,
    source: "live",
    filter: "ALL",
    search: "",
    loading: false,
    noticeKey: ""
  };

  const el = (id) => document.getElementById(id);
  const t = (key, values = {}) => {
    let value = messages[state.lang][key] ?? messages.en[key] ?? key;
    Object.entries(values).forEach(([name, replacement]) => {
      value = value.replace(`{${name}}`, String(replacement));
    });
    return value;
  };
  const number = (value) => new Intl.NumberFormat(state.lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 }).format(Number(value) || 0);
  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const interpolate = (key, values) => safe(t(key, values));

  function dateTime(value) {
    if (!value) return t("notScheduled");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t("notScheduled");
    return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", {
      timeZone: TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }).format(parsed);
  }

  function relativeAge(value) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return t("justNow");
    if (seconds < 3600) return state.lang === "zh" ? `${Math.floor(seconds / 60)} 分钟` : `${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return state.lang === "zh" ? `${Math.floor(seconds / 3600)} 小时` : `${Math.floor(seconds / 3600)} hr`;
    return state.lang === "zh" ? `${Math.floor(seconds / 86400)} 天` : `${Math.floor(seconds / 86400)} d`;
  }

  function gpuMix(values) {
    const entries = Object.entries(values || {});
    return entries.length ? entries.map(([name, count]) => `${number(count)}× ${safe(name)}`).join(" · ") : t("noGpu");
  }

  function validateSnapshot(value) {
    return Boolean(value && typeof value === "object" && value.summary && value.summary.allocated && value.summary.queued && value.summary.limits && Array.isArray(value.jobs) && Array.isArray(value.users) && value.generated_at);
  }

  function applyTranslations() {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-lang]").forEach((button) => {
      const active = button.dataset.lang === state.lang;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (state.snapshot) render();
  }

  function setMeter(id, used, limit) {
    const width = Number(limit) > 0 ? Math.min(100, (Number(used) / Number(limit)) * 100) : 0;
    const meter = el(id);
    meter.style.width = `${width}%`;
    meter.parentElement.setAttribute("aria-valuenow", String(Number(used) || 0));
    meter.parentElement.setAttribute("aria-valuemax", String(Number(limit) || 0));
  }

  function renderJobs() {
    const jobs = state.snapshot?.jobs || [];
    const query = state.search.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      const matchesState = state.filter === "ALL" || String(job.state).toUpperCase() === state.filter;
      const matchesSearch = !query || [job.name, job.user, job.job_id, job.partition].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesState && matchesSearch;
    });

    if (!filtered.length) {
      el("jobsBody").innerHTML = `<tr><td colspan="7" class="empty-cell">${safe(t("noJobs"))}</td></tr>`;
      return;
    }

    el("jobsBody").innerHTML = filtered.map((job) => {
      const stateName = String(job.state || "").toUpperCase();
      const displayState = stateName === "RUNNING" ? t("running") : stateName === "PENDING" ? t("pending") : stateName;
      const taskPrefix = Number(job.task_count) > 1 ? interpolate("tasks", { count: number(job.task_count) }) : "";
      const request = `${taskPrefix}${number(job.cpu)} CPU · ${number(job.memory_gb)} GB · ${safe(job.gpu_label || t("noGpuRequest"))}`;
      return `<tr>
        <td><strong>${safe(job.name || `#${job.job_id}`)}</strong><small>#${safe(job.job_id)} · ${safe(job.partition || "—")}</small></td>
        <td>${safe(job.user || "—")}</td>
        <td><span class="status status-${safe(stateName.toLowerCase())}"><i></i>${safe(displayState)}</span></td>
        <td>${request}</td><td>${safe(dateTime(job.start_time))}</td><td>${safe(dateTime(job.end_time))}</td>
        <td class="reason" title="${safe(job.reason || "")}">${safe(job.reason || "—")}</td>
      </tr>`;
    }).join("");
  }

  function renderMembers() {
    const users = state.snapshot?.users || [];
    if (!users.length) {
      el("membersGrid").innerHTML = `<p class="empty-panel">${safe(t("noMembers"))}</p>`;
      return;
    }
    el("membersGrid").innerHTML = users.map((member) => `<article class="member-card">
      <div class="member-avatar">${safe(String(member.user || "?").slice(0, 2).toUpperCase())}</div>
      <div class="member-name"><strong>${safe(member.user || "—")}</strong><span>${number(member.running_jobs)} ${safe(t("runningLower"))} · ${number(member.pending_jobs)} ${safe(t("pendingLower"))}</span></div>
      <div class="member-resources"><span><b>${number(member.cpu)}</b>CPU</span><span><b>${number(member.memory_gb)}</b>GB</span><span><b>${number(member.gpu)}</b>GPU</span></div>
      <p>${gpuMix(member.gpu_types).replace(t("noGpu"), t("noGpuAllocation"))}</p>
    </article>`).join("");
  }

  function renderCountdown() {
    const start = state.snapshot?.next_start?.start_time;
    if (!start) return;
    const remaining = Math.max(0, new Date(start).getTime() - Date.now());
    if (!remaining) { el("countdown").textContent = t("starting"); return; }
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    el("countdown").textContent = days ? t("daysHours", { days, hours }) : t("hoursMinutes", { hours, minutes: String(minutes).padStart(2, "0") });
  }

  function render() {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    const { allocated, queued, limits, gpu_types: gpuTypes } = snapshot.summary;
    const stale = Boolean(snapshot.stale) || Date.now() - new Date(snapshot.generated_at).getTime() > STALE_AFTER_MS;

    el("lastSync").textContent = dateTime(snapshot.generated_at);
    el("syncDetail").textContent = t("updatedAgo", { time: relativeAge(snapshot.generated_at) });
    el("sourceBadge").textContent = state.source === "demo" ? t("previewData") : state.source === "cache" ? t("cachedSnapshot") : t("publicSnapshot");
    el("sourceBadge").className = `source-badge ${stale ? "stale" : ""}`;

    el("cpuUsed").textContent = number(allocated.cpu); el("cpuLimit").textContent = number(limits.cpu);
    el("memoryUsed").textContent = number(allocated.memory_gb); el("memoryLimit").textContent = number(limits.memory_gb);
    el("gpuUsed").textContent = number(allocated.gpu); el("gpuLimit").textContent = number(limits.gpu);
    setMeter("cpuMeter", allocated.cpu, limits.cpu); setMeter("memoryMeter", allocated.memory_gb, limits.memory_gb); setMeter("gpuMeter", allocated.gpu, limits.gpu);
    el("cpuDetail").textContent = t("coresAvailable", { value: number(Math.max(0, Number(limits.cpu) - Number(allocated.cpu))) });
    el("memoryDetail").textContent = t("memoryAvailable", { value: number(Math.max(0, Number(limits.memory_gb) - Number(allocated.memory_gb))) });
    el("gpuDetail").innerHTML = gpuMix(gpuTypes || allocated.gpu_types);
    el("runningCount").textContent = number(snapshot.summary.running_jobs); el("pendingCount").textContent = number(snapshot.summary.pending_jobs);

    el("queuedCpu").textContent = number(queued.cpu); el("queuedMemory").textContent = number(queued.memory_gb); el("queuedGpu").textContent = number(queued.gpu);
    el("groupTres").textContent = `${number(limits.cpu)} CPU · ${number(limits.memory_gb)} GB · ${number(limits.gpu)} GPU`;
    el("maxWall").textContent = limits.max_wall || t("notReported");
    el("jobsPerUser").textContent = limits.max_submitted_jobs_per_user ? number(limits.max_submitted_jobs_per_user) : t("notReported");

    const next = snapshot.next_start;
    el("nextStartSection").hidden = !next;
    if (next) {
      el("nextJobId").textContent = t("jobPrefix", { id: next.job_id }); el("nextJobName").textContent = next.name || `#${next.job_id}`;
      el("nextJobRequest").textContent = next.gpu || t("noGpuRequest"); el("nextStartTime").textContent = dateTime(next.start_time); el("nextEndTime").textContent = dateTime(next.end_time);
      renderCountdown();
    }

    el("notice").hidden = !state.noticeKey;
    el("notice").textContent = state.noticeKey ? t(state.noticeKey) : "";
    renderJobs(); renderMembers();
  }

  async function loadSnapshot() {
    if (state.loading) return;
    state.loading = true;
    el("refreshButton").classList.add("loading");
    try {
      if (!API_URL) throw new Error("api-missing");
      const response = await fetch(`${API_URL}${API_URL.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github.raw+json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      if (!validateSnapshot(snapshot)) throw new Error("invalid-data");
      state.snapshot = snapshot; state.source = "live"; state.noticeKey = "";
      localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { cached = null; }
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

  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => {
    state.lang = button.dataset.lang === "zh" ? "zh" : "en";
    localStorage.setItem(LANG_KEY, state.lang);
    applyTranslations();
  }));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderJobs();
  }));
  el("jobSearch").addEventListener("input", (event) => { state.search = event.target.value; renderJobs(); });
  el("refreshButton").addEventListener("click", loadSnapshot);

  applyTranslations();
  loadSnapshot();
  window.setInterval(loadSnapshot, REFRESH_MS);
  window.setInterval(() => { if (state.snapshot) { renderCountdown(); el("syncDetail").textContent = t("updatedAgo", { time: relativeAge(state.snapshot.generated_at) }); } }, 30000);
})();
