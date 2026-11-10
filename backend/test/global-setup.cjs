// Creates the e2e database (agos_test) on the dev Postgres if it is missing,
// and empties it, so tests never touch the dev data in `agos`.
// Needs the dev database running: `npm run db`.
const { Client } = require('pg');

module.exports = async () => {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://agos:agos@localhost:5433/agos_test');
  const dbName = url.pathname.slice(1);
  const admin = new Client({ connectionString: `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres` });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(`e2e tests need Postgres at ${url.host} (run \`npm run db\`): ${e.message}`);
  }
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  if (tables.rowCount) {
    await db.query(`TRUNCATE ${tables.rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
  }
  await db.end();
};
