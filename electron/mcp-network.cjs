// Bound each SSE event, rather than the lifetime of a long-lived connection.
function boundedMcpResponse(response, limit = 2_000_000, { eventStream = false, onStreamEnd = () => {} } = {}) {
  if (!response.body) return response;
  const streaming = eventStream && /^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type') || '');
  const reader = response.body.getReader();
  let bytes = 0, lineBytes = 0, previousCR = false, ended = false;
  function finish(error) { if (streaming && !ended) { ended = true; onStreamEnd(error); } }
  const body = new ReadableStream({
    async pull(sink) {
      try {
        const next = await reader.read();
        if (next.done) { sink.close(); finish(); return; }
        if (streaming) {
          for (const byte of next.value) {
            if (previousCR && byte === 10) { previousCR = false; continue; }
            if (++bytes > limit) throw new Error('MCP 单个事件超过 2 MB 限制。');
            if (byte === 10 || byte === 13) { if (!lineBytes) bytes = 0; lineBytes = 0; previousCR = byte === 13; }
            else { lineBytes++; previousCR = false; }
          }
        } else if ((bytes += next.value.byteLength) > limit) throw new Error('OAuth 或 MCP 响应超过大小限制。');
        sink.enqueue(next.value);
      } catch (error) { sink.error(error); await reader.cancel(error).catch(() => {}); finish(error); }
    },
    cancel(reason) { ended = true; return reader.cancel(reason); },
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function isSseMessageRequest(input, init, serverUrl) {
  if (String(init?.method || 'GET').toUpperCase() !== 'POST' || typeof init?.body !== 'string') return false;
  try {
    const target = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    const message = JSON.parse(init.body);
    return target.origin === new URL(serverUrl).origin && !target.username && !target.password && !target.hash
      && message?.jsonrpc === '2.0' && typeof message === 'object' && !Array.isArray(message);
  } catch { return false; }
}

module.exports = { boundedMcpResponse, isSseMessageRequest };
