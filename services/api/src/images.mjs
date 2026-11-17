import { notFound, validationError } from './errors.mjs';
import { readRawBody } from './http.mjs';
import { newId, requestHash } from './util.mjs';
import { runIdempotent, transaction } from './tx.mjs';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_ID_PATTERN = /^[A-Za-z0-9_-]{4,80}$/;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

export function detectImageMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function parseDataUrlImage(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw validationError('图片数据必须是 dataUrl 字符串。');
  }
  const match = DATA_URL_PATTERN.exec(dataUrl.trim());
  if (!match) {
    throw validationError('只支持 JPG、PNG 或 WebP 格式的 base64 图片。');
  }
  const declaredMime = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw validationError(`图片大小必须在 1 字节到 ${MAX_IMAGE_BYTES} 字节之间。`);
  }
  const detected = detectImageMimeType(buffer);
  if (!detected || detected !== declaredMime) {
    throw validationError('图片文件内容与声明格式不符。');
  }
  return { mimeType: detected, buffer };
}

function parseMultipartImage(rawBuffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  if (!boundaryMatch) {
    throw validationError('multipart/form-data 缺少 boundary。');
  }
  const boundary = boundaryMatch[1] ?? boundaryMatch[2];
  const delimiter = Buffer.from(`--${boundary}`);
  let pos = rawBuffer.indexOf(delimiter);
  if (pos === -1) {
    throw validationError('未找到上传文件分段。');
  }
  while (pos !== -1) {
    const partStart = pos + delimiter.length;
    if (rawBuffer.subarray(partStart, partStart + 2).toString('ascii') === '--') {
      break;
    }
    const headerStart =
      rawBuffer[partStart] === 0x0d && rawBuffer[partStart + 1] === 0x0a
        ? partStart + 2
        : rawBuffer[partStart] === 0x0a
          ? partStart + 1
          : partStart;
    const headerEndCrlf = rawBuffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    const headerEndLf = rawBuffer.indexOf(Buffer.from('\n\n'), headerStart);
    const useCrlf = headerEndCrlf !== -1 && (headerEndLf === -1 || headerEndCrlf < headerEndLf);
    const headerEnd = useCrlf ? headerEndCrlf : headerEndLf;
    const sepLen = useCrlf ? 4 : 2;
    if (headerEnd === -1) {
      throw validationError('上传分段格式不正确。');
    }
    const headersText = rawBuffer.subarray(headerStart, headerEnd).toString('utf8');
    const nextBoundary = rawBuffer.indexOf(delimiter, headerEnd + sepLen);
    if (nextBoundary === -1) {
      throw validationError('上传分段未正常结束。');
    }
    let bodyEnd = nextBoundary;
    if (rawBuffer[bodyEnd - 2] === 0x0d && rawBuffer[bodyEnd - 1] === 0x0a) {
      bodyEnd -= 2;
    } else if (rawBuffer[bodyEnd - 1] === 0x0a) {
      bodyEnd -= 1;
    }
    const ctMatch = /^content-type:\s*([^\r\n;]+)/im.exec(headersText);
    const partMime = ctMatch ? ctMatch[1].trim().toLowerCase() : null;
    const hasFilename = /filename=/i.test(headersText);
    if (hasFilename || (partMime && ALLOWED_MIME_TYPES.has(partMime))) {
      const fileBuffer = rawBuffer.subarray(headerEnd + sepLen, bodyEnd);
      if (fileBuffer.length === 0 || fileBuffer.length > MAX_IMAGE_BYTES) {
        throw validationError(`图片大小必须在 1 字节到 ${MAX_IMAGE_BYTES} 字节之间。`);
      }
      const detected = detectImageMimeType(fileBuffer);
      if (!detected || (partMime && partMime !== detected)) {
        throw validationError('只支持有效的 JPG、PNG 或 WebP 图片文件。');
      }
      return { mimeType: detected, buffer: Buffer.from(fileBuffer) };
    }
    pos = nextBoundary;
  }
  throw validationError('未找到 JPG、PNG 或 WebP 图片文件。');
}

export function storeUploadedImage(db, { merchantId, ownerUserId = null, mimeType, buffer, now }) {
  const id = newId('img');
  db.prepare(
    `INSERT INTO uploaded_images (id, merchant_id, owner_user_id, mime_type, data_blob, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, merchantId, ownerUserId, mimeType, buffer, buffer.length, now);
  return {
    id,
    imageUrl: `/api/v1/images/${id}`,
    mimeType,
    sizeBytes: buffer.length,
  };
}

export async function uploadMerchantImage({ db, clock, req, user }) {
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  const rawBuffer = await readRawBody(req, { maxBytes: MAX_UPLOAD_BODY_BYTES });
  if (rawBuffer.length === 0) {
    throw validationError('上传内容不能为空。');
  }

  let parsedImage;
  let requestId = null;

  if (contentType.includes('application/json') || contentType === '') {
    let json;
    try {
      json = JSON.parse(rawBuffer.toString('utf8'));
    } catch {
      throw validationError('请求体必须是合法 JSON。');
    }
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw validationError('请求体必须是 JSON 对象。');
    }
    for (const key of Object.keys(json)) {
      if (key !== 'dataUrl' && key !== 'requestId') {
        throw validationError(`不支持的字段：${key}。`);
      }
    }
    if (json.requestId !== undefined) {
      if (typeof json.requestId !== 'string' || json.requestId.trim().length === 0 || json.requestId.length > 120) {
        throw validationError('requestId 长度应在 1 到 120 之间。');
      }
      requestId = json.requestId.trim();
    }
    parsedImage = parseDataUrlImage(json.dataUrl);
  } else if (contentType.includes('multipart/form-data')) {
    parsedImage = parseMultipartImage(rawBuffer, String(req.headers['content-type']));
  } else {
    const baseMime = contentType.split(';')[0].trim();
    if (!ALLOWED_MIME_TYPES.has(baseMime)) {
      throw validationError('只支持 JPG、PNG、WebP 或 JSON dataUrl 上传。');
    }
    if (rawBuffer.length > MAX_IMAGE_BYTES) {
      throw validationError(`图片大小不能超过 ${MAX_IMAGE_BYTES} 字节。`);
    }
    const detected = detectImageMimeType(rawBuffer);
    if (!detected || detected !== baseMime) {
      throw validationError('图片文件内容与 Content-Type 不符。');
    }
    parsedImage = { mimeType: detected, buffer: rawBuffer };
  }

  const now = clock();
  const merchantId = user.merchant_id ?? user.id;

  if (requestId) {
    const hash = requestHash({ mimeType: parsedImage.mimeType, sha: parsedImage.buffer.toString('base64') });
    return transaction(db, () =>
      runIdempotent(db, { actorId: user.id, operation: 'merchant-image-upload', requestId, hash, now }, () => ({
        status: 201,
        body: {
          data: storeUploadedImage(db, {
            merchantId,
            ownerUserId: user.id,
            mimeType: parsedImage.mimeType,
            buffer: parsedImage.buffer,
            now,
          }),
        },
      })),
    );
  }

  return {
    status: 201,
    body: {
      data: storeUploadedImage(db, {
        merchantId,
        ownerUserId: user.id,
        mimeType: parsedImage.mimeType,
        buffer: parsedImage.buffer,
        now,
      }),
    },
  };
}

export function getPublicImage({ db, params }) {
  const id = params.id;
  if (typeof id !== 'string' || !IMAGE_ID_PATTERN.test(id)) {
    throw notFound('IMAGE_NOT_FOUND', '图片不存在。');
  }
  const row = db.prepare('SELECT mime_type, data_blob FROM uploaded_images WHERE id = ?').get(id);
  if (!row) {
    throw notFound('IMAGE_NOT_FOUND', '图片不存在。');
  }
  return {
    status: 200,
    headers: {
      'Content-Type': row.mime_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    rawBody: Buffer.from(row.data_blob),
  };
}
