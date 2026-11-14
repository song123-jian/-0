const crypto = require('node:crypto');
const {
  MAX_VISUALIZATIONS_PER_MESSAGE,
  normalizeVisualizationHtml,
  normalizeWidgetState,
} = require('./visualization-contract.cjs');

const definition = {
  type: 'function',
  function: {
    name: 'visualize_render',
    description: '在当前聊天中显示一个自包含的交互式图表。只输出内嵌 HTML/CSS/JavaScript，不使用外部脚本、样式、图片或网络；最多 3 个图表。可用 widget_state 与 setWidgetState 保存小型 JSON 交互状态。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '图表标题，最多 120 个字符', maxLength: 120 },
        html: { type: 'string', description: '完整或片段 HTML，最多 128 KiB UTF-8；必须自包含' },
        widget_state: { type: 'object', description: '可选的初始 JSON 对象状态，最多 16 KiB' },
      },
      required: ['title', 'html'],
      additionalProperties: false,
    },
  },
};

function createVisualizationTools() {
  let count = 0;
  return {
    definitions: [definition],
    execute: async (name, input) => {
      if (name !== 'visualize_render') throw new Error('未知的可视化工具。');
      count += 1;
      if (count > MAX_VISUALIZATIONS_PER_MESSAGE) throw new Error('每条回复最多生成 3 个图表。');
      const title = typeof input?.title === 'string' ? input.title.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) : '';
      const html = normalizeVisualizationHtml(input?.html);
      const widgetState = input?.widget_state === undefined ? null : normalizeWidgetState(input.widget_state);
      if (!title) throw new Error('图表标题不能为空。');
      if (!html) throw new Error('图表 HTML 为空、包含无效字符或超过 128 KiB。');
      if (widgetState === undefined) throw new Error('图表初始状态必须是 16 KiB 以内的有限 JSON 数据。');
      const visualization = { id: crypto.randomUUID(), title, html, widgetState };
      return {
        ok: true,
        activity: { title: '交互图表', detail: title, visualization },
      };
    },
  };
}

module.exports = { createVisualizationTools };
