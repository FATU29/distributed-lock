import { randomUUID } from 'node:crypto';

import { FakeHolidayRepository } from '../../../test/fakes/fake-holiday.repository';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import { HolidayId } from '../../domain/identifiers/holiday-id.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import {
  HolidayAlreadyExistsError,
  HolidayNotFoundError,
} from '../../domain/schedule/errors';
import { HolidaysService } from './holidays.service';

describe('HolidaysService', () => {
  let repo: FakeHolidayRepository;
  let service: HolidaysService;
  let dealershipId: DealershipId;

  beforeEach(() => {
    repo = new FakeHolidayRepository();
    service = new HolidaysService(repo);
    dealershipId = DealershipId.from(randomUUID());
  });

  describe('create', () => {
    it('stores a fixed-date holiday at UTC midnight', async () => {
      const h = await service.create({
        dealershipId,
        date: new Date('2026-04-30T08:00:00.000Z'),
        name: 'Reunification Day',
        isRecurring: false,
      });
      expect(h.name).toBe('Reunification Day');
      expect(h.date.toISOString()).toBe('2026-04-30T00:00:00.000Z');
    });

    it('stores a recurring annual holiday', async () => {
      const h = await service.create({
        dealershipId,
        date: new Date('2000-01-01T00:00:00.000Z'),
        name: "New Year's Day",
        isRecurring: true,
      });
      expect(h.isRecurring).toBe(true);
    });

    it('throws HolidayAlreadyExistsError on (dealership, date, isRecurring) clash', async () => {
      await service.create({
        dealershipId,
        date: new Date('2026-04-30T00:00:00.000Z'),
        name: 'Reunification Day',
        isRecurring: false,
      });
      await expect(
        service.create({
          dealershipId,
          date: new Date('2026-04-30T15:00:00.000Z'),
          name: 'Reunification Day (dup)',
          isRecurring: false,
        }),
      ).rejects.toBeInstanceOf(HolidayAlreadyExistsError);
    });
  });

  describe('list', () => {
    it('paginates with total', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({
          dealershipId,
          date: new Date(`2026-0${(i % 9) + 1}-15T00:00:00.000Z`),
          name: `H${i}`,
          isRecurring: false,
        });
      }
      const page = await service.list({
        dealershipId,
        limit: 2,
        offset: 1,
      });
      expect(page.total).toBe(5);
      expect(page.items).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('renames a holiday and bumps updatedAt', async () => {
      const created = await service.create({
        dealershipId,
        date: new Date('2026-04-30T00:00:00.000Z'),
        name: 'Reunification',
        isRecurring: false,
      });
      const updated = await service.update(created.id, {
        name: 'Reunification Day',
      });
      expect(updated.name).toBe('Reunification Day');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime(),
      );
    });

    it('throws EmptyUpdateError on empty patch', async () => {
      const created = await service.create({
        dealershipId,
        date: new Date('2026-04-30T00:00:00.000Z'),
        name: 'Reunification',
        isRecurring: false,
      });
      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws HolidayNotFoundError when missing', async () => {
      await expect(
        service.update(HolidayId.from(randomUUID()), { name: 'x' }),
      ).rejects.toBeInstanceOf(HolidayNotFoundError);
    });
  });

  describe('delete', () => {
    it('removes the holiday', async () => {
      const created = await service.create({
        dealershipId,
        date: new Date('2026-04-30T00:00:00.000Z'),
        name: 'Reunification',
        isRecurring: false,
      });
      await service.delete(created.id);
      await expect(service.findById(created.id)).rejects.toBeInstanceOf(
        HolidayNotFoundError,
      );
    });

    it('throws HolidayNotFoundError on missing', async () => {
      await expect(
        service.delete(HolidayId.from(randomUUID())),
      ).rejects.toBeInstanceOf(HolidayNotFoundError);
    });
  });
});
