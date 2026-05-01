import type { Holiday as HolidayRow } from '@prisma/client';

import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { HolidayId } from '../../../domain/identifiers/holiday-id.vo';
import { Holiday } from '../../../domain/schedule/holiday.entity';

export function mapHolidayRowToDomain(row: HolidayRow): Holiday {
  return new Holiday(
    HolidayId.from(row.id),
    DealershipId.from(row.dealershipId),
    row.date,
    row.name,
    row.isRecurring,
    row.createdAt,
    row.updatedAt,
  );
}
