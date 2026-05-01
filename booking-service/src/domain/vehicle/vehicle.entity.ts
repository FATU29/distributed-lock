import { CustomerId } from '../identifiers/customer-id.vo';
import { VehicleId } from '../identifiers/vehicle-id.vo';
import { Vin } from '../identifiers/vin.vo';

export class Vehicle {
  constructor(
    readonly id: VehicleId,
    readonly vin: Vin,
    readonly customerId: CustomerId,
    readonly label: string | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
