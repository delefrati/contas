import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { readJwtSecret } from './auth/jwt-secret';
import { trustCaddy } from './common/sign-in-throttle';
import { validateRequests } from './common/request-validation';

async function bootstrap() {
  // Checked before anything starts, so a bad secret stops the backend with one clear line
  try {
    readJwtSecret();
  } catch (error) {
    console.error(`❌ ${(error as Error).message}`);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  trustCaddy(app);
  validateRequests(app);
  
  // In production the frontend calls the API on the same host (<band>.<BASE_DOMAIN>/api),
  // so CORS is only needed when CORS_ORIGIN is set (local development).
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  if (allowedOrigins?.length) {
    app.enableCors({ origin: allowedOrigins, credentials: true });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`✅ Application is running on: http://localhost:${port}`);
}

bootstrap();
