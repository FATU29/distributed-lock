import type { Vehicle as VehicleRow } from '@prisma/client';

import { CustomerId } from '../../../domain/identifiers/customer-id.vo';
import { VehicleId } from '../../../domain/identifiers/vehicle-id.vo';
import { Vin } from '../../../domain/identifiers/vin.vo';
import { Vehicle } from '../../../domain/vehicle/vehicle.entity';

export function mapVehicleRowToDomain(row: VehicleRow): Vehicle {
  return new Vehicle(
    VehicleId.from(row.id),
    Vin.from(row.vin),
    CustomerId.from(row.customerId),
    row.label,
    row.createdAt,
    row.updatedAt,
  );
}
