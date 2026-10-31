export const sameLocation = (left, right) => Boolean(left && right && left.view === right.view && (left.chatId || '') === (right.chatId || ''));

export function recordLocation(history, location) {
  if (sameLocation(history.entries[history.index], location)) return history;
  const entries = [...history.entries.slice(0, history.index + 1), location].slice(-100);
  return { entries, index: entries.length - 1 };
}

export function findLocation(history, direction, canVisit = () => true) {
  if (![-1, 1].includes(direction)) return null;
  const current = history.entries[history.index];
  for (let index = history.index + direction; index >= 0 && index < history.entries.length; index += direction) {
    const location = history.entries[index];
    if (!sameLocation(current, location) && canVisit(location)) return { index, location };
  }
  return null;
}
