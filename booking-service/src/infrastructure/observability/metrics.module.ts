import { Global, Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeHistogramProvider,
  makeCounterProvider,
} from '@willsoto/nestjs-prometheus';

// Metric names — exported so call sites use the constant, not a string literal.
export const M_BOOKING_DURATION = 'booking_confirm_duration_seconds';
export const M_AVAIL_DURATION = 'availability_read_duration_seconds';
export const M_LOCK_ACQUIRE_DURATION = 'redlock_acquire_duration_seconds';
export const M_LOCK_OUTCOME = 'redlock_outcome_total';
export const M_BOOKING_OUTCOME = 'booking_outcome_total';
export const M_CACHE_OUTCOME = 'availability_cache_outcome_total';

// Histogram buckets are SLO-shaped, not log-scale defaults. Buckets straddle
// the p99 target so the resulting histogram_quantile reads cleanly against it.
const providers = [
  makeHistogramProvider({
    name: M_BOOKING_DURATION,
    help: 'End-to-end booking confirm duration. SLO: < 200 ms p99.',
    buckets: [0.025, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1, 2],
    labelNames: ['outcome'],
  }),
  makeHistogramProvider({
    name: M_AVAIL_DURATION,
    help: 'Availability read duration. SLO: hit < 5 ms, miss < 25 ms p99.',
    buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
    labelNames: ['source'], // 'cache' | 'db'
  }),
  makeHistogramProvider({
    name: M_LOCK_ACQUIRE_DURATION,
    help: 'Redlock acquire duration. SLO: uncontended < 50 ms p99.',
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    labelNames: ['contended'], // 'true' | 'false'
  }),
  makeCounterProvider({
    name: M_LOCK_OUTCOME,
    help: 'Redlock acquire/release outcomes.',
    labelNames: ['outcome'], // acquired | quorum_failed | timeout | released | token_mismatch
  }),
  makeCounterProvider({
    name: M_BOOKING_OUTCOME,
    help: 'Terminal outcomes of the booking flow.',
    labelNames: ['outcome'], // confirmed | conflict | lock_failed | validation | error
  }),
  makeCounterProvider({
    name: M_CACHE_OUTCOME,
    help: 'Availability cache hit/miss/error counter.',
    labelNames: ['outcome'], // hit | miss | error
  }),
];

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      defaultLabels: {
        service: 'booking-service',
        env: process.env.NODE_ENV ?? 'development',
      },
    }),
  ],
  providers,
  exports: providers,
})
export class MetricsModule {}
