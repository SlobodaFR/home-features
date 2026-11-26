import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { serializedDataSourceFactory } from '../infrastructure/persistence/serialized-connection';

/** `TypeOrmModule.forRoot` on the serialized connection, like DatabaseModule (issue #57). */
export const serializedTypeOrmRoot = (options: TypeOrmModuleOptions) =>
  TypeOrmModule.forRootAsync({
    useFactory: () => options,
    dataSourceFactory: serializedDataSourceFactory,
  });
