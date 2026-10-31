export function truncateUtf8(text, maximumBytes) {
  const bytes = new TextEncoder().encode(String(text));
  if (bytes.length <= maximumBytes) return String(text);
  let end = maximumBytes;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return new TextDecoder().decode(bytes.subarray(0, end));
}
