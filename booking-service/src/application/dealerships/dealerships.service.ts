import { Inject, Injectable } from '@nestjs/common';

import type { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import type {
  CreateDealershipInput,
  DealershipPage,
  DealershipRepository,
  ListDealershipsQuery,
  UpdateDealershipInput,
} from '../../domain/ports';
import { DEALERSHIP_REPOSITORY } from '../../domain/ports';
import { Dealership } from '../../domain/dealership/dealership.entity';
import { DealershipNotFoundError } from '../../domain/dealership/errors';
import { EmptyUpdateError } from '../../domain/reference.errors';

@Injectable()
export class DealershipsService {
  constructor(
    @Inject(DEALERSHIP_REPOSITORY)
    private readonly dealerships: DealershipRepository,
  ) {}

  create(input: CreateDealershipInput): Promise<Dealership> {
    return this.dealerships.create(input);
  }

  async findById(id: DealershipId): Promise<Dealership> {
    const row = await this.dealerships.findById(id);
    if (!row) {
      throw new DealershipNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  list(query: ListDealershipsQuery): Promise<DealershipPage> {
    return this.dealerships.list(query);
  }

  async update(
    id: DealershipId,
    input: UpdateDealershipInput,
  ): Promise<Dealership> {
    if (
      !Object.prototype.hasOwnProperty.call(input, 'code') &&
      !Object.prototype.hasOwnProperty.call(input, 'name')
    ) {
      throw new EmptyUpdateError();
    }
    return this.dealerships.update(id, input);
  }

  delete(id: DealershipId): Promise<void> {
    return this.dealerships.delete(id);
  }
}
