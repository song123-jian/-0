const MAX_CHAT_IMAGES = 4;
const MAX_CHAT_IMAGE_BYTES = 1_900_000;
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function normalizeChatImages(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CHAT_IMAGES).flatMap((image) => {
    if (!image || typeof image !== 'object' || typeof image.dataUrl !== 'string') return [];
    const match = IMAGE_DATA_URL.exec(image.dataUrl);
    if (!match) return [];
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_CHAT_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return [];
    return [{
      name: String(image.name || 'image.jpg').replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120),
      mimeType: `image/${match[1]}`,
      dataUrl: image.dataUrl,
    }];
  });
}

function modelMessageContent(content, images = []) {
  const safeImages = normalizeChatImages(images);
  if (!safeImages.length) return content;
  return [
    { type: 'text', text: typeof content === 'string' && content.trim() ? content : '请描述这些图片。' },
    ...safeImages.map(({ dataUrl }) => ({ type: 'image_url', image_url: { url: dataUrl } })),
  ];
}

module.exports = { MAX_CHAT_IMAGES, MAX_CHAT_IMAGE_BYTES, normalizeChatImages, modelMessageContent };
