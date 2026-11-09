import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { AUTH_CONFIG, type AuthConfig } from './auth/auth.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
