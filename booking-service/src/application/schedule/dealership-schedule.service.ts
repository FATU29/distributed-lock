import { Inject, Injectable } from '@nestjs/common';

import type { SlotWindow } from '../../domain/appointment/slot-window.vo';
import type { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import type {
  HolidayRepository,
  WorkingHoursRepository,
} from '../../domain/ports';
import {
  HOLIDAY_REPOSITORY,
  WORKING_HOURS_REPOSITORY,
} from '../../domain/ports';
import { assertDayOfWeek } from '../../domain/schedule/day-of-week.vo';
import {
  DealershipClosedOnHolidayError,
  OutsideWorkingHoursError,
} from '../../domain/schedule/errors';
import { utcMinuteOfDay } from '../../domain/schedule/minute-of-day.vo';

export type DayAvailability = {
  dealershipId: string;
  date: string; // YYYY-MM-DD (UTC)
  isOpen: boolean;
  reason: 'OPEN' | 'CLOSED_DAY' | 'HOLIDAY' | 'NO_SCHEDULE';
  openMinutes: number | null;
  closeMinutes: number | null;
  holidayName: string | null;
};

@Injectable()
export class DealershipScheduleService {
  constructor(
    @Inject(WORKING_HOURS_REPOSITORY)
    private readonly workingHours: WorkingHoursRepository,
    @Inject(HOLIDAY_REPOSITORY)
    private readonly holidays: HolidayRepository,
  ) {}

  /**
   * Validates that the requested slot fits within the dealership's
   * weekly working hours and that the start/end day is not on any
   * configured holiday. Throws domain errors on violation; returns
   * normally on success.
   */
  async assertSlotIsBookable(
    dealershipId: DealershipId,
    slot: SlotWindow,
  ): Promise<void> {
    if (!sameUtcDay(slot.start, slot.end)) {
      throw new OutsideWorkingHoursError(
        'Booking window must start and end on the same UTC calendar day',
      );
    }
    await this.assertNotHoliday(dealershipId, slot.start);
    await this.assertWithinHours(dealershipId, slot);
  }

  async getDayAvailability(
    dealershipId: DealershipId,
    target: Date,
  ): Promise<DayAvailability> {
    const day = startOfUtcDay(target);
    const isoDate = day.toISOString().slice(0, 10);

    const matchingHoliday = (
      await this.holidays.listAllForDealership(dealershipId)
    ).find((h) => h.matches(day));
    if (matchingHoliday) {
      return {
        dealershipId: dealershipId.value,
        date: isoDate,
        isOpen: false,
        reason: 'HOLIDAY',
        openMinutes: null,
        closeMinutes: null,
        holidayName: matchingHoliday.name,
      };
    }

    const dayOfWeek = assertDayOfWeek(day.getUTCDay());
    const wh = await this.workingHours.findForDealershipDay(
      dealershipId,
      dayOfWeek,
    );
    if (!wh) {
      return {
        dealershipId: dealershipId.value,
        date: isoDate,
        isOpen: false,
        reason: 'NO_SCHEDULE',
        openMinutes: null,
        closeMinutes: null,
        holidayName: null,
      };
    }
    if (wh.isClosed) {
      return {
        dealershipId: dealershipId.value,
        date: isoDate,
        isOpen: false,
        reason: 'CLOSED_DAY',
        openMinutes: wh.openMinutes,
        closeMinutes: wh.closeMinutes,
        holidayName: null,
      };
    }
    return {
      dealershipId: dealershipId.value,
      date: isoDate,
      isOpen: true,
      reason: 'OPEN',
      openMinutes: wh.openMinutes,
      closeMinutes: wh.closeMinutes,
      holidayName: null,
    };
  }

  private async assertNotHoliday(
    dealershipId: DealershipId,
    target: Date,
  ): Promise<void> {
    const matching = (
      await this.holidays.listAllForDealership(dealershipId)
    ).find((h) => h.matches(target));
    if (matching) {
      throw new DealershipClosedOnHolidayError(
        `Dealership is closed for holiday "${matching.name}" on ${target
          .toISOString()
          .slice(0, 10)}`,
      );
    }
  }

  private async assertWithinHours(
    dealershipId: DealershipId,
    slot: SlotWindow,
  ): Promise<void> {
    const dayOfWeek = assertDayOfWeek(slot.start.getUTCDay());
    const wh = await this.workingHours.findForDealershipDay(
      dealershipId,
      dayOfWeek,
    );
    if (!wh) {
      throw new OutsideWorkingHoursError(
        `No working hours configured for dealership=${dealershipId.value} day=${dayOfWeek}`,
      );
    }
    if (wh.isClosed) {
      throw new OutsideWorkingHoursError(
        `Dealership is closed on day=${dayOfWeek}`,
      );
    }
    const startMin = utcMinuteOfDay(slot.start);
    const endMin = utcMinuteOfDay(slot.end);
    const endMinNormalised = endMin === 0 ? 24 * 60 : endMin;
    if (startMin < wh.openMinutes || endMinNormalised > wh.closeMinutes) {
      throw new OutsideWorkingHoursError(
        `Slot ${minutesToHHMM(startMin)}–${minutesToHHMM(endMin)} falls outside working hours ${minutesToHHMM(wh.openMinutes)}–${minutesToHHMM(wh.closeMinutes)}`,
      );
    }
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
