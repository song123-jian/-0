const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { normalizeChatImages } = require('./chat-images.cjs');
const { withFileCommit } = require('./file-commit.cjs');
const MAX_BYTES = 8 * 1024 * 1024, MAX_OUTPUT = MAX_BYTES;
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const str = (description) => ({ type: 'string', description });
const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const def = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const operation = { type: 'object', additionalProperties: false, required: ['type'], properties: {
  type: { type: 'string', enum: ['crop', 'resize', 'rotate', 'flip', 'brightness', 'text'] },
  x: integer(0, 9999), y: integer(0, 9999), width: integer(1, 10000), height: integer(1, 10000),
  degrees: { type: 'integer', enum: [90, 180, 270] }, axis: { type: 'string', enum: ['horizontal', 'vertical'] }, percent: integer(10, 300),
  text: str('最多200字符的文字'), font_size: integer(14, 500), color: str('#RRGGBB'), outline: str('可选描边 #RRGGBB'), bold: { type: 'boolean' },
} };
const DEFINITIONS = [
  def('image_read', '读取项目内8MB／2000万像素以内的静态PNG／JPEG／WebP；先展示审批，获准后将真实预览图片发送给所选模型并返回原图尺寸、SHA及沿途AGENTS。模型须支持图片；预览缩小不改变原文件。', { path: str('项目内图片路径') }, ['path']),
  def('image_edit', '对刚image_read的图片顺序执行裁剪、旋转、缩放、翻转、亮度、中文文字叠加并经逐次审批保存PNG或JPEG，随后应重新读取核对。使用原图SHA，目标已有文件也必须先image_read并提供其SHA；新目标用new。检查dirty和并发变化，不是生成式重绘。坐标均以每步当前图片左上角为原点。', {
    path: str('源图路径'), expected_hash: str('源图最新SHA256'), output_path: str('保存到项目内PNG／JPG／JPEG；可与原图相同'), output_expected_hash: str('目标最新SHA256；新文件为new'),
    operations: { type: 'array', minItems: 1, maxItems: 12, items: operation },
  }, ['path', 'expected_hash', 'output_path', 'output_expected_hash', 'operations']),
];
const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
function dimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000 || width * height > 20000000) throw new Error('图片最多10000像素单边、2000万像素。');
  return { width, height };
}
// Bound native decoder allocation using file headers before loading Chromium.
function imageHeader(b) {
  let w, h, mime;
  if (b.length >= 33 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString('ascii', 12, 16) === 'IHDR') {
    w = b.readUInt32BE(16); h = b.readUInt32BE(20); mime = 'png';
    let i = 8; while (i + 12 <= b.length) { const len = b.readUInt32BE(i), kind = b.toString('ascii', i + 4, i + 8); if (kind === 'acTL') throw new Error('动画PNG暂不编辑。'); if (kind === 'IDAT') break; if (len > b.length - i - 12) throw new Error('PNG结构损坏。'); i += len + 12; }
  } else if (b.length >= 4 && b[0] === 255 && b[1] === 216) {
    mime = 'jpeg'; let i = 2;
    while (i + 4 <= b.length) {
      if (b[i++] !== 255) throw new Error('JPEG结构损坏。'); while (b[i] === 255) i += 1;
      const marker = b[i++]; if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (i + 2 > b.length) break; const len = b.readUInt16BE(i);
      if (len < 2 || i + len > b.length) throw new Error('JPEG结构损坏。');
      if ([192,193,194].includes(marker)) { if (len < 8) throw new Error('JPEG尺寸损坏。'); h = b.readUInt16BE(i + 3); w = b.readUInt16BE(i + 5); break; }
      i += len;
    }
  } else if (b.length >= 30 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP') {
    mime = 'webp'; const type = b.toString('ascii',12,16);
    if (type === 'VP8X') { if (b[20] & 2) throw new Error('动画WebP暂不编辑。'); w = 1 + b.readUIntLE(24,3); h = 1 + b.readUIntLE(27,3); }
    else if (type === 'VP8 ') { if (!b.subarray(23,26).equals(Buffer.from([157,1,42]))) throw new Error('WebP结构损坏。'); w = b.readUInt16LE(26) & 16383; h = b.readUInt16LE(28) & 16383; }
    else if (type === 'VP8L' && b[20] === 47) { w = 1 + (((b[22] & 63) << 8) | b[21]); h = 1 + (((b[24] & 15) << 10) | (b[23] << 2) | (b[22] >> 6)); }
  }
  if (!mime) throw new Error('只支持静态PNG／JPEG／WebP图片。');
  return { ...dimensions(w, h), mime };
}
function validate(name, args) {
  const schema = DEFINITIONS.find((d) => d.function.name === name)?.function.parameters;
  if (!schema || !plain(args) || Object.keys(args).some((k) => !Object.hasOwn(schema.properties,k)) || schema.required.some((k) => !Object.hasOwn(args,k))) throw new Error('图片工具参数缺失或包含未知字段。');
  for (const k of schema.required.filter((k) => k !== 'operations')) if (typeof args[k] !== 'string' || !args[k].trim() || args[k].length > 4096) throw new Error('图片路径／版本无效。');
  if (name === 'image_read') return;
  if (!/^[a-f0-9]{64}$/.test(args.expected_hash) || !/^(new|[a-f0-9]{64})$/.test(args.output_expected_hash)) throw new Error('请使用读取返回的完整SHA256；新目标为new。');
  if (!Array.isArray(args.operations) || !args.operations.length || args.operations.length > 12) throw new Error('每批图片操作应为1–12项。');
  const fields = { crop: ['x','y','width','height'], resize: ['width','height'], rotate: ['degrees'], flip: ['axis'], brightness: ['percent'], text: ['x','y','text','font_size','color','outline','bold'] };
  for (const op of args.operations) {
    const keys = fields[op?.type];
    if (!plain(op) || !keys || Object.keys(op).some((k) => k !== 'type' && !keys.includes(k)) || keys.filter((k) => !['outline','bold'].includes(k)).some((k) => !Object.hasOwn(op,k))) throw new Error('图片操作字段无效。');
    for (const [k,v] of Object.entries(op)) {
      if (k === 'type') continue;
      const rule = operation.properties[k];
      let invalid;
      if (rule.type === 'integer') invalid = !Number.isSafeInteger(v) || (rule.enum ? !rule.enum.includes(v) : v < rule.minimum || v > rule.maximum);
      else if (k === 'text') invalid = typeof v !== 'string' || !v.trim() || v.length > 200 || /[\x00-\x08]/.test(v);
      else if (['color','outline'].includes(k)) invalid = typeof v !== 'string' || !/^#[a-f0-9]{6}$/i.test(v);
      else if (k === 'bold') invalid = typeof v !== 'boolean';
      else invalid = !rule.enum?.includes(v);
      if (invalid) throw new Error('图片操作参数无效：' + k);
    }
    if (op.type === 'resize' || op.type === 'crop') dimensions(op.width,op.height);
  }
}
function createImageTools({ projectFiles, processor, guard = async () => {}, readOnly = false, policy = () => 'never', approve, authorize = async () => {}, isDirty = () => false, onFileChanged = () => {} }) {
  const observed = new Map();
  const check = async (signal, write = false) => { await guard(); if (signal?.aborted) throw new Error('任务已停止。'); if (policy() !== 'on-request' || write && readOnly) throw new Error('图片操作需要逐次审批；规划只读。'); };
  async function read(item) {
    if (!/\.(png|jpe?g|webp)$/i.test(item.target)) throw new Error('图片扩展名须为PNG／JPEG／WebP。');
    const info = await fs.stat(item.target); if (!info.isFile() || info.size > MAX_BYTES) throw new Error('图片须为8MB以内的普通文件。');
    const bytes = await fs.readFile(item.target); if (bytes.length > MAX_BYTES) throw new Error('图片在读取期间超过大小限制。');
    return { bytes, hash: hash(bytes), ...imageHeader(bytes) };
  }
  const imageResult = (capture, item, title) => {
    const modelImages = normalizeChatImages([{ name: path.basename(item.target), dataUrl: capture.preview }]);
    if (!modelImages.length) throw new Error('图片预览超过模型消息限制。');
    const thumbnail = normalizeChatImages([{ name: path.basename(item.target), dataUrl: capture.thumbnail }])[0];
    return { modelImages, activity: { title, path: item.target, detail: item.relative + ' · ' + capture.width + ' × ' + capture.height,
      output: '真实图片已准备供后续模型请求使用；本机保存结果以文件回读为准。', ...(thumbnail?.dataUrl.length <= 130000 ? { screenshot: thumbnail } : {}) } };
  };
  return { definitions: DEFINITIONS.filter((d) => policy() === 'on-request' && (d.function.name === 'image_read' || !readOnly)),
    async execute(name, args, context = {}) {
      validate(name,args); const write = name === 'image_edit'; await check(context.signal,write);
      const source = await projectFiles.resolve(args.path); await authorize('file-read',{path:source.target},context);
      const original = await read(source); const destination = write ? await projectFiles.resolve(args.output_path,true) : source;
      let targetBefore;
      if (write) {
        if (!/\.(png|jpe?g)$/i.test(destination.target)) throw new Error('编辑结果保存为PNG或JPEG。');
        if (observed.get(source.target) !== args.expected_hash || original.hash !== args.expected_hash) throw new Error('源图版本变化或尚未读取，请重新image_read。');
        if (isDirty(source.target) || isDirty(destination.target)) throw new Error('图片有未保存修改，请先导出或重置。');
        await authorize('file-write',{path:destination.target},context);
        try { targetBefore = await read(destination); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (targetBefore ? targetBefore.hash !== args.output_expected_hash || observed.get(destination.target) !== args.output_expected_hash : args.output_expected_hash !== 'new') throw new Error('目标版本变化或尚未读取；请读取目标，新文件用new。');
      }
      await check(context.signal,write);
      if (typeof approve !== 'function') throw new Error('缺少图片审批处理器。');
      await approve({ kind:'image',title:write?'保存图片修改':'读取图片并发送模型',path:destination.target,
        command:JSON.stringify(write?{source:source.relative,source_hash:original.hash,output:destination.relative,output_hash:targetBefore?.hash||'new',operations:args.operations}:{file:source.relative,hash:original.hash,width:original.width,height:original.height},null,2),
        note:write?'批准后按顺序处理并保存图片；覆盖目标前重新检查版本和未保存编辑。':'这张图片的预览会发送给所选模型。请确认内容与模型；预览最多1280像素，不改变原图。',
        allowLabel:write?'允许本次图片修改':'允许读取图片' },context.signal);
      await check(context.signal,write);
      for (const item of [source,destination]) await projectFiles.resolve(item.target,write);
      if (hash(await fs.readFile(source.target)) !== original.hash) throw new Error('审批期间源图已变化，未继续处理。');
      if (write && (isDirty(source.target)||isDirty(destination.target))) throw new Error('审批期间出现未保存图片编辑，未覆盖。');
      const capture = await processor('data:image/'+original.mime+';base64,'+original.bytes.toString('base64'),write?args.operations:[],{signal:context.signal,format:/\.png$/i.test(destination.target)?'png':'jpeg',previewOnly:!write});
      await check(context.signal,write);
      const evidence = imageResult(capture,destination,write?'保存图片':'读取图片');
      if (!write) { observed.set(source.target,original.hash); return {ok:true,path:source.relative,hash:original.hash,width:capture.width,height:capture.height,preview_max_edge:1280,instructions:await projectFiles.instructions(source.target),...evidence}; }
      const match = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(capture.dataUrl||'');
      if (!match) throw new Error('图片处理器未返回有效结果。');
      const data = Buffer.from(match[1],'base64'); if (data.length>MAX_OUTPUT) throw new Error('输出超过8MB，未保存。');
      const decoded = imageHeader(data); if (decoded.width!==capture.width||decoded.height!==capture.height) throw new Error('图片尺寸校验不一致。');
      await fs.mkdir(path.dirname(destination.target),{recursive:true});
      const temporary = destination.target+'.scodex-'+crypto.randomUUID()+'.tmp';
      return withFileCommit(destination.target, async () => {
      try {
        await fs.writeFile(temporary,data,{flag:'wx'}); await check(context.signal,true);
        await projectFiles.resolve(source.target); await projectFiles.resolve(destination.target,true);
        if (isDirty(source.target)||isDirty(destination.target)) throw new Error('图片出现未保存编辑，未覆盖。');
        if (hash(await fs.readFile(source.target))!==original.hash) throw new Error('处理期间源图已变化，未保存。');
        let current;try {current=await fs.readFile(destination.target);}catch(e){if(e.code!=='ENOENT')throw e;}
        if (targetBefore?!current||hash(current)!==targetBefore.hash:Boolean(current)) throw new Error('目标图片被其他程序修改，未覆盖。');
        if (targetBefore) await fs.rename(temporary,destination.target); else {await fs.link(temporary,destination.target);await fs.unlink(temporary);}
        const saved = await fs.readFile(destination.target);if(hash(saved)!==hash(data))throw new Error('保存后图片变化，请重新读取。');
        observed.set(destination.target,hash(saved));onFileChanged(destination.target);
        return {ok:true,path:destination.relative,hash:hash(saved),width:capture.width,height:capture.height,bytes:saved.length,...evidence};
      } finally {await fs.rm(temporary,{force:true}).catch(()=>{});}
      });
    },
  };
}
module.exports = {createImageTools,DEFINITIONS,validate,imageHeader,dimensions};
