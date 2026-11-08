export const DEFAULT_SHORTCUTS = Object.freeze({
  commandPalette: 'Ctrl+Shift+P',
  newChat: 'Ctrl+K',
  files: 'Ctrl+P',
  terminal: 'Ctrl+J',
  settings: 'Ctrl+,',
  historyBack: 'Alt+ArrowLeft',
  historyForward: 'Alt+ArrowRight',
  save: 'Ctrl+S',
  browser: 'Ctrl+Shift+B',
  rename: 'Ctrl+Alt+R',
  pin: 'Ctrl+Alt+P',
  unread: 'Ctrl+Shift+U',
  archive: 'Ctrl+Shift+A',
});

const MODIFIERS = new Set(['Ctrl', 'Alt', 'Shift']);
const KEY_ALIASES = new Map([
  ['CONTROL', 'Ctrl'], ['CTRL', 'Ctrl'], ['COMMAND', 'Ctrl'], ['CMD', 'Ctrl'], ['META', 'Ctrl'],
  ['ALT', 'Alt'], ['OPTION', 'Alt'], ['SHIFT', 'Shift'], ['ESC', 'Escape'], [' ', 'Space'],
  ['LEFT', 'ArrowLeft'], ['RIGHT', 'ArrowRight'], ['UP', 'ArrowUp'], ['DOWN', 'ArrowDown'],
]);

function normalizeKey(value) {
  const text = value === ' ' ? ' ' : String(value || '').trim();
  if (!text) return '';
  const alias = KEY_ALIASES.get(text.toUpperCase());
  if (alias) return alias;
  if (/^F(?:[1-9]|1[0-2])$/i.test(text)) return text.toUpperCase();
  if (/^[A-Za-z0-9]$/.test(text)) return text.toUpperCase();
  if (/^(Arrow(?:Left|Right|Up|Down)|Enter|Escape|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Insert|Space|,|\.|\/|;|'|\[|\]|`|-|=)$/.test(text)) return text;
  return '';
}

export function normalizeShortcut(value, fallback = '') {
  const raw = String(value || '').trim().replace(/[＋]/g, '+').replace(/[\s]+/g, '+');
  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return fallback;
  const keys = [];
  for (const part of parts) {
    const upper = part.toUpperCase();
    const modifier = KEY_ALIASES.get(upper) || part;
    if (MODIFIERS.has(modifier)) keys.push(modifier);
    else {
      const key = normalizeKey(part);
      if (!key || keys.some((item) => !MODIFIERS.has(item))) return fallback;
      keys.push(key);
    }
  }
  const main = keys.at(-1);
  if (!main || MODIFIERS.has(main)) return fallback;
  const modifiers = [...new Set(keys.slice(0, -1))];
  if (modifiers.length !== keys.length - 1) return fallback;
  return [...['Ctrl', 'Alt', 'Shift'].filter((item) => modifiers.includes(item)), main].join('+');
}

export function normalizeShortcuts(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_SHORTCUTS).map(([id, fallback]) => [id, normalizeShortcut(source[id], fallback)]));
}

export function shortcutFromEvent(event) {
  if (!event || event.isComposing || event.key === 'Dead') return '';
  const key = normalizeKey(event.key);
  if (!key || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return '';
  const modifiers = [];
  if (event.ctrlKey || event.metaKey) modifiers.push('Ctrl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  return normalizeShortcut([...modifiers, key].join('+'));
}

export function matchesShortcut(event, shortcut) {
  const normalized = normalizeShortcut(shortcut);
  return Boolean(normalized) && shortcutFromEvent(event) === normalized;
}

export function formatShortcut(shortcut) {
  return normalizeShortcut(shortcut).replaceAll('ArrowLeft', '←').replaceAll('ArrowRight', '→').replaceAll('ArrowUp', '↑').replaceAll('ArrowDown', '↓');
}
