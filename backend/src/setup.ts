import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AUTH_CONFIG, type AuthConfig } from './auth/auth.config';

/**
 * Everything main.ts applies to the app, shared with the e2e tests so they
 * exercise the same configuration as production.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.useWebSocketAdapter(new WsAdapter(app));

  // The dashboard sends its session cookie cross-origin (web :3001 → API
  // :3000), so CORS must name the allowed origins and allow credentials.
  // Mobile and gateways use headers and are unaffected by CORS.
  const auth = app.get<AuthConfig>(AUTH_CONFIG);
  app.enableCors({ origin: auth.webOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return app;
}
