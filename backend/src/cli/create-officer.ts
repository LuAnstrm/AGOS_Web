/**
 * Creates a DRRMO officer account. Officers can't sign up through the API.
 *
 *   npm run create-officer -- --email officer@example.ph --name "Juan Dela Cruz"
 *
 * The password is read from AGOS_OFFICER_PASSWORD if set; otherwise a strong
 * random one is generated and printed once — hand it over securely and have
 * the officer keep it safe.
 */
import { NestFactory } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { MIN_PASSWORD_LENGTH } from '../auth/password';
import { UserRole } from '../database/enums';

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      locale: { type: 'string', default: 'fil' },
    },
  });
  if (!values.email || !values.name) {
    console.error(
      'usage: create-officer --email <email> --name "<display name>" [--locale en|fil]',
    );
    process.exit(2);
  }
  const given = process.env.AGOS_OFFICER_PASSWORD;
  if (given && given.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `AGOS_OFFICER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
    process.exit(2);
  }
  const password = given ?? randomBytes(15).toString('base64url');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const user = await app.get(AuthService).createUser({
      email: values.email,
      password,
      displayName: values.name,
      role: UserRole.OFFICER,
      locale: values.locale === 'en' ? 'en' : 'fil',
    });
    console.log(`officer created: ${user.displayName} <${user.email}>`);
    if (!given) console.log(`password (shown once): ${password}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
