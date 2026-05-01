// OpenTelemetry SDK bootstrap. MUST be imported before any module being
// instrumented (Express, ioredis, pg, …) — auto-instrumentations patch modules
// at require time. main.ts therefore imports this file first, before NestJS.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

if (process.env.OTEL_DEBUG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'booking-service',
    [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? 'dev',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // fs spans dominate traces with no useful signal.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Prisma is instrumented separately via @prisma/instrumentation once
      // the schema lands and `previewFeatures = ["tracing"]` is enabled —
      // pg auto-instrumentation does not see Prisma's rust query engine.
    }),
  ],
});

sdk.start();

const shutdown = () => {
  sdk
    .shutdown()
    .catch((err: unknown) => console.error('OTel shutdown failed', err))
    .finally(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
