import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

export type OfrepErrorCode = 'FLAG_NOT_FOUND' | 'INVALID_CONTEXT';

/** An OFREP evaluation failure: `key` for single-flag routes, absent for bulk. */
export class OfrepEvaluationError extends Error {
  constructor(
    readonly status: HttpStatus.NOT_FOUND | HttpStatus.BAD_REQUEST,
    readonly errorCode: OfrepErrorCode,
    readonly errorDetails: string,
    readonly key?: string,
  ) {
    super(errorDetails);
  }
}

/**
 * Every /ofrep error in OFREP's shape, never Nest's {statusCode, message}:
 * evaluation failures {key?, errorCode, errorDetails}; 401/429 and other HTTP errors
 * {errorDetails} (Retry-After was set by ApiKeyGuard and is kept); anything else
 * 500 {errorDetails: "internal error"}, logged through the whitelist error serializer.
 */
@Catch()
export class OfrepExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Ofrep');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof OfrepEvaluationError) {
      response.status(exception.status).json({
        ...(exception.key === undefined ? {} : { key: exception.key }),
        errorCode: exception.errorCode,
        errorDetails: exception.errorDetails,
      });
      return;
    }
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      response
        .status(exception.getStatus())
        .json({ errorDetails: exception.message });
      return;
    }
    this.logger.error(exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ errorDetails: 'internal error' });
  }
}
