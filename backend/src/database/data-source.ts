import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';

/**
 * DataSource for the TypeORM CLI (migrations). The running app builds its own
 * connection in app.module.ts with the same entities and migrations.
 *
 *   npm run migration:run                 apply pending migrations
 *   npm run migration:generate -- Name    diff entities vs. DB into a new migration
 */
export const MIGRATIONS_GLOB = join(__dirname, 'migrations', '*.js');

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://agos:agos@localhost:5433/agos',
  entities: ENTITIES,
  migrations: [MIGRATIONS_GLOB],
  synchronize: false,
});
