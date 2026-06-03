import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const allowedOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    allowedOrigin
      ? { origin: allowedOrigin, credentials: true }
      : { origin: true, credentials: true },
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`✅ Application is running on: http://localhost:${port}`);
}

bootstrap();
