const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_RESULT_BYTES = 1_200_000;
const TARGET_MAX_EDGE = 640;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type DishImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('图片读取结果不是文本。'));
      }
    };
    reader.onerror = () => reject(new Error('图片读取失败。'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片格式无法解码。'));
    };
    image.src = objectUrl;
  });
}

async function compressImage(
  source: HTMLImageElement | ImageBitmap,
  width: number,
  height: number,
): Promise<string> {
  const scale = Math.min(1, TARGET_MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持图片压缩。');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export async function readDishImage(file: File): Promise<DishImageResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, error: '当前环境不支持选择图片。' };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: '只支持 JPG、PNG 或 WebP 图片。' };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: '原图不能超过 6 MB，请先压缩后再选。' };
  }

  let dataUrl: string;
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      try {
        dataUrl = await compressImage(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    } else {
      const image = await loadImageElement(file);
      dataUrl = await compressImage(image, image.naturalWidth, image.naturalHeight);
    }
  } catch {
    try {
      dataUrl = await readAsDataUrl(file);
    } catch {
      return { ok: false, error: '图片读取失败，请换一张图片重试。' };
    }
  }

  if (dataUrl.length > MAX_RESULT_BYTES) {
    return { ok: false, error: '图片压缩后仍然过大，请换一张更小的图片。' };
  }
  return { ok: true, dataUrl };
}