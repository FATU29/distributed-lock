import type { ServiceTypeId } from '../identifiers/service-type-id.vo';
import type { ServiceTypeSpec } from '../service-type/service-type-spec.vo';

export type CreateServiceTypeInput = {
  code: string;
  name: string;
  durationMinutes: number;
  requiredSkillTag: string | null;
};

export type UpdateServiceTypeInput = {
  code?: string;
  name?: string;
  durationMinutes?: number;
  requiredSkillTag?: string | null;
};

export type ListServiceTypesQuery = {
  limit: number;
  offset: number;
};

export type ServiceTypePage = {
  items: ServiceTypeSpec[];
  total: number;
};

export interface ServiceTypeRepository {
  findById(id: ServiceTypeId): Promise<ServiceTypeSpec | null>;
  create(input: CreateServiceTypeInput): Promise<ServiceTypeSpec>;
  list(query: ListServiceTypesQuery): Promise<ServiceTypePage>;
  update(
    id: ServiceTypeId,
    input: UpdateServiceTypeInput,
  ): Promise<ServiceTypeSpec>;
  delete(id: ServiceTypeId): Promise<void>;
}

export const SERVICE_TYPE_REPOSITORY = Symbol('SERVICE_TYPE_REPOSITORY');
