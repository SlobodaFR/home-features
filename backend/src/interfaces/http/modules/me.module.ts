import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetCurrentUserUseCase } from '../../../application/auth/get-current-user.use-case';
import { UserRepository } from '../../../domain/user/user.repository';
import { MeController } from '../controllers/me.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MeController],
  providers: [
    {
      provide: GetCurrentUserUseCase,
      inject: [UserRepository, ConfigService],
      useFactory: (users: UserRepository, config: ConfigService) =>
        new GetCurrentUserUseCase(
          users,
          config.get<string>('AUTH_SERVICE_URL'),
        ),
    },
  ],
})
export class MeModule {}
