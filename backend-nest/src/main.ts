import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
