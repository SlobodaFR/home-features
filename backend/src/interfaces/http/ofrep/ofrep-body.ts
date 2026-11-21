import type { NextFunction, Request, Response } from 'express';

/** Largest OFREP request body read; a larger one is refused (400 INVALID_CONTEXT). */
export const OFREP_BODY_LIMIT_BYTES = 64 * 1024;

export interface OfrepRawBody {
  text: string;
  tooLarge: boolean;
}

export type OfrepBodyRequest = Request & { ofrepRawBody?: OfrepRawBody };

/**
 * Reads OFREP request bodies before Nest's JSON parser (configureApp registers it first). The
 * parser's errors (malformed JSON, too large) are answered outside any controller filter, in Nest's
 * own {statusCode, message} format, which OFREP clients cannot read. This reader never fails: it
 * keeps the raw text for the controller, which answers 400 INVALID_CONTEXT itself. Once the stream
 * is consumed, body-parser skips the request: body-parser >= 2 returns early when
 * `onFinished.isFinished(req)` (1.x would fail on the consumed stream instead).
 */
export function readOfrepBody(
  req: OfrepBodyRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (req.method !== 'POST') {
    next();
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  let done = false;
  const finish = (body: OfrepRawBody) => {
    // 'error' may follow 'end' on a destroyed request: call next() once.
    if (done) {
      return;
    }
    done = true;
    req.ofrepRawBody = body;
    next();
  };
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > OFREP_BODY_LIMIT_BYTES) {
      tooLarge = true;
      chunks.length = 0;
    } else {
      chunks.push(chunk);
    }
  });
  req.on('end', () => {
    finish({
      text: tooLarge ? '' : Buffer.concat(chunks).toString('utf8'),
      tooLarge,
    });
  });
  req.on('error', () => {
    finish({ text: '', tooLarge: true });
  });
}

/**
 * The body is optional; when present it must be a JSON object whose optional `context` is an
 * object. The context is accepted and ignored (no targeting): never stored, never logged.
 */
export function ofrepContextError(
  raw: OfrepRawBody | undefined,
): string | null {
  if (!raw || raw.text.trim() === '') {
    return raw?.tooLarge ? 'Request body too large' : null;
  }
  let body: unknown;
  try {
    body = JSON.parse(raw.text);
  } catch {
    return 'Request body is not valid JSON';
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }
  if (!('context' in body)) {
    return null;
  }
  const { context } = body;
  if (
    typeof context !== 'object' ||
    context === null ||
    Array.isArray(context)
  ) {
    return 'context must be an object';
  }
  return null;
}
