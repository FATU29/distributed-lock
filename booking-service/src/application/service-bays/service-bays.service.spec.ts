import { randomUUID } from 'node:crypto';

import { FakeServiceBayRepository } from '../../../test/fakes/fake-service-bay.repository';
import { BayId } from '../../domain/identifiers/bay-id.vo';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { ServiceBayNotFoundError } from '../../domain/service-bay/errors';
import { ServiceBaysService } from './service-bays.service';

describe('ServiceBaysService', () => {
  let repository: FakeServiceBayRepository;
  let service: ServiceBaysService;
  let dealershipId: DealershipId;

  beforeEach(() => {
    repository = new FakeServiceBayRepository();
    service = new ServiceBaysService(repository);
    dealershipId = DealershipId.from(randomUUID());
  });

  describe('create', () => {
    it('creates a bay', async () => {
      const bay = await service.create({
        dealershipId,
        label: 'Bay 1',
      });
      expect(bay.label).toBe('Bay 1');
      expect(bay.dealershipId.value).toBe(dealershipId.value);
    });
  });

  describe('findById', () => {
    it('throws ServiceBayNotFoundError when missing', async () => {
      await expect(
        service.findById(BayId.from(randomUUID())),
      ).rejects.toBeInstanceOf(ServiceBayNotFoundError);
    });
  });

  describe('list', () => {
    it('filters by dealershipId', async () => {
      const d1 = DealershipId.from(randomUUID());
      const d2 = DealershipId.from(randomUUID());
      await service.create({ dealershipId: d1, label: 'A' });
      await service.create({ dealershipId: d2, label: 'B' });
      const page = await service.list({
        limit: 20,
        offset: 0,
        dealershipId: d1,
      });
      expect(page.total).toBe(1);
      expect(page.items[0]?.label).toBe('A');
    });
  });

  describe('update', () => {
    it('updates label', async () => {
      const created = await service.create({
        dealershipId,
        label: 'Old',
      });
      const updated = await service.update(created.id, { label: 'New' });
      expect(updated.label).toBe('New');
    });

    it('throws EmptyUpdateError when no fields provided', async () => {
      const created = await service.create({
        dealershipId,
        label: 'X',
      });
      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws ServiceBayNotFoundError when missing', async () => {
      await expect(
        service.update(BayId.from(randomUUID()), { label: 'Z' }),
      ).rejects.toBeInstanceOf(ServiceBayNotFoundError);
    });
  });

  describe('delete', () => {
    it('throws ServiceBayNotFoundError when missing', async () => {
      await expect(
        service.delete(BayId.from(randomUUID())),
      ).rejects.toBeInstanceOf(ServiceBayNotFoundError);
    });
  });
});
