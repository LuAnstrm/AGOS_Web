// Runs before each e2e test file: point the app at the throwaway test
// database and an unreachable ML service (tests stub ML where they need it).
const base = process.env.TEST_DATABASE_URL ?? 'postgres://agos:agos@localhost:5433/agos_test';
process.env.DATABASE_URL = base;
process.env.DB_SYNC = 'true';
process.env.ML_URL = 'http://127.0.0.1:9';
process.env.ML_TIMEOUT_MS = '200';
process.env.NODE_ENV = 'test';
process.env.PUSH_ENABLED = 'false';
