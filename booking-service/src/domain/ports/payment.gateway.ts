import type { CustomerId } from '../identifiers/customer-id.vo';
import type { ServiceTypeId } from '../identifiers/service-type-id.vo';

export type PaymentChargeInput = {
  customerId: CustomerId;
  serviceTypeId: ServiceTypeId;
  idempotencyKey: string;
};

export type PaymentChargeResult = Readonly<{
  reference: string;
}>;

export interface PaymentGateway {
  /**
   * Authorise / capture payment for the booking. Implementations throw
   * {@link PaymentDeclinedError} on a hard decline; transient failures
   * propagate as the underlying error so the use-case bails and the
   * Redlock TTL releases the slot.
   */
  charge(input: PaymentChargeInput): Promise<PaymentChargeResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
