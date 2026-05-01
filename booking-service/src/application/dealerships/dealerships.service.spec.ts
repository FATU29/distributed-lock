import { randomUUID } from 'node:crypto';

import { FakeDealershipRepository } from '../../../test/fakes/fake-dealership.repository';
import {
  DealershipCodeAlreadyExistsError,
  DealershipNotFoundError,
} from '../../domain/dealership/errors';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { DealershipsService } from './dealerships.service';

describe('DealershipsService', () => {
  let repository: FakeDealershipRepository;
  let service: DealershipsService;

  beforeEach(() => {
    repository = new FakeDealershipRepository();
    service = new DealershipsService(repository);
  });

  describe('create', () => {
    it('returns a dealership with server-assigned id', async () => {
      const d = await service.create({ code: 'DLR-A', name: 'Alpha Motors' });
      expect(d.code).toBe('DLR-A');
      expect(d.id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('throws DealershipCodeAlreadyExistsError on duplicate code', async () => {
      await service.create({ code: 'SAME', name: 'One' });
      await expect(
        service.create({ code: 'SAME', name: 'Two' }),
      ).rejects.toBeInstanceOf(DealershipCodeAlreadyExistsError);
    });
  });

  describe('findById', () => {
    it('returns the dealership when present', async () => {
      const created = await service.create({ code: 'A', name: 'N' });
      const found = await service.findById(created.id);
      expect(found.id.value).toBe(created.id.value);
    });

    it('throws DealershipNotFoundError when missing', async () => {
      await expect(
        service.findById(DealershipId.from(randomUUID())),
      ).rejects.toBeInstanceOf(DealershipNotFoundError);
    });
  });

  describe('list', () => {
    it('respects limit, offset, and total', async () => {
      for (let i = 0; i < 4; i++) {
        await service.create({ code: `C${i}`, name: `N${i}` });
      }
      const page = await service.list({ limit: 2, offset: 1 });
      expect(page.total).toBe(4);
      expect(page.items).toHaveLength(2);
      expect(page.items[0]?.code).toBe('C1');
    });
  });

  describe('update', () => {
    it('updates fields', async () => {
      const created = await service.create({ code: 'A', name: 'Old' });
      const updated = await service.update(created.id, { name: 'New' });
      expect(updated.name).toBe('New');
      expect(updated.code).toBe('A');
    });

    it('throws EmptyUpdateError when no fields provided', async () => {
      const created = await service.create({ code: 'A', name: 'N' });
      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws DealershipNotFoundError when missing', async () => {
      const id = DealershipId.from(randomUUID());
      await expect(service.update(id, { name: 'X' })).rejects.toBeInstanceOf(
        DealershipNotFoundError,
      );
    });
  });

  describe('delete', () => {
    it('removes the dealership', async () => {
      const created = await service.create({ code: 'A', name: 'N' });
      await service.delete(created.id);
      await expect(service.findById(created.id)).rejects.toBeInstanceOf(
        DealershipNotFoundError,
      );
    });

    it('throws DealershipNotFoundError when missing', async () => {
      const id = DealershipId.from(randomUUID());
      await expect(service.delete(id)).rejects.toBeInstanceOf(
        DealershipNotFoundError,
      );
    });
  });
});
