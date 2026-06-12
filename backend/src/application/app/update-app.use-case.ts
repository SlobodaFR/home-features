import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';
import { AppDto } from './app.dto';
import { AppInput } from './app-input.dto';
import { assertAppOwnership } from './assert-app-ownership';
import { toAppDto } from './to-app-dto';

@Injectable()
export class UpdateAppUseCase {
  constructor(private readonly appRepository: AppRepository) {}

  async execute(id: string, input: AppInput, userId: string): Promise<AppDto> {
    const existing = await assertAppOwnership(this.appRepository, id, userId);

    const conflict = await this.appRepository.findByNameOrSlug(
      userId,
      input.name,
      input.slug,
    );
    if (conflict && conflict.id !== id) {
      throw new ConflictException(
        'An app with this name or slug already exists',
      );
    }

    let app: App;
    try {
      app = App.create({
        id: existing.id,
        userId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        createdAt: existing.createdAt,
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
