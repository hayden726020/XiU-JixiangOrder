import { ApiError, unavailable, validationError } from './errors.mjs';

const MAX_BODY_BYTES = 64 * 1024;

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

export function sendError(res, error) {
  const apiError =
    error instanceof ApiError
      ? error
      : unavailable('服务处理请求时发生错误。');
  sendJson(res, apiError.status, {
    error: {
      code: apiError.code,
      message: apiError.message,
      retryable: apiError.retryable,
    },
  });
}

export async function readJsonBody(req, { allowEmpty = true } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw validationError('请求体过大。');
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    if (allowEmpty) {
      return {};
    }
    throw validationError('请求体不能为空。');
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw validationError('请求体必须是合法 JSON。');
  }
}

export function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', typeof origin === 'string' ? origin : '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

export function matchRoute(routes, method, pathname) {
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const match = route.pattern.exec(pathname);
    if (match) {
      return { route, params: match.groups ?? {} };
    }
  }
  return null;
}

export function createRequestHandler({ routes, db, clock, logger = () => {} }) {
  return async function handle(req, res) {
    const startedAt = Date.now();
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let statusCode = 200;
    try {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      const matched = matchRoute(routes, req.method ?? 'GET', pathname);
      if (!matched) {
        throw new ApiError('NOT_FOUND', '接口不存在。', 404, false);
      }
      const result = await matched.route.handler({
        req,
        res,
        params: matched.params,
        db,
        clock,
      });
      if (result !== undefined) {
        statusCode = result.status ?? 200;
        if (statusCode === 204) {
          res.writeHead(204);
          res.end();
        } else {
          sendJson(res, statusCode, result.body);
        }
      }
    } catch (error) {
      statusCode = error instanceof ApiError ? error.status : 503;
      sendError(res, error);
    } finally {
      logger({
        method: req.method,
        pathname: (req.url ?? '').split('?')[0],
        status: statusCode,
        durationMs: Date.now() - startedAt,
      });
    }
  };
}