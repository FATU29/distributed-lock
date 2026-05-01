import 'dotenv/config';

// OTel SDK must initialise before any module being instrumented loads.
// Keep tracing immediately after env load — NestJS, Express, ioredis, pg etc.
// pull in HTTP/redis/pg modules eagerly via require(), and the
// auto-instrumentations only patch them if they are loaded after the SDK starts.
import './infrastructure/observability/tracing';

/* eslint-disable @typescript-eslint/no-floating-promises */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './interface/http/filters/domain-error.filter';

async function bootstrap() {
  // bufferLogs lets nestjs-pino swallow the framework's own boot logs and
  // re-emit them through pino once the logger is available — otherwise the
  // first ~10 lines of every boot are stderr console.log noise.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainErrorFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
