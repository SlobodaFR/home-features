import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { AppDto } from './app.dto';
import { toAppDto } from './to-app-dto';

@Injectable()
export class ListAppsUseCase {
  constructor(private readonly appRepository: AppRepository) {}

  async execute(userId: string): Promise<AppDto[]> {
    const apps = await this.appRepository.findAll(userId);
    return apps.map(toAppDto);
  }
}
