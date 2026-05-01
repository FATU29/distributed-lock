import type {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentGateway,
} from '../../src/domain/ports';

/**
 * Programmable {@link PaymentGateway} fake. Defaults to success;
 * tests flip {@link FakePaymentGateway.failWith} to drive decline /
 * outage paths through the booking use-case.
 */
export class FakePaymentGateway implements PaymentGateway {
  calls: PaymentChargeInput[] = [];
  private nextError: Error | null = null;

  failWith(error: Error): void {
    this.nextError = error;
  }

  charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    this.calls.push(input);
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      return Promise.reject(err);
    }
    return Promise.resolve({ reference: `fake_${input.idempotencyKey}` });
  }
}
