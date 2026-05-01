import type { ServiceBay as ServiceBayRow } from '@prisma/client';

import { BayId } from '../../../domain/identifiers/bay-id.vo';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { ServiceBay } from '../../../domain/service-bay/service-bay.entity';

export function mapServiceBayRowToDomain(row: ServiceBayRow): ServiceBay {
  return new ServiceBay(
    BayId.from(row.id),
    DealershipId.from(row.dealershipId),
    row.label,
    row.createdAt,
    row.updatedAt,
  );
}
