import type { WorkingHours as WorkingHoursRow } from '@prisma/client';

import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { WorkingHoursId } from '../../../domain/identifiers/working-hours-id.vo';
import { assertDayOfWeek } from '../../../domain/schedule/day-of-week.vo';
import { WorkingHours } from '../../../domain/schedule/working-hours.entity';

export function mapWorkingHoursRowToDomain(row: WorkingHoursRow): WorkingHours {
  return new WorkingHours(
    WorkingHoursId.from(row.id),
    DealershipId.from(row.dealershipId),
    assertDayOfWeek(row.dayOfWeek),
    row.openMinutes,
    row.closeMinutes,
    row.isClosed,
    row.createdAt,
    row.updatedAt,
  );
}
