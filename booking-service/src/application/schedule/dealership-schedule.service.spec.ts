import { randomUUID } from 'node:crypto';

import { FakeHolidayRepository } from '../../../test/fakes/fake-holiday.repository';
import { FakeWorkingHoursRepository } from '../../../test/fakes/fake-working-hours.repository';
import { SlotWindow } from '../../domain/appointment/slot-window.vo';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import {
  DealershipClosedOnHolidayError,
  OutsideWorkingHoursError,
} from '../../domain/schedule/errors';
import { DealershipScheduleService } from './dealership-schedule.service';

const MON_9 = new Date('2026-06-01T09:00:00.000Z'); // 2026-06-01 is Monday (UTC)
const MON_10 = new Date('2026-06-01T10:00:00.000Z');
const MON_17 = new Date('2026-06-01T17:00:00.000Z');
const MON_18 = new Date('2026-06-01T18:00:00.000Z');
const SUN_10 = new Date('2026-05-31T10:00:00.000Z'); // 2026-05-31 is Sunday
const NEW_YEAR_2026 = new Date('2026-01-01T10:00:00.000Z');

describe('DealershipScheduleService', () => {
  let workingHours: FakeWorkingHoursRepository;
  let holidays: FakeHolidayRepository;
  let service: DealershipScheduleService;
  let dealershipId: DealershipId;

  beforeEach(async () => {
    workingHours = new FakeWorkingHoursRepository();
    holidays = new FakeHolidayRepository();
    service = new DealershipScheduleService(workingHours, holidays);
    dealershipId = DealershipId.from(randomUUID());

    // Seed Mon–Sat 09:00–17:00; Sunday closed.
    for (const dow of [1, 2, 3, 4, 5, 6] as const) {
      await workingHours.create({
        dealershipId,
        dayOfWeek: dow,
        openMinutes: 9 * 60,
        closeMinutes: 17 * 60,
        isClosed: false,
      });
    }
    await workingHours.create({
      dealershipId,
      dayOfWeek: 0,
      openMinutes: 0,
      closeMinutes: 0,
      isClosed: true,
    });
  });

  describe('assertSlotIsBookable', () => {
    it('passes for a Mon 10:00–11:00 slot inside hours', async () => {
      await expect(
        service.assertSlotIsBookable(
          dealershipId,
          SlotWindow.fromStartEnd(MON_10, new Date('2026-06-01T11:00:00.000Z')),
        ),
      ).resolves.toBeUndefined();
    });

    it('throws OutsideWorkingHoursError on Sunday (closed day)', async () => {
      await expect(
        service.assertSlotIsBookable(
          dealershipId,
          SlotWindow.fromStartEnd(SUN_10, new Date('2026-05-31T11:00:00.000Z')),
        ),
      ).rejects.toBeInstanceOf(OutsideWorkingHoursError);
    });

    it('throws OutsideWorkingHoursError on Mon 08:00 (before open)', async () => {
      await expect(
        service.assertSlotIsBookable(
          dealershipId,
          SlotWindow.fromStartEnd(new Date('2026-06-01T08:00:00.000Z'), MON_9),
        ),
      ).rejects.toBeInstanceOf(OutsideWorkingHoursError);
    });

    it('throws OutsideWorkingHoursError on Mon 17:00–18:00 (after close)', async () => {
      await expect(
        service.assertSlotIsBookable(
          dealershipId,
          SlotWindow.fromStartEnd(MON_17, MON_18),
        ),
      ).rejects.toBeInstanceOf(OutsideWorkingHoursError);
    });

    it('throws OutsideWorkingHoursError when the slot crosses a UTC day boundary', async () => {
      await expect(
        service.assertSlotIsBookable(
          dealershipId,
          SlotWindow.fromStartEnd(
            new Date('2026-06-01T23:00:00.000Z'),
            new Date('2026-06-02T01:00:00.000Z'),
          ),
        ),
      ).rejects.toBeInstanceOf(OutsideWorkingHoursError);
    });

    it('throws DealershipClosedOnHolidayError when the day matches a fixed holiday', async () => {
      await holidays.create({
        dealershipId,
        date: new Date('2026-06-01T00:00:00.000Z'),
        name: 'Reunification Day',
        isRecurring: false,
      });
      await expect(
        service.assertSlotIsBookable(
          dealershipId,
          SlotWindow.fromStartEnd(MON_10, new Date('2026-06-01T11:00:00.000Z')),
        ),
      ).rejects.toBeInstanceOf(DealershipClosedOnHolidayError);
    });

    it('throws DealershipClosedOnHolidayError on a recurring annual match', async () => {
      await holidays.create({
        dealershipId,
        date: new Date('2000-01-01T00:00:00.000Z'),
        name: "New Year's Day",
        isRecurring: true,
      });
      // Add Thursday hours since 2026-01-01 is a Thursday.
      await workingHours
        .update(
          (await workingHours.listForDealership(dealershipId)).find(
            (w) => w.dayOfWeek === 4,
          )!.id,
          {},
        )
        .catch(() => undefined);

      await expect(
        service.assertSlotIsBookable(
          dealershipId,
          SlotWindow.fromStartEnd(
            NEW_YEAR_2026,
            new Date('2026-01-01T11:00:00.000Z'),
          ),
        ),
      ).rejects.toBeInstanceOf(DealershipClosedOnHolidayError);
    });
  });

  describe('getDayAvailability', () => {
    it('reports OPEN on a normal weekday', async () => {
      const a = await service.getDayAvailability(dealershipId, MON_10);
      expect(a.isOpen).toBe(true);
      expect(a.reason).toBe('OPEN');
      expect(a.openMinutes).toBe(540);
      expect(a.closeMinutes).toBe(1020);
    });

    it('reports CLOSED_DAY on Sunday', async () => {
      const a = await service.getDayAvailability(dealershipId, SUN_10);
      expect(a.isOpen).toBe(false);
      expect(a.reason).toBe('CLOSED_DAY');
    });

    it('reports HOLIDAY when a recurring annual holiday matches', async () => {
      await holidays.create({
        dealershipId,
        date: new Date('2000-01-01T00:00:00.000Z'),
        name: "New Year's Day",
        isRecurring: true,
      });
      const a = await service.getDayAvailability(dealershipId, NEW_YEAR_2026);
      expect(a.isOpen).toBe(false);
      expect(a.reason).toBe('HOLIDAY');
      expect(a.holidayName).toBe("New Year's Day");
    });

    it('reports NO_SCHEDULE when the day has no working-hours row', async () => {
      const orphan = DealershipId.from(randomUUID());
      const a = await service.getDayAvailability(orphan, MON_10);
      expect(a.isOpen).toBe(false);
      expect(a.reason).toBe('NO_SCHEDULE');
    });
  });
});
