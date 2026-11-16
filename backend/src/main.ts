import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

/** Comma-separated list in CORS_ORIGIN, e.g. http://localhost:8080,http://localhost:8081 */
function resolveCorsOrigin(): string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length === 1) return list[0];
    return list.length ? list : defaultDevOrigins();
  }
  return defaultDevOrigins();
}

function defaultDevOrigins(): string[] {
  return ['http://localhost:8080', 'http://localhost:8081'];
}

async function bootstrap() {
  const uploadsRoot = join(process.cwd(), 'uploads');
  const agreementsDir = join(uploadsRoot, 'agreements');
  const propertyDocsDir = join(uploadsRoot, 'property-documents');
  const paymentReceiptsDir = join(uploadsRoot, 'payment-receipts');
  if (!existsSync(agreementsDir)) {
    mkdirSync(agreementsDir, { recursive: true });
  }
  if (!existsSync(propertyDocsDir)) {
    mkdirSync(propertyDocsDir, { recursive: true });
  }
  if (!existsSync(paymentReceiptsDir)) {
    mkdirSync(paymentReceiptsDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Agreement downloads use the authenticated AgreementFilesController.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
