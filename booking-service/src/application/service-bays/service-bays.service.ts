import { Inject, Injectable } from '@nestjs/common';

import type { BayId } from '../../domain/identifiers/bay-id.vo';
import type {
  CreateServiceBayInput,
  ListServiceBaysQuery,
  ServiceBayPage,
  ServiceBayRepository,
  UpdateServiceBayInput,
} from '../../domain/ports';
import { SERVICE_BAY_REPOSITORY } from '../../domain/ports';
import { ServiceBay } from '../../domain/service-bay/service-bay.entity';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { ServiceBayNotFoundError } from '../../domain/service-bay/errors';

@Injectable()
export class ServiceBaysService {
  constructor(
    @Inject(SERVICE_BAY_REPOSITORY)
    private readonly bays: ServiceBayRepository,
  ) {}

  create(input: CreateServiceBayInput): Promise<ServiceBay> {
    return this.bays.create(input);
  }

  async findById(id: BayId): Promise<ServiceBay> {
    const row = await this.bays.findById(id);
    if (!row) {
      throw new ServiceBayNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  list(query: ListServiceBaysQuery): Promise<ServiceBayPage> {
    return this.bays.list(query);
  }

  async update(id: BayId, input: UpdateServiceBayInput): Promise<ServiceBay> {
    if (
      !Object.prototype.hasOwnProperty.call(input, 'dealershipId') &&
      !Object.prototype.hasOwnProperty.call(input, 'label')
    ) {
      throw new EmptyUpdateError();
    }
    return this.bays.update(id, input);
  }

  delete(id: BayId): Promise<void> {
    return this.bays.delete(id);
  }
}
