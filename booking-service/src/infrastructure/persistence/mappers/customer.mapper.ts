import type { Customer as CustomerRow } from '@prisma/client';

import { Customer } from '../../../domain/customer/customer.entity';
import { CustomerId } from '../../../domain/identifiers/customer-id.vo';
import { UserId } from '../../../domain/identifiers/user-id.vo';

export function mapCustomerRowToDomain(row: CustomerRow): Customer {
  return new Customer(
    CustomerId.from(row.id),
    UserId.from(row.userId),
    row.createdAt,
    row.updatedAt,
  );
}
