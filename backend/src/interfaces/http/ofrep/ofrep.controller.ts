import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthenticatedApiKey } from '../../../application/api-key/authenticate-api-key.use-case';
import { EvaluateOfrepFlagsUseCase } from '../../../application/ofrep/evaluate-ofrep-flags.use-case';
import { ifNoneMatchSatisfied } from '../../../application/ofrep/ofrep-evaluation';
import { Public } from '../decorators/public.decorator';
import { SkipSameOrigin } from '../decorators/skip-same-origin.decorator';
import { ApiKeyGuard, ApiKeyRequest } from '../guards/api-key.guard';
import { OfrepBodyRequest, ofrepContextError } from './ofrep-body';
import {
  OfrepEvaluationError,
  OfrepExceptionFilter,
} from './ofrep-exception.filter';

type OfrepRequest = ApiKeyRequest & OfrepBodyRequest;

/**
 * OpenFeature Remote Evaluation Protocol 0.4.0 (booleans), called by consumers' OFREP providers
 * with `Authorization: Bearer hf_...`. Never a session: @Public (no JwtAuthGuard), no cookie read,
 * @SkipSameOrigin (server-to-server or behind a consumer's own proxy), @SkipThrottle (ApiKeyGuard
 * limits per key and per failed-auth IP instead). The environment is the key's, never the
 * context's; the context is accepted, ignored and never logged.
 */
@Public()
@SkipSameOrigin()
@SkipThrottle()
@UseGuards(ApiKeyGuard)
@UseFilters(OfrepExceptionFilter)
@Controller('ofrep/v1/evaluate')
export class OfrepController {
  constructor(private readonly evaluate: EvaluateOfrepFlagsUseCase) {}

  @Post('flags/:key')
  @HttpCode(HttpStatus.OK)
  async evaluateFlag(@Param('key') key: string, @Req() req: OfrepRequest) {
    const invalid = ofrepContextError(req.ofrepRawBody);
    if (invalid) {
      throw new OfrepEvaluationError(
        HttpStatus.BAD_REQUEST,
        'INVALID_CONTEXT',
        invalid,
        key,
      );
    }
    const evaluation = await this.evaluate.evaluateOne(authOf(req), key);
    if (!evaluation) {
      throw new OfrepEvaluationError(
        HttpStatus.NOT_FOUND,
        'FLAG_NOT_FOUND',
        'Flag not found',
        key,
      );
    }
    return evaluation;
  }

  @Post('flags')
  async evaluateFlags(
    @Req() req: OfrepRequest,
    @Res() res: Response,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
  ): Promise<void> {
    const invalid = ofrepContextError(req.ofrepRawBody);
    if (invalid) {
      throw new OfrepEvaluationError(
        HttpStatus.BAD_REQUEST,
        'INVALID_CONTEXT',
        invalid,
      );
    }
    const { flags, etag } = await this.evaluate.evaluateAll(authOf(req));
    // Set before sending: Express would otherwise compute its own weak ETag.
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    // Express only answers 304 by itself for GET/HEAD.
    if (ifNoneMatchSatisfied(ifNoneMatch, etag)) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    res.status(HttpStatus.OK).json({ flags });
  }
}

function authOf(req: OfrepRequest): AuthenticatedApiKey {
  // ApiKeyGuard sets it or refuses the request.
  return req.apiKey!;
}
