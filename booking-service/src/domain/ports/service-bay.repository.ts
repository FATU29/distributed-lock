import type { BayId } from '../identifiers/bay-id.vo';
import type { DealershipId } from '../identifiers/dealership-id.vo';
import type { ServiceBay } from '../service-bay/service-bay.entity';

export type CreateServiceBayInput = {
  dealershipId: DealershipId;
  label: string;
};

export type UpdateServiceBayInput = {
  dealershipId?: DealershipId;
  label?: string;
};

export type ListServiceBaysQuery = {
  limit: number;
  offset: number;
  dealershipId?: DealershipId;
};

export type ServiceBayPage = {
  items: ServiceBay[];
  total: number;
};

export interface ServiceBayRepository {
  findById(id: BayId): Promise<ServiceBay | null>;
  create(input: CreateServiceBayInput): Promise<ServiceBay>;
  list(query: ListServiceBaysQuery): Promise<ServiceBayPage>;
  update(id: BayId, input: UpdateServiceBayInput): Promise<ServiceBay>;
  delete(id: BayId): Promise<void>;
}

export const SERVICE_BAY_REPOSITORY = Symbol('SERVICE_BAY_REPOSITORY');
