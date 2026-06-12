import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';
import { AppDto } from './app.dto';
import { AppInput } from './app-input.dto';
import { toAppDto } from './to-app-dto';

@Injectable()
export class CreateAppUseCase {
  constructor(private readonly appRepository: AppRepository) {}

  async execute(input: AppInput, userId: string): Promise<AppDto> {
    const existing = await this.appRepository.findByNameOrSlug(
      userId,
      input.name,
      input.slug,
    );
    if (existing) {
      throw new ConflictException(
        'An app with this name or slug already exists',
      );
    }

    let app: App;
    try {
      app = App.create({
        id: randomUUID(),
        userId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        createdAt: new Date(),
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid app',
      );
    }

    await this.appRepository.save(app);

    return toAppDto(app);
  }
}
