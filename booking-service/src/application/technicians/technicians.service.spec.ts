import { randomUUID } from 'node:crypto';

import { FakeTechnicianRepository } from '../../../test/fakes/fake-technician.repository';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import { ServiceTypeId } from '../../domain/identifiers/service-type-id.vo';
import { TechnicianId } from '../../domain/identifiers/technician-id.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { TechnicianNotFoundError } from '../../domain/technician/errors';
import { TechniciansService } from './technicians.service';

describe('TechniciansService', () => {
  let repository: FakeTechnicianRepository;
  let service: TechniciansService;
  let dealershipId: DealershipId;
  let serviceTypeId: ServiceTypeId;

  beforeEach(() => {
    repository = new FakeTechnicianRepository();
    service = new TechniciansService(repository);
    dealershipId = DealershipId.from(randomUUID());
    serviceTypeId = ServiceTypeId.from(randomUUID());
  });

  describe('create', () => {
    it('creates a technician with qualifications', async () => {
      const t = await service.create({
        dealershipId,
        name: 'Alex',
        qualifiedServiceTypeIds: [serviceTypeId],
      });
      expect(t.name).toBe('Alex');
      expect(t.qualifiedServiceTypeIds).toHaveLength(1);
      expect(t.qualifiedServiceTypeIds[0]?.value).toBe(serviceTypeId.value);
    });
  });

  describe('findById', () => {
    it('throws TechnicianNotFoundError when missing', async () => {
      await expect(
        service.findById(TechnicianId.from(randomUUID())),
      ).rejects.toBeInstanceOf(TechnicianNotFoundError);
    });
  });

  describe('list', () => {
    it('filters by dealershipId', async () => {
      const d1 = DealershipId.from(randomUUID());
      const st = ServiceTypeId.from(randomUUID());
      await service.create({
        dealershipId: d1,
        name: 'T1',
        qualifiedServiceTypeIds: [st],
      });
      await service.create({
        dealershipId: DealershipId.from(randomUUID()),
        name: 'T2',
        qualifiedServiceTypeIds: [st],
      });
      const page = await service.list({
        limit: 20,
        offset: 0,
        dealershipId: d1,
      });
      expect(page.total).toBe(1);
      expect(page.items[0]?.name).toBe('T1');
    });
  });

  describe('update', () => {
    it('replaces qualifiedServiceTypeIds when provided', async () => {
      const st2 = ServiceTypeId.from(randomUUID());
      const created = await service.create({
        dealershipId,
        name: 'Pat',
        qualifiedServiceTypeIds: [serviceTypeId],
      });
      const updated = await service.update(created.id, {
        qualifiedServiceTypeIds: [st2],
      });
      expect(updated.qualifiedServiceTypeIds).toHaveLength(1);
      expect(updated.qualifiedServiceTypeIds[0]?.value).toBe(st2.value);
    });

    it('throws EmptyUpdateError when no fields provided', async () => {
      const created = await service.create({
        dealershipId,
        name: 'Pat',
        qualifiedServiceTypeIds: [serviceTypeId],
      });
      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws TechnicianNotFoundError when missing', async () => {
      await expect(
        service.update(TechnicianId.from(randomUUID()), { name: 'Z' }),
      ).rejects.toBeInstanceOf(TechnicianNotFoundError);
    });
  });

  describe('delete', () => {
    it('throws TechnicianNotFoundError when missing', async () => {
      await expect(
        service.delete(TechnicianId.from(randomUUID())),
      ).rejects.toBeInstanceOf(TechnicianNotFoundError);
    });
  });
});
