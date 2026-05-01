import { randomUUID } from 'node:crypto';

import { FakeWorkingHoursRepository } from '../../../test/fakes/fake-working-hours.repository';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import { WorkingHoursId } from '../../domain/identifiers/working-hours-id.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import {
  InvalidWorkingHoursError,
  WorkingHoursAlreadyExistsError,
  WorkingHoursNotFoundError,
} from '../../domain/schedule/errors';
import { WorkingHoursService } from './working-hours.service';

describe('WorkingHoursService', () => {
  let repo: FakeWorkingHoursRepository;
  let service: WorkingHoursService;
  let dealershipId: DealershipId;

  beforeEach(() => {
    repo = new FakeWorkingHoursRepository();
    service = new WorkingHoursService(repo);
    dealershipId = DealershipId.from(randomUUID());
  });

  describe('create', () => {
    it('persists a Mon–Fri 09:00–17:00 row', async () => {
      const wh = await service.create({
        dealershipId,
        dayOfWeek: 1,
        openMinutes: 9 * 60,
        closeMinutes: 17 * 60,
        isClosed: false,
      });
      expect(wh.dayOfWeek).toBe(1);
      expect(wh.openMinutes).toBe(540);
      expect(wh.closeMinutes).toBe(1020);
    });

    it('rejects close <= open when isClosed=false', async () => {
      await expect(
        service.create({
          dealershipId,
          dayOfWeek: 2,
          openMinutes: 600,
          closeMinutes: 600,
          isClosed: false,
        }),
      ).rejects.toBeInstanceOf(InvalidWorkingHoursError);
    });

    it('allows degenerate open=close when isClosed=true (Sunday off)', async () => {
      const wh = await service.create({
        dealershipId,
        dayOfWeek: 0,
        openMinutes: 0,
        closeMinutes: 0,
        isClosed: true,
      });
      expect(wh.isClosed).toBe(true);
    });

    it('throws WorkingHoursAlreadyExistsError on (dealership, day) clash', async () => {
      await service.create({
        dealershipId,
        dayOfWeek: 1,
        openMinutes: 540,
        closeMinutes: 1020,
        isClosed: false,
      });
      await expect(
        service.create({
          dealershipId,
          dayOfWeek: 1,
          openMinutes: 600,
          closeMinutes: 1080,
          isClosed: false,
        }),
      ).rejects.toBeInstanceOf(WorkingHoursAlreadyExistsError);
    });
  });

  describe('list', () => {
    it('returns rows for the dealership ordered by dayOfWeek', async () => {
      await service.create({
        dealershipId,
        dayOfWeek: 3,
        openMinutes: 540,
        closeMinutes: 1020,
        isClosed: false,
      });
      await service.create({
        dealershipId,
        dayOfWeek: 1,
        openMinutes: 540,
        closeMinutes: 1020,
        isClosed: false,
      });
      const rows = await service.list(dealershipId);
      expect(rows.map((r) => r.dayOfWeek)).toEqual([1, 3]);
    });
  });

  describe('update', () => {
    it('changes hours and bumps updatedAt', async () => {
      const created = await service.create({
        dealershipId,
        dayOfWeek: 1,
        openMinutes: 540,
        closeMinutes: 1020,
        isClosed: false,
      });
      const updated = await service.update(created.id, {
        closeMinutes: 1080,
      });
      expect(updated.closeMinutes).toBe(1080);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime(),
      );
    });

    it('throws EmptyUpdateError on empty patch', async () => {
      const created = await service.create({
        dealershipId,
        dayOfWeek: 1,
        openMinutes: 540,
        closeMinutes: 1020,
        isClosed: false,
      });
      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws WorkingHoursNotFoundError when missing', async () => {
      await expect(
        service.update(WorkingHoursId.from(randomUUID()), {
          closeMinutes: 1080,
        }),
      ).rejects.toBeInstanceOf(WorkingHoursNotFoundError);
    });

    it('rejects shrinking the window so close <= open', async () => {
      const created = await service.create({
        dealershipId,
        dayOfWeek: 1,
        openMinutes: 540,
        closeMinutes: 1020,
        isClosed: false,
      });
      await expect(
        service.update(created.id, { closeMinutes: 540 }),
      ).rejects.toBeInstanceOf(InvalidWorkingHoursError);
    });
  });

  describe('delete', () => {
    it('removes the row', async () => {
      const created = await service.create({
        dealershipId,
        dayOfWeek: 1,
        openMinutes: 540,
        closeMinutes: 1020,
        isClosed: false,
      });
      await service.delete(created.id);
      await expect(service.findById(created.id)).rejects.toBeInstanceOf(
        WorkingHoursNotFoundError,
      );
    });

    it('throws WorkingHoursNotFoundError on missing', async () => {
      await expect(
        service.delete(WorkingHoursId.from(randomUUID())),
      ).rejects.toBeInstanceOf(WorkingHoursNotFoundError);
    });
  });
});
