import { Inject, Injectable } from '@nestjs/common';

import type { VehicleId } from '../../domain/identifiers/vehicle-id.vo';
import type {
  CreateVehicleInput,
  ListVehiclesQuery,
  UpdateVehicleInput,
  VehiclePage,
  VehicleRepository,
} from '../../domain/ports';
import { VEHICLE_REPOSITORY } from '../../domain/ports';
import { Vehicle } from '../../domain/vehicle/vehicle.entity';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { VehicleNotFoundError } from '../../domain/vehicle/errors';

@Injectable()
export class VehiclesService {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicles: VehicleRepository,
  ) {}

  create(input: CreateVehicleInput): Promise<Vehicle> {
    return this.vehicles.create(input);
  }

  async findById(id: VehicleId): Promise<Vehicle> {
    const row = await this.vehicles.findById(id);
    if (!row) {
      throw new VehicleNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  list(query: ListVehiclesQuery): Promise<VehiclePage> {
    return this.vehicles.list(query);
  }

  async update(id: VehicleId, input: UpdateVehicleInput): Promise<Vehicle> {
    if (
      !Object.prototype.hasOwnProperty.call(input, 'customerId') &&
      !Object.prototype.hasOwnProperty.call(input, 'vin') &&
      !Object.prototype.hasOwnProperty.call(input, 'label')
    ) {
      throw new EmptyUpdateError();
    }
    return this.vehicles.update(id, input);
  }

  delete(id: VehicleId): Promise<void> {
    return this.vehicles.delete(id);
  }
}
