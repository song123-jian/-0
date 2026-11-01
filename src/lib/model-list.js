export function connectionModels(state) {
  if (state?.connection) return Array.isArray(state.connection.models) ? state.connection.models : [];
  return state?.model ? [state.model] : [];
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
