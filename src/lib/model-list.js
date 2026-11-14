export const MODEL_MODES = [
  { id: 'main', label: '模式一' },
  { id: 'subagent', label: '模式二' },
  { id: 'advisor', label: '模式三' },
];

export function chatModelMode(value) {
  return MODEL_MODES.some((mode) => mode.id === value) ? value : 'main';
}

export function configuredConnectionModels(state, mode = 'main') {
  const field = mode === 'subagent' ? 'subagentModels' : mode === 'advisor' ? 'advisorModels' : 'models';
  if (state?.connection) return Array.isArray(state.connection[field]) ? state.connection[field] : [];
  return mode === 'main' && state?.model ? [state.model] : [];
}

export function connectionModels(state, mode = 'main') {
  const models = configuredConnectionModels(state, mode);
  const connection = state?.connection;
  if (mode !== 'main' || !connection?.baseUrl || connection.subagentBaseUrl !== connection.baseUrl || !connection.subagentModel || connection.subagentModel === connection.model) return models;
  return models.filter((model) => model !== connection.subagentModel);
}

export function chatModel(state, chat, mode = chatModelMode(chat?.modelMode)) {
  const models = connectionModels(state, mode);
  const field = mode === 'subagent' ? 'subagentModel' : mode === 'advisor' ? 'advisorModel' : 'model';
  const candidates = [chat?.modelSelections?.[mode], ...(chatModelMode(chat?.modelMode) === mode ? [chat?.model] : []), state?.connection?.[field]];
  return candidates.find((model) => models.includes(model)) || models[0] || '';
}

export function modelModeError(state, mode) {
  const label = MODEL_MODES.find((item) => item.id === mode)?.label || '所选模式';
  const credential = mode === 'subagent' ? 'hasSubagentCredential' : mode === 'advisor' ? 'hasAdvisorCredential' : 'hasCredential';
  if (!configuredConnectionModels(state, mode).length || state?.connection?.[credential] === false || mode === 'advisor' && !state?.connection?.advisorModel) return `${label}尚未配置完整，请在“模型与连接”中配置对应模型和 API Key。`;
  return '';
}

export function replaceModelList(connection, fetched) {
  const models = [...new Set(fetched)];
  if (!models.length) throw new Error('服务返回的模型列表为空。');
  const model = models.includes(connection.model) ? connection.model : models[0];
  const separate = connection.subagentBaseUrl && connection.baseUrl && connection.subagentBaseUrl !== connection.baseUrl;
  const childModels = Array.isArray(connection.subagentModels) ? connection.subagentModels : models;
  const subagentModel = !connection.subagentModel ? '' : separate ? (childModels.includes(connection.subagentModel) ? connection.subagentModel : childModels[0] || '') : (models.includes(connection.subagentModel) ? connection.subagentModel : model);
  return { models, model, subagentModel, ...(Array.isArray(connection.subagentModels) ? { subagentModels: childModels } : {}) };
}
