import type { DealershipId } from '../identifiers/dealership-id.vo';
import type { WorkingHoursId } from '../identifiers/working-hours-id.vo';
import type { DayOfWeek } from './day-of-week.vo';

export class WorkingHours {
  constructor(
    readonly id: WorkingHoursId,
    readonly dealershipId: DealershipId,
    readonly dayOfWeek: DayOfWeek,
    readonly openMinutes: number,
    readonly closeMinutes: number,
    readonly isClosed: boolean,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
