import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { context, trace } from '@opentelemetry/api';
import type { IncomingMessage, ServerResponse } from 'http';

const isProd = process.env.NODE_ENV === 'production';

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),

        // Honour upstream X-Request-Id (LB / gateway). Generate one when absent
        // so every log line in a request is correlated even without a gateway.
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const existing = req.headers['x-request-id'];
          const id =
            (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },

        // JSON in prod (cheap to ship + index). Pretty in dev (human-readable).
        transport: isProd
          ? undefined
          : {
              target: 'pino-pretty',
              options: { singleLine: true, colorize: true },
            },

        // Stamp every log line with the active span's trace_id/span_id so logs
        // and traces join in the backend without a separate correlation hop.
        mixin() {
          const span = trace.getSpan(context.active());
          if (!span) return {};
          const sc = span.spanContext();
          return { trace_id: sc.traceId, span_id: sc.spanId };
        },

        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
      },
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
