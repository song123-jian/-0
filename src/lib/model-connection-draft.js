const ROLE_FIELDS = {
  main: ['name', 'note', 'website', 'baseUrl', 'addresses', 'models', 'model', 'reasoningEffort', 'toolProtocol', 'contextWindowTokens', 'retryLimit', 'maxOutputTokens', 'reportUsage', 'imageModel'],
  subagent: ['subagentBaseUrl', 'subagentModels', 'subagentModel', 'subagentReasoningEffort', 'subagentToolProtocol', 'subagentContextWindowTokens', 'subagentMaxConcurrent', 'subagentAllowEdits'],
  advisor: ['advisorEnabled', 'advisorBaseUrl', 'advisorModels', 'advisorModel', 'advisorReasoningEffort', 'advisorToolProtocol', 'advisorContextWindowTokens'],
};

export function roleFields(role) {
  if (!ROLE_FIELDS[role]) throw new Error('未知模型角色。');
  return ROLE_FIELDS[role];
}

export const roleKey = role => role === 'main' ? 'apiKey' : role + 'ApiKey';

// Start with the latest persisted connection so another role's draft is never saved.
export function roleSavePayload(saved, draft, role, key) {
  const payload = { ...saved };
  for (const field of roleFields(role)) payload[field] = draft[field];
  payload[roleKey(role)] = key;
  return payload;
}

export function mergeConnectionDraft(draft, saved, dirtyFields) {
  const next = { ...saved };
  for (const field of dirtyFields) if (Object.hasOwn(draft, field)) next[field] = draft[field];
  return next;
}
