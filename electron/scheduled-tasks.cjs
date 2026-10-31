const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const TASK_LIMIT = 100;
const RUN_LIMIT = 200;
const FREQUENCIES = new Set(['once', 'daily', 'weekdays', 'weekly', 'monthly']);
const TASK_ATTACHMENT_LIMIT = 10;
const TASK_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const TASK_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
const TASK_IMAGE_LIMIT = 4;
const TASK_IMAGE_BYTES = 1_900_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalizeTaskAttachments(value, strict = false) {
  if (value == null) return [];
  const fail = (message) => {
    if (strict) throw new Error(message);
    return [];
  };
  if (!Array.isArray(value) || value.length > TASK_ATTACHMENT_LIMIT) return fail(`每项定时任务最多附加 ${TASK_ATTACHMENT_LIMIT} 个文件。`);
  let totalBytes = 0;
  let imageCount = 0;
  const attachments = [];
  for (const item of value) {
    const absolute = typeof item?.path === 'string' && (path.isAbsolute(item.path) || path.win32.isAbsolute(item.path));
    const validHash = typeof item?.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(item.sha256);
    const size = Number(item?.size);
    const mimeType = IMAGE_TYPES.has(item?.mimeType) ? item.mimeType : 'application/octet-stream';
    if (!absolute || !validHash || !Number.isSafeInteger(size) || size < 1 || size > TASK_ATTACHMENT_BYTES) {
      if (strict) throw new Error('附件路径、哈希或大小无效。');
      continue;
    }
    totalBytes += size;
    if (totalBytes > TASK_ATTACHMENT_TOTAL_BYTES) return fail('单项定时任务的附件总量不能超过 20 MB。');
    if (IMAGE_TYPES.has(mimeType)) {
      imageCount += 1;
      if (imageCount > TASK_IMAGE_LIMIT || size > TASK_IMAGE_BYTES) return fail(`每项任务最多附加 ${TASK_IMAGE_LIMIT} 张图片，每张不超过 1.9 MB。`);
    }
    const name = path.win32.basename(String(item.name || path.basename(item.path)).replace(/[\x00-\x1f\x7f]/g, '_')).slice(0, 180) || '未命名文件';
    attachments.push({ path: path.resolve(item.path), name, mimeType, size, sha256: item.sha256.toLowerCase() });
  }
  return attachments;
}

function validTimeZone(value) {
  const zone = typeof value === 'string' ? value.trim() : '';
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return zone; }
  catch { return 'Asia/Shanghai'; }
}

function dateParts(date, timeZone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute };
}

function localDateToUtc({ year, month, day }, time, timeZone) {
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = dateParts(new Date(guess), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    const difference = target - represented;
    if (!difference) break;
    guess += difference;
  }
  return new Date(guess);
}

function shiftDate(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextScheduledAt(task, after = new Date()) {
  const zone = validTimeZone(task.timezone);
  const now = after instanceof Date ? after : new Date(after);
  if (!Number.isFinite(now.getTime())) throw new Error('计划时间无效。');
  if (task.frequency === 'once') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(task.date || '')) return null;
    const [year, month, day] = task.date.split('-').map(Number);
    const candidate = localDateToUtc({ year, month, day }, task.time, zone);
    return candidate > now ? candidate.toISOString() : null;
  }

  const localNow = dateParts(now, zone);
  const todayCandidate = (date) => localDateToUtc(date, task.time, zone);
  if (task.frequency === 'daily') {
    let date = { year: localNow.year, month: localNow.month, day: localNow.day };
    let candidate = todayCandidate(date);
    if (candidate <= now) candidate = todayCandidate(shiftDate(date, 1));
    return candidate.toISOString();
  }
  if (task.frequency === 'weekdays' || task.frequency === 'weekly') {
    for (let offset = 0; offset <= 7; offset += 1) {
      const date = shiftDate(localNow, offset);
      const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
      if (task.frequency === 'weekdays' && (weekday === 0 || weekday === 6)) continue;
      if (task.frequency === 'weekly' && weekday !== Number(task.weekday)) continue;
      const candidate = todayCandidate(date);
      if (candidate > now) return candidate.toISOString();
    }
    return null;
  }
  if (task.frequency === 'monthly') {
    const requestedDay = Math.max(1, Math.min(31, Number(task.monthDay) || localNow.day));
    for (let offset = 0; offset <= 12; offset += 1) {
      const monthDate = new Date(Date.UTC(localNow.year, localNow.month - 1 + offset, 1));
      const date = {
        year: monthDate.getUTCFullYear(),
        month: monthDate.getUTCMonth() + 1,
        day: Math.min(requestedDay, daysInMonth(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1)),
      };
      const candidate = todayCandidate(date);
      if (candidate > now) return candidate.toISOString();
    }
  }
  return null;
}

function normalizeTaskInput(input, existing, now = new Date()) {
  if (!input || typeof input !== 'object') throw new Error('定时任务内容无效。');
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('请填写任务说明。');
  if (prompt.length > 16000) throw new Error('任务说明不能超过 16000 个字符。');
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(input.time || '')) ? String(input.time) : '';
  if (!time) throw new Error('请选择有效的执行时间。');
  const frequency = FREQUENCIES.has(input.frequency) ? input.frequency : 'daily';
  const timezone = validTimeZone(input.timezone || 'Asia/Shanghai');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? String(input.date) : '';
  const projectId = typeof input.projectId === 'string'
    ? input.projectId.trim().slice(0, 200)
    : (typeof existing?.projectId === 'string' ? existing.projectId : '');
  const attachments = input.attachments === undefined
    ? normalizeTaskAttachments(existing?.attachments)
    : normalizeTaskAttachments(input.attachments, true);
  const task = {
    id: existing?.id || (typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID()),
    name: String(input.name || prompt.split(/\r?\n/)[0]).trim().slice(0, 100) || '定时任务',
    prompt,
    projectId,
    attachments,
    frequency,
    time,
    timezone,
    date: frequency === 'once' ? date : '',
    weekday: Math.max(0, Math.min(6, Number(input.weekday) || 0)),
    monthDay: Math.max(1, Math.min(31, Number(input.monthDay) || 1)),
    enabled: input.enabled === undefined ? existing?.enabled !== false : Boolean(input.enabled),
    createdAt: existing?.createdAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    lastRunAt: existing?.lastRunAt || null,
    nextRunAt: null,
  };
  if (frequency === 'once') {
    if (!date) throw new Error('单次任务需要选择执行日期。');
    task.nextRunAt = task.enabled ? nextScheduledAt(task, now) : null;
    if (task.enabled && !task.nextRunAt) throw new Error('单次任务时间必须晚于当前时间。');
  } else if (task.enabled) {
    task.nextRunAt = nextScheduledAt(task, now);
  }
  return task;
}

function normalizeTaskLibrary(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const tasks = Array.isArray(source.tasks) ? source.tasks.slice(0, TASK_LIMIT).filter((task) => task && typeof task.id === 'string' && typeof task.prompt === 'string').map((task) => {
    const frequency = FREQUENCIES.has(task.frequency) ? task.frequency : 'daily';
    const normalized = {
      id: task.id,
      name: String(task.name || task.prompt.split(/\r?\n/)[0]).slice(0, 100),
      prompt: task.prompt.slice(0, 16000),
      projectId: typeof task.projectId === 'string' ? task.projectId.trim().slice(0, 200) : '',
      attachments: normalizeTaskAttachments(task.attachments),
      frequency,
      time: /^([01]\d|2[0-3]):([0-5]\d)$/.test(task.time || '') ? task.time : '09:00',
      timezone: validTimeZone(task.timezone || 'Asia/Shanghai'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(task.date || '') ? task.date : '',
      weekday: Math.max(0, Math.min(6, Number(task.weekday) || 0)),
      monthDay: Math.max(1, Math.min(31, Number(task.monthDay) || 1)),
      enabled: Boolean(task.enabled),
      createdAt: typeof task.createdAt === 'string' ? task.createdAt : new Date(0).toISOString(),
      updatedAt: typeof task.updatedAt === 'string' ? task.updatedAt : new Date(0).toISOString(),
      lastRunAt: typeof task.lastRunAt === 'string' ? task.lastRunAt : null,
      nextRunAt: typeof task.nextRunAt === 'string' && Number.isFinite(Date.parse(task.nextRunAt)) ? task.nextRunAt : null,
    };
    if (normalized.enabled && !normalized.nextRunAt) normalized.nextRunAt = nextScheduledAt(normalized, new Date());
    if (normalized.frequency === 'once' && !normalized.nextRunAt) normalized.enabled = false;
    return normalized;
  }) : [];
  const runs = Array.isArray(source.runs) ? source.runs.slice(0, RUN_LIMIT).filter((run) => run && typeof run.id === 'string' && typeof run.taskId === 'string').map((run) => ({
    id: run.id,
    taskId: run.taskId,
    taskName: String(run.taskName || '定时任务').slice(0, 100),
    status: ['running', 'succeeded', 'failed'].includes(run.status) ? run.status : 'failed',
    startedAt: typeof run.startedAt === 'string' ? run.startedAt : new Date(0).toISOString(),
    completedAt: typeof run.completedAt === 'string' ? run.completedAt : null,
    output: String(run.output || '').slice(0, 16000),
  })) : [];
  return { version: 1, tasks, runs };
}

function createScheduledTaskService(filePath, runPrompt, options = {}) {
  let state = normalizeTaskLibrary();
  let loaded = false;
  let writeQueue = Promise.resolve();
  let timer = null;
  let tickRequest = null;
  let loadRequest = null;
  const running = new Set();
  const inFlight = new Set();
  const now = options.now || (() => new Date());

  const snapshot = () => structuredClone(state);
  const commit = (change) => {
    const operation = writeQueue.then(async () => {
      const candidate = structuredClone(state);
      const value = change(candidate);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(candidate, null, 2), { flag: 'wx' });
        await fs.rename(temporary, filePath);
      } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => {});
        throw error;
      }
      state = candidate;
      return value;
    });
    writeQueue = operation.catch(() => {});
    return operation.then(async (value) => {
      try { await options.onChanged?.(snapshot()); } catch {}
      return value;
    });
  };
  const ensureLoaded = async () => { if (!loaded) await service.load(); };

  async function execute(taskId, runTime, scheduled) {
    await ensureLoaded();
    if (running.has(taskId)) {
      if (scheduled) return null;
      throw new Error('此定时任务正在执行。');
    }
    running.add(taskId);
    const startedAt = new Date(runTime).toISOString();
    const run = { id: crypto.randomUUID(), taskId, taskName: '', status: 'running', startedAt, completedAt: null, output: '' };
    let task;
    try {
      await commit((candidate) => {
        task = candidate.tasks.find(entry => entry.id === taskId);
        if (!task) { if (scheduled) return; throw new Error('找不到这项定时任务。'); }
        if (scheduled && (!task.enabled || !task.nextRunAt || Date.parse(task.nextRunAt) > new Date(runTime).getTime())) { task = null; return; }
        run.taskName = task.name;
        candidate.runs = [{ ...run }, ...candidate.runs].slice(0, RUN_LIMIT);
        candidate.tasks = candidate.tasks.map(entry => entry.id !== taskId ? entry : {
          ...entry, lastRunAt: startedAt,
          ...(scheduled ? {
            enabled: entry.frequency === 'once' ? false : entry.enabled,
            nextRunAt: entry.frequency === 'once' ? null : nextScheduledAt(entry, new Date(runTime)),
          } : {}),
        });
      });
      if (!task) return null;
      try {
        const output = await runPrompt(structuredClone(task));
        run.status = 'succeeded';
        run.output = String(output || '').slice(0, 16000);
      } catch (error) {
        run.status = 'failed';
        run.output = String(error?.message || '任务执行失败。').slice(0, 16000);
      }
      run.completedAt = now().toISOString();
      await commit(candidate => { candidate.runs = candidate.runs.map(entry => entry.id === run.id ? { ...run } : entry); });
      return structuredClone(run);
    } finally {
      running.delete(taskId);
    }
  }

  function trackedExecute(...args) {
    const operation = execute(...args);
    inFlight.add(operation);
    operation.then(() => inFlight.delete(operation), () => inFlight.delete(operation));
    return operation;
  }

  const service = {
    async load() {
      if (loaded) return snapshot();
      if (!loadRequest) loadRequest = (async () => {
        try { state = normalizeTaskLibrary(JSON.parse(await fs.readFile(filePath, 'utf8'))); }
        catch (error) { if (error.code !== 'ENOENT') throw error; state = normalizeTaskLibrary(); }
        if (state.runs.some(run => run.status === 'running')) await commit(candidate => {
          for (const run of candidate.runs.filter(entry => entry.status === 'running')) {
            run.status = 'failed';
            run.completedAt = now().toISOString();
            run.output = '上次运行因程序退出而中断；未自动重试，请核对后重新运行。';
          }
        });
        loaded = true;
        return snapshot();
      })().finally(() => { loadRequest = null; });
      return loadRequest;
    },
    async bindUnassignedProject(projectId) {
      await ensureLoaded();
      const binding = typeof projectId === 'string' ? projectId.trim().slice(0, 200) : '';
      if (!binding || !state.tasks.some((task) => !task.projectId)) return snapshot();
      await commit(candidate => { candidate.tasks = candidate.tasks.map(task => task.projectId ? task : { ...task, projectId: binding }); });
      return snapshot();
    },
    snapshot,
    async create(input) {
      await ensureLoaded();
      await commit(candidate => {
        if (candidate.tasks.length >= TASK_LIMIT) throw new Error(`最多保存 ${TASK_LIMIT} 项定时任务。`);
        candidate.tasks.unshift(normalizeTaskInput(input, null, now()));
      });
      return snapshot();
    },
    async update(id, input) {
      await ensureLoaded();
      await commit(candidate => {
        if (running.has(id)) throw new Error('任务执行完成后才能编辑。');
        const existing = candidate.tasks.find(task => task.id === id);
        if (!existing) throw new Error('找不到这项定时任务。');
        const task = normalizeTaskInput(input, existing, now());
        candidate.tasks = candidate.tasks.map(item => item.id === id ? task : item);
      });
      return snapshot();
    },
    async remove(id) {
      await ensureLoaded();
      await commit(candidate => {
        if (running.has(id)) throw new Error('任务执行完成后才能删除。');
        candidate.tasks = candidate.tasks.filter(task => task.id !== id);
      });
      return snapshot();
    },
    async setEnabled(id, enabled) {
      await ensureLoaded();
      await commit(candidate => {
        const task = candidate.tasks.find(item => item.id === id);
        if (!task) throw new Error('找不到这项定时任务。');
        const next = { ...task, enabled: Boolean(enabled), updatedAt: now().toISOString() };
        if (next.enabled) {
          next.nextRunAt = nextScheduledAt(next, now());
          if (!next.nextRunAt) throw new Error('单次任务已过期，请编辑执行日期后再启用。');
        } else next.nextRunAt = null;
        candidate.tasks = candidate.tasks.map(item => item.id === id ? next : item);
      });
      return snapshot();
    },
    runNow(id) { return trackedExecute(id, now(), false); },
    tick(at = now()) {
      if (!tickRequest) tickRequest = (async () => {
        await ensureLoaded();
        const due = state.tasks.filter((task) => task.enabled && task.nextRunAt && Date.parse(task.nextRunAt) <= new Date(at).getTime()).map((task) => task.id);
        for (const id of due) await trackedExecute(id, at, true);
        return snapshot();
      })().finally(() => { tickRequest = null; });
      return tickRequest;
    },
    async waitForIdle() { if (tickRequest) await tickRequest; while (inFlight.size) await Promise.allSettled([...inFlight]); await writeQueue; },
    start(intervalMs = 15000) {
      if (timer) return;
      timer = setInterval(() => { void service.tick().catch(() => {}); }, intervalMs);
      timer.unref?.();
      void service.tick().catch(() => {});
    },
    stop() { if (timer) clearInterval(timer); timer = null; },
  };
  return service;
}

module.exports = {
  createScheduledTaskService,
  nextScheduledAt,
  normalizeTaskAttachments,
  normalizeTaskInput,
  normalizeTaskLibrary,
  validTimeZone,
  TASK_ATTACHMENT_LIMIT,
  TASK_ATTACHMENT_BYTES,
  TASK_ATTACHMENT_TOTAL_BYTES,
  TASK_IMAGE_LIMIT,
  TASK_IMAGE_BYTES,
};
