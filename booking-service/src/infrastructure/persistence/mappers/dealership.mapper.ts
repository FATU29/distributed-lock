import type { Dealership as DealershipRow } from '@prisma/client';

import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { Dealership } from '../../../domain/dealership/dealership.entity';

export function mapDealershipRowToDomain(row: DealershipRow): Dealership {
  return new Dealership(
    DealershipId.from(row.id),
    row.code,
    row.name,
    row.createdAt,
    row.updatedAt,
  );
}
