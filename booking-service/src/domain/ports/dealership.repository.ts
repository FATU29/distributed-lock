import type { Dealership } from '../dealership/dealership.entity';
import type { DealershipId } from '../identifiers/dealership-id.vo';

export type CreateDealershipInput = {
  code: string;
  name: string;
};

export type UpdateDealershipInput = {
  code?: string;
  name?: string;
};

export type ListDealershipsQuery = {
  limit: number;
  offset: number;
};

export type DealershipPage = {
  items: Dealership[];
  total: number;
};

export interface DealershipRepository {
  findById(id: DealershipId): Promise<Dealership | null>;
  create(input: CreateDealershipInput): Promise<Dealership>;
  list(query: ListDealershipsQuery): Promise<DealershipPage>;
  update(id: DealershipId, input: UpdateDealershipInput): Promise<Dealership>;
  delete(id: DealershipId): Promise<void>;
}

export const DEALERSHIP_REPOSITORY = Symbol('DEALERSHIP_REPOSITORY');
