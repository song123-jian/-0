export const MAX_CHAT_IMAGES = 4;

export async function prepareChatImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('仅支持 PNG、JPEG 或 WebP 图片。');
  if (file.size > 24 * 1024 * 1024) throw new Error('单张图片不能超过 24 MB。');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('图片尺寸超过 4000 万像素。');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法准备图片预览。');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) throw new Error('无法压缩这张图片。');
    if (blob.size > 1_800_000) blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.68));
    if (!blob || blob.size > 1_900_000) throw new Error('压缩后的图片仍超过 1.9 MB。');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('无法读取这张图片。'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    return { name: file.name.slice(0, 120) || 'image.jpg', mimeType: 'image/jpeg', dataUrl };
  } finally {
    bitmap.close();
  }
}

export async function prepareChatImages(files, current = []) {
  const selected = Array.from(files || []);
  if (current.length + selected.length > MAX_CHAT_IMAGES) throw new Error(`每条消息最多附加 ${MAX_CHAT_IMAGES} 张图片。`);
  return Promise.all(selected.map(prepareChatImage));
}
