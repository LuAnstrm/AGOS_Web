// Local PostgreSQL for development, no Docker or system install needed.
// Data persists in backend/.pgdata. Ctrl+C to stop.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../.pgdata', import.meta.url));
const port = Number(process.env.PGPORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'agos',
  password: 'agos',
  port,
  persistent: true,
});

const fresh = !existsSync(dataDir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('agos');

console.log(`PostgreSQL ready: postgres://agos:agos@localhost:${port}/agos`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
