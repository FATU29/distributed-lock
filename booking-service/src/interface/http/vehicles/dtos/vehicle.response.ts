import type { VehiclePage } from '../../../../domain/ports';
import type { Vehicle } from '../../../../domain/vehicle/vehicle.entity';

export type VehicleResponse = {
  id: string;
  vin: string;
  customerId: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleListResponse = {
  total: number;
  items: VehicleResponse[];
};

export function toVehicleResponse(v: Vehicle): VehicleResponse {
  return {
    id: v.id.value,
    vin: v.vin.value,
    customerId: v.customerId.value,
    label: v.label,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export function toVehicleListResponse(page: VehiclePage): VehicleListResponse {
  return {
    total: page.total,
    items: page.items.map(toVehicleResponse),
  };
}
