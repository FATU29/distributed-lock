import { Module } from '@nestjs/common';
import { LoggingModule } from './logging.module';
import { MetricsModule } from './metrics.module';

// Composite module so the rest of the app imports one thing instead of two.
// Tracing has no NestJS module — the OTel SDK starts in tracing.ts before
// NestFactory.create runs (auto-instrumentations must patch require()s before
// any HTTP / Redis / pg module loads).
@Module({
  imports: [LoggingModule, MetricsModule],
  exports: [LoggingModule, MetricsModule],
})
export class ObservabilityModule {}
