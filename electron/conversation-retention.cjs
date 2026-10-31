const { normalizeLibrary } = require('./conversations.cjs');

function archiveInactiveConversations(library, days, now = Date.now()) {
  if (![30, 90].includes(days)) return { library: normalizeLibrary(library), archivedCount: 0 };
  const cutoff = Number(now) - days * 24 * 60 * 60 * 1000;
  const archivedAt = new Date(Number(now)).toISOString();
  let archivedCount = 0;
  const next = normalizeLibrary(library);
  next.conversations = next.conversations.map((chat) => {
    if (chat.archivedAt || chat.pinned || chat.id === next.activeId || (!chat.messages.length && !chat.draft.trim())
      || !Number.isFinite(Date.parse(chat.updatedAt)) || Date.parse(chat.updatedAt) >= cutoff) return chat;
    archivedCount += 1;
    return { ...chat, archivedAt };
  });
  return { library: next, archivedCount };
}

module.exports = { archiveInactiveConversations };
