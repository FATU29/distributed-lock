import { Inject, Injectable } from '@nestjs/common';

import type { ServiceTypeId } from '../../domain/identifiers/service-type-id.vo';
import type {
  CreateServiceTypeInput,
  ListServiceTypesQuery,
  ServiceTypePage,
  ServiceTypeRepository,
  UpdateServiceTypeInput,
} from '../../domain/ports';
import { SERVICE_TYPE_REPOSITORY } from '../../domain/ports';
import type { ServiceTypeSpec } from '../../domain/service-type/service-type-spec.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { ServiceTypeNotFoundError } from '../../domain/service-type/errors';

@Injectable()
export class ServiceTypesService {
  constructor(
    @Inject(SERVICE_TYPE_REPOSITORY)
    private readonly serviceTypes: ServiceTypeRepository,
  ) {}

  create(input: CreateServiceTypeInput): Promise<ServiceTypeSpec> {
    return this.serviceTypes.create(input);
  }

  async findById(id: ServiceTypeId): Promise<ServiceTypeSpec> {
    const row = await this.serviceTypes.findById(id);
    if (!row) {
      throw new ServiceTypeNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  list(query: ListServiceTypesQuery): Promise<ServiceTypePage> {
    return this.serviceTypes.list(query);
  }

  async update(
    id: ServiceTypeId,
    input: UpdateServiceTypeInput,
  ): Promise<ServiceTypeSpec> {
    if (
      !Object.prototype.hasOwnProperty.call(input, 'code') &&
      !Object.prototype.hasOwnProperty.call(input, 'name') &&
      !Object.prototype.hasOwnProperty.call(input, 'durationMinutes') &&
      !Object.prototype.hasOwnProperty.call(input, 'requiredSkillTag')
    ) {
      throw new EmptyUpdateError();
    }
    return this.serviceTypes.update(id, input);
  }

  delete(id: ServiceTypeId): Promise<void> {
    return this.serviceTypes.delete(id);
  }
}
