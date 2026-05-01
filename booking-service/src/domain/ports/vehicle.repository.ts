import type { CustomerId } from '../identifiers/customer-id.vo';
import type { VehicleId } from '../identifiers/vehicle-id.vo';
import type { Vehicle } from '../vehicle/vehicle.entity';

export type CreateVehicleInput = {
  customerId: CustomerId;
  vin: string;
  label: string | null;
};

export type UpdateVehicleInput = {
  customerId?: CustomerId;
  vin?: string;
  label?: string | null;
};

export type ListVehiclesQuery = {
  limit: number;
  offset: number;
  customerId?: CustomerId;
};

export type VehiclePage = {
  items: Vehicle[];
  total: number;
};

export interface VehicleRepository {
  findById(id: VehicleId): Promise<Vehicle | null>;
  create(input: CreateVehicleInput): Promise<Vehicle>;
  list(query: ListVehiclesQuery): Promise<VehiclePage>;
  update(id: VehicleId, input: UpdateVehicleInput): Promise<Vehicle>;
  delete(id: VehicleId): Promise<void>;
}

export const VEHICLE_REPOSITORY = Symbol('VEHICLE_REPOSITORY');
