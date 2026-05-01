import type { Prisma } from '@prisma/client';

import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { ServiceTypeId } from '../../../domain/identifiers/service-type-id.vo';
import { TechnicianId } from '../../../domain/identifiers/technician-id.vo';
import { Technician } from '../../../domain/technician/technician.entity';

export type TechnicianWithQualifications = Prisma.TechnicianGetPayload<{
  include: { qualifiedServices: true };
}>;

export function mapTechnicianRowToDomain(
  row: TechnicianWithQualifications,
): Technician {
  const qualifiedServiceTypeIds = row.qualifiedServices.map((link) =>
    ServiceTypeId.from(link.serviceTypeId),
  );
  return new Technician(
    TechnicianId.from(row.id),
    DealershipId.from(row.dealershipId),
    row.name,
    qualifiedServiceTypeIds,
    row.createdAt,
    row.updatedAt,
  );
}
