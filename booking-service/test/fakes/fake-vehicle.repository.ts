import { randomUUID } from 'node:crypto';

import { VehicleId } from '../../src/domain/identifiers/vehicle-id.vo';
import { Vin } from '../../src/domain/identifiers/vin.vo';
import type {
  CreateVehicleInput,
  ListVehiclesQuery,
  UpdateVehicleInput,
  VehiclePage,
  VehicleRepository,
} from '../../src/domain/ports';
import {
  VehicleNotFoundError,
  VehicleVinAlreadyExistsError,
} from '../../src/domain/vehicle/errors';
import { Vehicle } from '../../src/domain/vehicle/vehicle.entity';

export class FakeVehicleRepository implements VehicleRepository {
  private readonly items = new Map<string, Vehicle>();
  private readonly vinIndex = new Map<string, string>();
  private nextCreatedAt = Date.parse('2026-01-01T00:00:00.000Z');

  findById(id: VehicleId): Promise<Vehicle | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  create(input: CreateVehicleInput): Promise<Vehicle> {
    const vinValue = Vin.from(input.vin).value;
    if (this.vinIndex.has(vinValue)) {
      return Promise.reject(new VehicleVinAlreadyExistsError(vinValue));
    }
    const now = new Date(this.nextCreatedAt);
    this.nextCreatedAt += 1000;
    const id = VehicleId.from(randomUUID());
    const row = new Vehicle(
      id,
      Vin.from(vinValue),
      input.customerId,
      input.label,
      now,
      now,
    );
    this.items.set(id.value, row);
    this.vinIndex.set(vinValue, id.value);
    return Promise.resolve(row);
  }

  list(query: ListVehiclesQuery): Promise<VehiclePage> {
    const { limit, offset, customerId } = query;
    let all = Array.from(this.items.values());
    if (customerId !== undefined) {
      all = all.filter((v) => v.customerId.value === customerId.value);
    }
    all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.resolve({
      total: all.length,
      items: all.slice(offset, offset + limit),
    });
  }

  update(id: VehicleId, input: UpdateVehicleInput): Promise<Vehicle> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new VehicleNotFoundError(`id=${id.value}`));
    }
    const nextVinValue = Object.prototype.hasOwnProperty.call(input, 'vin')
      ? Vin.from(input.vin!).value
      : existing.vin.value;
    if (nextVinValue !== existing.vin.value) {
      if (
        this.vinIndex.has(nextVinValue) &&
        this.vinIndex.get(nextVinValue) !== id.value
      ) {
        return Promise.reject(new VehicleVinAlreadyExistsError(nextVinValue));
      }
      this.vinIndex.delete(existing.vin.value);
      this.vinIndex.set(nextVinValue, id.value);
    }
    const nextCustomer = Object.prototype.hasOwnProperty.call(
      input,
      'customerId',
    )
      ? (input.customerId ?? existing.customerId)
      : existing.customerId;
    const nextLabel = Object.prototype.hasOwnProperty.call(input, 'label')
      ? (input.label ?? null)
      : existing.label;
    const updated = new Vehicle(
      existing.id,
      Vin.from(nextVinValue),
      nextCustomer,
      nextLabel,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: VehicleId): Promise<void> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new VehicleNotFoundError(`id=${id.value}`));
    }
    this.items.delete(id.value);
    this.vinIndex.delete(existing.vin.value);
    return Promise.resolve();
  }
}
