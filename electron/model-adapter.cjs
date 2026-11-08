const EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

function reasoningAdaptation(error, requested) {
  if (![400, 422].includes(error?.httpStatus) || !EFFORT_ORDER.includes(requested)) return null;
  let detail = String(error.providerDetail || '');
  if (!/reasoning[_ -]?effort/i.test(detail)) {
    // Some gateways omit the parameter name. Accept only their complete, known
    // reasoning enum error; schema/tool/unknown enum errors must remain errors.
    const generic = detail.match(/^(?:(?:invalid_value|invalid_request_error)\s*[·:|\-]\s*)*Invalid value:\s*['"]([^'"]+)['"]\.\s*Supported values are:\s*(.+)$/i);
    if (!generic || generic[1] !== requested) return null;
    const values = generic[2].toLowerCase().replace(/['".,]/g, ' ').split(/\s+/).filter(value => value && !['and', 'or'].includes(value));
    if (!values.every(value => EFFORT_ORDER.includes(value)) || !['low', 'medium', 'high'].every(value => values.includes(value))) return null;
    detail = 'reasoning_effort ' + detail;
  }
  const advertised = detail.match(/(?:;\s*use\b|\b(?:supported|allowed|valid)\s+(?:values?|efforts?|options?)\s*(?:are|include)?\s*[:=]?)([^\r\n]+)/i);
  if (!advertised) return /unsupported\s+parameter\s*[:=]?\s*["']?reasoning_effort\b/i.test(detail) ? { omit: true } : null;
  const rejected = detail.slice(0, advertised.index);
  if (!/does not support|not supported|unsupported|invalid/i.test(rejected)) return null;
  const values = /\b(?:none|minimal|low|medium|high|xhigh|max|ultra)\b/gi;
  const rejectedEfforts = [...rejected.matchAll(values)].map(item => item[0].toLowerCase());
  if (rejectedEfforts.at(-1) !== requested) return null;
  const supported = [...new Set([...advertised[1].matchAll(values)].map(item => item[0].toLowerCase()))].filter(item => item !== requested);
  if (!supported.length) return null;
  const lower = supported.filter(item => EFFORT_ORDER.indexOf(item) < EFFORT_ORDER.indexOf(requested));
  const ranked = (lower.length ? lower : supported).sort((a, b) => EFFORT_ORDER.indexOf(a) - EFFORT_ORDER.indexOf(b));
  return { effort: lower.length ? ranked.at(-1) : ranked[0] };
}

function rejectsNativeTools(error) {
  if (![400, 422].includes(error?.httpStatus)) return false;
  const detail = String(error.providerDetail || '');
  return /\b(?:does not support|doesn't support|unsupported|unrecognized|unknown)\s+(?:native\s+)?(?:parameters?\s*[:=]?\s*)?["']?(?:tools|tool_choice|parallel_tool_calls|tool calling|function calling)\b/i.test(detail)
    || /\b(?:tools|tool_choice|parallel_tool_calls|tool calling|function calling)["']?\s+(?:(?:is|are)\s+)?(?:not supported|unsupported|not available)\b/i.test(detail);
}

// Request-local state: explicit saved choices and credentials are never mutated.
function createModelAdapter(connection, { hasTools = false } = {}) {
  const automatic = !connection.toolProtocol || connection.toolProtocol === 'auto';
  let protocol = connection.toolProtocol === 'json' ? 'json' : 'native';
  let effort = connection.reasoning_effort || '', reasoningAdapted = false, toolsAdapted = false;
  return {
    get toolProtocol() { return hasTools ? protocol : 'none'; },
    get reasoningEffort() { return effort; },
    get reasoningAdapted() { return reasoningAdapted; },
    adapt(error, { allowToolFallback = false } = {}) {
      const next = !reasoningAdapted && reasoningAdaptation(error, effort);
      if (next) {
        const from = effort; effort = next.omit ? '' : next.effort; reasoningAdapted = true;
        return { type: 'reasoning', from, to: effort };
      }
      if (automatic && hasTools && protocol === 'native' && !toolsAdapted && allowToolFallback && rejectsNativeTools(error)) {
        protocol = 'json'; toolsAdapted = true;
        return { type: 'tools', from: 'native', to: 'json' };
      }
      return null;
    },
  };
}

module.exports = { createModelAdapter, reasoningAdaptation };
