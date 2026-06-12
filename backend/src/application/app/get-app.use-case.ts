import { Injectable, NotFoundException } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { AppDto } from './app.dto';
import { toAppDto } from './to-app-dto';

@Injectable()
export class GetAppUseCase {
  constructor(private readonly appRepository: AppRepository) {}

  async execute(id: string, userId: string): Promise<AppDto> {
    const app = await this.appRepository.findById(id);
    if (!app || app.userId !== userId) {
      throw new NotFoundException(`App ${id} not found`);
    }
    return toAppDto(app);
  }
}
