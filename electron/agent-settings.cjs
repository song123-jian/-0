const APPROVAL_POLICIES = ['on-request', 'never'];
const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'];
const WEB_SEARCH_MODES = ['disabled', 'cached', 'indexed', 'live'];
const OUTPUT_DETAILS = ['default', 'low', 'medium', 'high'];
const REASONING_SUMMARIES = ['auto', 'concise', 'detailed', 'none'];
const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const DEFAULT_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const MAX_NETWORK_DOMAINS = 100;

function normalizeNetworkDomain(value) {
  if (typeof value !== 'string') return '';
  const host = value.trim().toLowerCase().replace(/^\*\*?\./, '*.').replace(/\.$/, '');
  if (!host || host.length > 253 || /[^a-z0-9.*:-]/i.test(host)) return '';
  if (host !== '*' && host.includes('*') && !host.startsWith('*.') && !host.startsWith('**.')) return '';
  return host;
}

function normalizeAgentSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const requestedEfforts = Array.isArray(value.availableReasoningEfforts)
    ? new Set(value.availableReasoningEfforts.filter((effort) => typeof effort === 'string'))
    : new Set(DEFAULT_REASONING_EFFORTS);
  let availableReasoningEfforts = REASONING_EFFORTS.filter((effort) => requestedEfforts.has(effort));
  if (!availableReasoningEfforts.length) availableReasoningEfforts = ['max'];
  const defaultReasoningEffort = availableReasoningEfforts.includes(value.defaultReasoningEffort)
    ? value.defaultReasoningEffort
    : availableReasoningEfforts[availableReasoningEfforts.length - 1];

  const normalized = {
    approvalPolicy: APPROVAL_POLICIES.includes(value.approvalPolicy) ? value.approvalPolicy : 'never',
    sandboxMode: SANDBOX_MODES.includes(value.sandboxMode) ? value.sandboxMode : 'danger-full-access',
    webSearch: WEB_SEARCH_MODES.includes(value.webSearch) ? value.webSearch : 'disabled',
    outputDetail: OUTPUT_DETAILS.includes(value.outputDetail) ? value.outputDetail : 'default',
    reasoningSummary: REASONING_SUMMARIES.includes(value.reasoningSummary) ? value.reasoningSummary : 'auto',
    availableReasoningEfforts,
    defaultReasoningEffort,
    workspaceDependencies: typeof value.workspaceDependencies === 'boolean' ? value.workspaceDependencies : true,
  };
  if (Object.hasOwn(value, 'networkAccess') || Object.hasOwn(value, 'networkDomains') || Object.hasOwn(value, 'allowLocalBinding')) {
    normalized.networkAccess = Boolean(value.networkAccess);
    normalized.networkDomains = Array.isArray(value.networkDomains)
      ? [...new Set(value.networkDomains.map(normalizeNetworkDomain).filter(Boolean))].slice(0, MAX_NETWORK_DOMAINS)
      : [];
    normalized.allowLocalBinding = Boolean(value.allowLocalBinding);
  }
  return normalized;
}

function toCodexConfigArguments(value) {
  const settings = normalizeAgentSettings(value);
  const args = [
    '--config', `approval_policy="${settings.approvalPolicy}"`,
    '--config', `sandbox_mode="${settings.sandboxMode}"`,
    '--config', `web_search="${settings.webSearch}"`,
    '--config', `model_reasoning_effort="${settings.defaultReasoningEffort}"`,
    '--config', `model_reasoning_summary="${settings.reasoningSummary}"`,
  ];
  if (settings.outputDetail !== 'default') {
    args.push('--config', `model_verbosity="${settings.outputDetail}"`);
  }
  if (settings.networkAccess) args.push('--config', 'sandbox_workspace_write.network_access=true');
  const networkDomains = Array.isArray(settings.networkDomains) ? settings.networkDomains : [];
  if (networkDomains.length) {
    const table = networkDomains.map((domain) => `${JSON.stringify(domain)} = "allow"`).join(', ');
    args.push('--config', 'features.network_proxy.enabled=true', '--config', `features.network_proxy.domains={ ${table} }`);
  }
  if (settings.allowLocalBinding) args.push('--config', 'features.network_proxy.allow_local_binding=true');
  args.push(settings.workspaceDependencies ? '--enable' : '--disable', 'workspace_dependencies');
  return args;
}

function responseStyleInstruction(value, requestedEffort) {
  const settings = normalizeAgentSettings(value);
  const effort = settings.availableReasoningEfforts.includes(requestedEffort)
    ? requestedEffort
    : settings.defaultReasoningEffort;
  const detail = {
    default: '按任务复杂度决定详略，避免无必要展开。',
    low: '回答简洁，优先给结论和必要步骤。',
    medium: '兼顾简洁与细节，提供理解结论所需的依据。',
    high: '提供较完整的解释、边界和示例。',
  }[settings.outputDetail];
  const summary = {
    auto: '仅在有助于理解时给出简短的结论依据。',
    concise: '给出简洁的结论依据，不展开过程。',
    detailed: '给出结构化的关键依据和可核对步骤。',
    none: '不附加推理摘要，只保留必要结论与操作。',
  }[settings.reasoningSummary];
  const effortInstruction = {
    low: '聚焦最关键的判断，保持回答精简。',
    medium: '检查必要的边界条件，再给出结论。',
    high: '核对重要边界和替代情形，再组织回答。',
    xhigh: '仔细核对多步关系、边界和不确定项。',
    max: '充分核对关键假设、边界和可验证依据。',
    ultra: '对复杂问题进行全面核对，并明确未能验证的部分。',
  }[effort];
  return `回答详细程度：${detail}\n推理摘要：${summary}\n回答深度偏好：${effortInstruction}\n不要输出隐含的逐步思维链。`;
}

module.exports = {
  APPROVAL_POLICIES,
  DEFAULT_REASONING_EFFORTS,
  OUTPUT_DETAILS,
  REASONING_EFFORTS,
  REASONING_SUMMARIES,
  SANDBOX_MODES,
  WEB_SEARCH_MODES,
  MAX_NETWORK_DOMAINS,
  normalizeNetworkDomain,
  normalizeAgentSettings,
  responseStyleInstruction,
  toCodexConfigArguments,
};
