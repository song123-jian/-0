const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { toolPolicyAllowed } = require('./permission-policy.cjs');
const { withFileCommit } = require('./file-commit.cjs');
const { buildOffice, readOffice, normalizeSpec } = require('./office-artifacts.cjs');
const { imageHeader } = require('./image-tools.cjs');
const MAX = 16 * 1024 * 1024;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const string = description => ({ type: 'string', description });
const specSchema = { type: 'object', additionalProperties: false, required: ['title','sections'], properties: { title: string('文档标题'), sections: { type: 'array', minItems: 1, maxItems: 80, items: { type: 'object', additionalProperties: false, required: ['heading','paragraphs'], properties: { heading: string('章节或幻灯片标题'), paragraphs: { type: 'array', items: { type: 'string' } }, table: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } } } } };
const def = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', additionalProperties: false, properties, required } } });
const DEFINITIONS = [
  def('artifact_read', '读取DOCX/PPTX/PDF正文与SHA；工作台生成的DOCX/PPTX同时返回可编辑spec。外部模板只提取正文，不承诺保留复杂排版。', { path: string('文件路径') }, ['path']),
  def('artifact_write', '把完整spec写成真实DOCX/PPTX或PDF成品。PPTX每章节一页，最多8段每段140字符。已有文件必须先artifact_read并带SHA，仅工作台生成的DOCX/PPTX可原位重建；外部文件须新建副本。PDF为内容排版导出，不是Office原生版式转换。写后artifact_read核对正文。', { path: string('目标.docx/.pptx/.pdf'), expected_hash: string('新文件new；已有文件使用刚读取的SHA'), spec: specSchema }, ['path','expected_hash','spec']),
  def('artifact_image', '通过用户单独配置的图像模型生成PNG成品，调用images/generations。只在用户请求生成图片时调用，每次一张；接口必须返回base64图片。先确认目标不存在，生成后image_read查看真实结果。', { path: string('新的.png目标'), prompt: string('图像生成提示词'), size: { type: 'string', enum: ['1024x1024','1024x1536','1536x1024'] } }, ['path','prompt']),
];
function createArtifactTools({ projectFiles, readOnly = false, guard = async () => {}, policy = () => 'on-request', fullAccess = () => false, authorize = async () => {}, approve, isDirty = () => false, onFileChanged = () => {}, pdfRenderer, imageProcessor, connection, fetchImpl = fetch, observed = new Map() }) {
  const check = async (signal, writing = false) => { if (signal?.aborted) throw new Error('任务已停止。'); await guard(); if (writing && readOnly) throw new Error('规划模式不能写入成品。'); if (!toolPolicyAllowed(policy(), fullAccess())) throw new Error('当前权限不允许成品工具。'); };
  const readBytes = async target => { const stat = await fs.stat(target); if (!stat.isFile() || stat.size > MAX) throw new Error('文件超过16MB或不是普通文件。'); return fs.readFile(target); };
  return {
    get definitions() { return toolPolicyAllowed(policy(), fullAccess()) ? DEFINITIONS.filter(d => (!readOnly || d.function.name === 'artifact_read') && (d.function.name !== 'artifact_image' || connection?.imageModel)) : []; },
    async execute(name, args, context = {}) {
      const definition = DEFINITIONS.find(d => d.function.name === name)?.function.parameters;
      if (!definition || !args || typeof args !== 'object' || Object.keys(args).some(k => !Object.hasOwn(definition.properties, k)) || definition.required.some(k => !Object.hasOwn(args,k)) || typeof args.path !== 'string' || !args.path.trim() || args.path.length > 4096) throw new Error('成品工具参数无效。');
      const writing = name !== 'artifact_read'; await check(context.signal, writing);
      const target = await projectFiles.resolve(args.path, writing);
      await authorize(writing ? 'file-write' : 'file-read', { path: target.target }, context);
      if (name === 'artifact_read') {
        if (!/\.(docx|pptx|pdf)$/i.test(target.target)) throw new Error('支持DOCX/PPTX/PDF。');
        const bytes = await readBytes(target.target), result = await readOffice(bytes, target.target); await check(context.signal); observed.set(target.target, hash(bytes));
        return { ok: true, path: target.relative, hash: hash(bytes), bytes: bytes.length, ...result, activity: { title: '读取办公成品', path: target.target, output: result.text } };
      }
      const image = name === 'artifact_image'; const type = path.extname(target.target).slice(1).toLowerCase();
      if (image ? type !== 'png' : !['docx','pptx','pdf'].includes(type)) throw new Error('目标扩展名与成品类型不匹配。');
      if (isDirty(target.target)) throw new Error('目标存在未保存编辑。');
      let before = null; try { before = await readBytes(target.target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const expected = image ? 'new' : args.expected_hash;
      if (before ? observed.get(target.target) !== expected || hash(before) !== expected : expected !== 'new') throw new Error('目标已变化或尚未读取；新文件使用new。');
      if (before && !(await readOffice(before, target.target)).editable) throw new Error('外部模板或PDF请另存为新文件，避免破坏原始排版。');
      let spec;
      if (!image) spec = normalizeSpec(args.spec, type);
      else if (!connection?.imageModel || typeof args.prompt !== 'string' || !args.prompt.trim() || args.prompt.length > 16000 || args.size && !['1024x1024','1024x1536','1536x1024'].includes(args.size)) throw new Error('请配置图像模型并提供有效提示词。');
      if (typeof approve !== 'function') throw new Error('缺少成品操作授权处理器。');
      await approve({ title: image ? '调用图像模型生成图片' : '保存办公成品', path: target.target, command: image ? args.prompt : JSON.stringify(spec), note: image ? '将提示词发送给已配置的图像模型，可能产生服务费用。' : '按显示内容生成真实文件；不会运行文档中的脚本。' }, context.signal);
      await check(context.signal, true);
      let bytes;
      if (image) {
        const endpoint = connection.endpoint.replace(/\/chat\/completions$/, '/images/generations');
        await authorize('network', { hostname: new URL(endpoint).hostname }, context);
        const signal = context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
        const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal, headers: { authorization: 'Bearer ' + connection.apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ model: connection.imageModel, prompt: args.prompt, n: 1, size: args.size || '1024x1024', response_format: 'b64_json' }) });
        if (!response.ok) { await response.body?.cancel(); throw new Error('图像服务请求失败（HTTP ' + response.status + '），没有保存文件。'); }
        const reader = response.body?.getReader(); if (!reader) throw new Error('图像服务返回空响应。');
        const chunks = []; let length = 0; try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX) throw new Error('图像响应超过16MB。'); chunks.push(Buffer.from(value)); } } finally { await reader.cancel().catch(() => {}); }
        let payload; try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('图像服务未返回有效JSON。'); }
        const encoded = payload?.data?.[0]?.b64_json; if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('图像服务未返回base64图片；当前不自动下载远端URL。');
        const original = Buffer.from(encoded, 'base64'); const header = imageHeader(original);
        const result = await imageProcessor('data:image/' + header.mime + ';base64,' + encoded, [], { signal: context.signal, format: 'png' });
        bytes = Buffer.from(result.dataUrl.split(',')[1], 'base64'); imageHeader(bytes);
      } else bytes = type === 'pdf' ? await pdfRenderer(spec, context.signal) : await buildOffice(spec, type);
      if (bytes.length > MAX) throw new Error('输出超过16MB，未保存。');
      await check(context.signal, true);
      return withFileCommit(target.target, async () => {
        await projectFiles.resolve(target.target, true); if (isDirty(target.target)) throw new Error('目标出现未保存编辑。');
        let current = null; try { current = await readBytes(target.target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (before ? !current || hash(current) !== hash(before) : current) throw new Error('目标已被其他任务修改，未覆盖。');
        await fs.mkdir(path.dirname(target.target), { recursive: true }); const temporary = target.target + '.scodex-' + crypto.randomUUID() + '.tmp';
        try { await fs.writeFile(temporary, bytes, { flag: 'wx' }); await check(context.signal, true); await projectFiles.resolve(target.target, true); if (isDirty(target.target)) throw new Error('目标出现未保存编辑。'); if (before && hash(await readBytes(target.target)) !== hash(before)) throw new Error('保存前目标变化，未覆盖。'); if (before) await fs.rename(temporary, target.target); else { await fs.link(temporary, target.target); await fs.unlink(temporary); } }
        finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
        const saved = await readBytes(target.target); if (hash(saved) !== hash(bytes)) throw new Error('保存后文件变化，请重新读取。');
        observed.set(target.target, hash(saved)); onFileChanged(target.target);
        return { ok: true, path: target.relative, hash: hash(saved), bytes: saved.length, activity: { title: image ? '生成图片成品' : '生成办公成品', path: target.target, output: '已保存并回读SHA256；请打开预览检查内容。' } };
      });
    },
  };
}
module.exports = { createArtifactTools, DEFINITIONS };
