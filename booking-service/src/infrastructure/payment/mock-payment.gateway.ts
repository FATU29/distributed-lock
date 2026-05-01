import { Injectable, Logger } from '@nestjs/common';

import type {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentGateway,
} from '../../domain/ports';

/**
 * Stand-in payment adapter used while no real PSP is wired up. Always
 * succeeds and echoes a deterministic reference derived from the
 * idempotency key, so retries through the booking use-case stay
 * reference-stable.
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);

  charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    this.logger.log(
      `mock charge customer=${input.customerId.value} service=${input.serviceTypeId.value} key=${input.idempotencyKey}`,
    );
    return Promise.resolve({ reference: `mock_${input.idempotencyKey}` });
  }
}
