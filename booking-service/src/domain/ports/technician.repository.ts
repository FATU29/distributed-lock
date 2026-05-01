import type { DealershipId } from '../identifiers/dealership-id.vo';
import type { ServiceTypeId } from '../identifiers/service-type-id.vo';
import type { TechnicianId } from '../identifiers/technician-id.vo';
import type { Technician } from '../technician/technician.entity';

export type CreateTechnicianInput = {
  dealershipId: DealershipId;
  name: string;
  qualifiedServiceTypeIds: readonly ServiceTypeId[];
};

export type UpdateTechnicianInput = {
  dealershipId?: DealershipId;
  name?: string;
  qualifiedServiceTypeIds?: readonly ServiceTypeId[];
};

export type ListTechniciansQuery = {
  limit: number;
  offset: number;
  dealershipId?: DealershipId;
};

export type TechnicianPage = {
  items: Technician[];
  total: number;
};

export interface TechnicianRepository {
  findById(id: TechnicianId): Promise<Technician | null>;
  create(input: CreateTechnicianInput): Promise<Technician>;
  list(query: ListTechniciansQuery): Promise<TechnicianPage>;
  update(id: TechnicianId, input: UpdateTechnicianInput): Promise<Technician>;
  delete(id: TechnicianId): Promise<void>;
}

export const TECHNICIAN_REPOSITORY = Symbol('TECHNICIAN_REPOSITORY');
