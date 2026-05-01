import type { ServiceType as ServiceTypeRow } from '@prisma/client';

import { ServiceTypeId } from '../../../domain/identifiers/service-type-id.vo';
import { ServiceTypeSpec } from '../../../domain/service-type/service-type-spec.vo';

export function mapServiceTypeRowToSpec(row: ServiceTypeRow): ServiceTypeSpec {
  return new ServiceTypeSpec(
    ServiceTypeId.from(row.id),
    row.code,
    row.name,
    row.durationMinutes,
    row.requiredSkillTag,
    row.createdAt,
    row.updatedAt,
  );
}
