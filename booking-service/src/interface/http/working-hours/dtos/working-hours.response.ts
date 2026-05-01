import { DAY_LABELS } from '../../../../domain/schedule/day-of-week.vo';
import type { WorkingHours } from '../../../../domain/schedule/working-hours.entity';

export type WorkingHoursResponse = {
  id: string;
  dealershipId: string;
  dayOfWeek: number;
  dayLabel: string;
  openMinutes: number;
  closeMinutes: number;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toWorkingHoursResponse(wh: WorkingHours): WorkingHoursResponse {
  return {
    id: wh.id.value,
    dealershipId: wh.dealershipId.value,
    dayOfWeek: wh.dayOfWeek,
    dayLabel: DAY_LABELS[wh.dayOfWeek],
    openMinutes: wh.openMinutes,
    closeMinutes: wh.closeMinutes,
    isClosed: wh.isClosed,
    createdAt: wh.createdAt.toISOString(),
    updatedAt: wh.updatedAt.toISOString(),
  };
}
