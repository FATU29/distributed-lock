import { randomUUID } from 'node:crypto';

import { FakeServiceTypeRepository } from '../../../test/fakes/fake-service-type.repository';
import { ServiceTypeId } from '../../domain/identifiers/service-type-id.vo';
import {
  ServiceTypeCodeAlreadyExistsError,
  ServiceTypeNotFoundError,
} from '../../domain/service-type/errors';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { ServiceTypesService } from './service-types.service';

describe('ServiceTypesService', () => {
  let repository: FakeServiceTypeRepository;
  let service: ServiceTypesService;

  beforeEach(() => {
    repository = new FakeServiceTypeRepository();
    service = new ServiceTypesService(repository);
  });

  describe('create', () => {
    it('returns a service type with server-assigned id', async () => {
      const row = await service.create({
        code: 'OIL',
        name: 'Oil change',
        durationMinutes: 30,
        requiredSkillTag: null,
      });
      expect(row.code).toBe('OIL');
      expect(row.durationMinutes).toBe(30);
    });

    it('throws ServiceTypeCodeAlreadyExistsError on duplicate code', async () => {
      await service.create({
        code: 'SAME',
        name: 'A',
        durationMinutes: 15,
        requiredSkillTag: null,
      });
      await expect(
        service.create({
          code: 'SAME',
          name: 'B',
          durationMinutes: 20,
          requiredSkillTag: null,
        }),
      ).rejects.toBeInstanceOf(ServiceTypeCodeAlreadyExistsError);
    });
  });

  describe('findById', () => {
    it('throws ServiceTypeNotFoundError when missing', async () => {
      await expect(
        service.findById(ServiceTypeId.from(randomUUID())),
      ).rejects.toBeInstanceOf(ServiceTypeNotFoundError);
    });
  });

  describe('list', () => {
    it('paginates', async () => {
      for (let i = 0; i < 3; i++) {
        await service.create({
          code: `S${i}`,
          name: `N${i}`,
          durationMinutes: 10,
          requiredSkillTag: null,
        });
      }
      const page = await service.list({ limit: 1, offset: 1 });
      expect(page.total).toBe(3);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.code).toBe('S1');
    });
  });

  describe('update', () => {
    it('updates durationMinutes', async () => {
      const created = await service.create({
        code: 'A',
        name: 'N',
        durationMinutes: 10,
        requiredSkillTag: null,
      });
      const updated = await service.update(created.id, {
        durationMinutes: 45,
      });
      expect(updated.durationMinutes).toBe(45);
    });

    it('throws EmptyUpdateError when no fields provided', async () => {
      const created = await service.create({
        code: 'A',
        name: 'N',
        durationMinutes: 10,
        requiredSkillTag: null,
      });
      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws ServiceTypeNotFoundError when missing', async () => {
      await expect(
        service.update(ServiceTypeId.from(randomUUID()), {
          name: 'X',
        }),
      ).rejects.toBeInstanceOf(ServiceTypeNotFoundError);
    });
  });

  describe('delete', () => {
    it('throws ServiceTypeNotFoundError when missing', async () => {
      await expect(
        service.delete(ServiceTypeId.from(randomUUID())),
      ).rejects.toBeInstanceOf(ServiceTypeNotFoundError);
    });
  });
});
