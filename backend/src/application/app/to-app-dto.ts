import { App } from '../../domain/app/app';
import { AppDto } from './app.dto';

export function toAppDto(app: App): AppDto {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    description: app.description,
    createdAt: app.createdAt.toISOString(),
  };
}
