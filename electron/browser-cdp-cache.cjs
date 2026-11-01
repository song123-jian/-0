const MIB = 1024 * 1024;

const LIMITS = Object.freeze({
  parameterBytes: 4 * MIB,
  resultBytes: 4 * MIB,
  eventsPerTab: 10000,
  eventBytes: 8 * MIB,
  totalEventBytes: 64 * MIB,
  pageEvents: 1000,
  pageBytes: 4 * MIB - 64 * 1024,
});

function createCdpEventCache(overrides = {}) {
  const limits = { ...LIMITS, ...overrides };
  const states = new Set();
  let totalBytes = 0;
  let sequence = 0;

  const register = (state) => states.add(state);
  const publicEvent = (entry) => ({ ...entry });
  const removeOldest = (state) => {
    const removed = state.events.shift();
    if (!removed) return;
    state.storedBytes -= removed.sizeBytes;
    totalBytes -= removed.sizeBytes;
    state.droppedBefore = Math.max(state.droppedBefore, removed.id);
  };
  const trimTotal = () => {
    while (totalBytes > limits.totalEventBytes) {
      let oldestState;
      let oldestSequence = Number.POSITIVE_INFINITY;
      for (const state of states) {
        const oldest = state.events[0];
        if (oldest && oldest.sequence < oldestSequence) {
          oldestSequence = oldest.sequence;
          oldestState = state;
        }
      }
      if (!oldestState) { totalBytes = 0; break; }
      removeOldest(oldestState);
    }
  };

  function createState({ nextEventId = 0, droppedBefore = 0, attachedByApp = false } = {}) {
    const state = { events: [], nextEventId, droppedBefore, storedBytes: 0, attachedByApp, listener: null };
    register(state);
    return state;
  }

  function append(state, method, params, sessionId) {
    register(state);
    const id = ++state.nextEventId;
    let serialized;
    try { serialized = JSON.stringify({ method, params, sessionId }); } catch { serialized = '{}'; }
    if (typeof serialized !== 'string') serialized = 'null';
    const originalBytes = Buffer.byteLength(serialized, 'utf8');
    let entry = originalBytes > limits.eventBytes
      ? { id, method, ...(sessionId ? { session_id: sessionId } : {}), truncated: true, original_bytes: originalBytes, preview: serialized.slice(0, 8000) }
      : { id, method, ...(params === undefined ? {} : { params }), ...(sessionId ? { session_id: sessionId } : {}) };
    let entryBytes = Buffer.byteLength(JSON.stringify(entry), 'utf8');
    if (entryBytes > limits.eventBytes) {
      entry = { id, method, ...(sessionId ? { session_id: sessionId } : {}), truncated: true, original_bytes: originalBytes, preview: serialized.slice(0, 8000) };
      entryBytes = Buffer.byteLength(JSON.stringify(entry), 'utf8');
    }
    Object.defineProperties(entry, {
      sequence: { value: ++sequence },
      sizeBytes: { value: entryBytes },
    });
    state.events.push(entry);
    state.storedBytes += entryBytes;
    totalBytes += entryBytes;
    while (state.events.length > limits.eventsPerTab) removeOldest(state);
    trimTotal();
    return entry;
  }

  function release(state) {
    if (!state) return;
    totalBytes -= state.storedBytes;
    state.events.length = 0;
    state.storedBytes = 0;
    states.delete(state);
  }

  function page(state, { after = 0, limit = 100, method, tab, maxBytes = limits.pageBytes } = {}) {
    const cursor = Number.isSafeInteger(after) && after >= 0 ? after : 0;
    const pageLimit = Math.max(1, Math.min(limits.pageEvents, Number.isInteger(limit) ? limit : 100));
    const byteLimit = Math.max(1, Math.min(limits.pageBytes, Number.isFinite(maxBytes) ? maxBytes : limits.pageBytes));
    const candidates = state.events.filter((event) => event.id > cursor && (!method || event.method === method));
    const makePage = (events, hasMore, nextAfter) => ({
      events,
      last_event_id: state.nextEventId,
      dropped_before: state.droppedBefore,
      has_gap: cursor < state.droppedBefore,
      has_more: hasMore,
      next_after: nextAfter,
      ...(tab ? { tab } : {}),
    });
    const selected = [];
    for (const candidate of candidates.slice(0, pageLimit)) {
      let event = publicEvent(candidate);
      let next = makePage([...selected, event], candidates.length > selected.length + 1, event.id);
      if (Buffer.byteLength(JSON.stringify(next), 'utf8') > byteLimit) {
        if (selected.length) break;
        const serialized = JSON.stringify(event);
        event = { id: candidate.id, method: candidate.method, ...(candidate.session_id ? { session_id: candidate.session_id } : {}), truncated: true, original_bytes: candidate.sizeBytes, preview: serialized.slice(0, 8000) };
        next = makePage([event], candidates.length > 1, event.id);
        while (event.preview && Buffer.byteLength(JSON.stringify(next), 'utf8') > byteLimit) {
          event.preview = event.preview.slice(0, Math.floor(event.preview.length / 2));
          next = makePage([event], candidates.length > 1, event.id);
        }
        if (Buffer.byteLength(JSON.stringify(next), 'utf8') > byteLimit) {
          event = { id: candidate.id, method: candidate.method, truncated: true, original_bytes: candidate.sizeBytes };
          next = makePage([event], candidates.length > 1, event.id);
        }
        selected.push(event);
        break;
      }
      selected.push(event);
    }
    const hasMore = candidates.length > selected.length;
    return makePage(selected, hasMore, selected.length ? selected[selected.length - 1].id : cursor);
  }

  return {
    createState,
    append,
    release,
    page,
    stats: () => ({ totalBytes, states: states.size }),
  };
}

module.exports = { createCdpEventCache, LIMITS };
