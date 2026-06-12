import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { GetFlagsAndConfigsUseCase } from '../../../application/public-api/get-flags-and-configs.use-case';
import { Public } from '../decorators/public.decorator';
import { FlagsAndConfigsQueryDto } from '../dto/flags-and-configs-query.dto';

@Controller('v1')
export class PublicApiController {
  constructor(private readonly getFlagsAndConfigs: GetFlagsAndConfigsUseCase) {}

  @Public()
  @Get('flags-and-configs')
  async flagsAndConfigs(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: FlagsAndConfigsQueryDto,
  ) {
    const apiKey = extractBearerToken(authorization);
    if (!apiKey) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    return this.getFlagsAndConfigs.execute(apiKey, query.environment);
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}
