import { CustomerId } from '../identifiers/customer-id.vo';
import { UserId } from '../identifiers/user-id.vo';

export class Customer {
  constructor(
    readonly id: CustomerId,
    readonly userId: UserId,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
