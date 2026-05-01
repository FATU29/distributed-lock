import { randomUUID } from 'node:crypto';

import { FakeVehicleRepository } from '../../../test/fakes/fake-vehicle.repository';
import { CustomerId } from '../../domain/identifiers/customer-id.vo';
import { VehicleId } from '../../domain/identifiers/vehicle-id.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import {
  VehicleNotFoundError,
  VehicleVinAlreadyExistsError,
} from '../../domain/vehicle/errors';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  let repository: FakeVehicleRepository;
  let service: VehiclesService;
  let customerId: CustomerId;

  beforeEach(() => {
    repository = new FakeVehicleRepository();
    service = new VehiclesService(repository);
    customerId = CustomerId.from(randomUUID());
  });

  describe('create', () => {
    it('creates a vehicle with normalized VIN', async () => {
      const v = await service.create({
        customerId,
        vin: '  ABCDE  ',
        label: 'Civic',
      });
      expect(v.vin.value).toBe('ABCDE');
    });

    it('throws VehicleVinAlreadyExistsError on duplicate VIN', async () => {
      await service.create({
        customerId,
        vin: 'VINDUP',
        label: null,
      });
      await expect(
        service.create({
          customerId,
          vin: 'VINDUP',
          label: null,
        }),
      ).rejects.toBeInstanceOf(VehicleVinAlreadyExistsError);
    });
  });

  describe('findById', () => {
    it('throws VehicleNotFoundError when missing', async () => {
      await expect(
        service.findById(VehicleId.from(randomUUID())),
      ).rejects.toBeInstanceOf(VehicleNotFoundError);
    });
  });

  describe('list', () => {
    it('filters by customerId', async () => {
      const c1 = CustomerId.from(randomUUID());
      const c2 = CustomerId.from(randomUUID());
      await service.create({ customerId: c1, vin: 'VINAA', label: null });
      await service.create({ customerId: c2, vin: 'VINBB', label: null });
      const page = await service.list({
        limit: 20,
        offset: 0,
        customerId: c1,
      });
      expect(page.total).toBe(1);
      expect(page.items[0]?.vin.value).toBe('VINAA');
    });
  });

  describe('update', () => {
    it('updates label', async () => {
      const created = await service.create({
        customerId,
        vin: 'VINXX',
        label: 'Old',
      });
      const updated = await service.update(created.id, { label: 'New' });
      expect(updated.label).toBe('New');
    });

    it('throws EmptyUpdateError when no fields provided', async () => {
      const created = await service.create({
        customerId,
        vin: 'VINYY',
        label: null,
      });
      await expect(service.update(created.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws VehicleNotFoundError when missing', async () => {
      await expect(
        service.update(VehicleId.from(randomUUID()), { label: 'Z' }),
      ).rejects.toBeInstanceOf(VehicleNotFoundError);
    });
  });

  describe('delete', () => {
    it('throws VehicleNotFoundError when missing', async () => {
      await expect(
        service.delete(VehicleId.from(randomUUID())),
      ).rejects.toBeInstanceOf(VehicleNotFoundError);
    });
  });
});
