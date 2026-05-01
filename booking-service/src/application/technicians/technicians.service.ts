import { Inject, Injectable } from '@nestjs/common';

import type { TechnicianId } from '../../domain/identifiers/technician-id.vo';
import type {
  CreateTechnicianInput,
  ListTechniciansQuery,
  TechnicianPage,
  TechnicianRepository,
  UpdateTechnicianInput,
} from '../../domain/ports';
import { TECHNICIAN_REPOSITORY } from '../../domain/ports';
import { Technician } from '../../domain/technician/technician.entity';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { TechnicianNotFoundError } from '../../domain/technician/errors';

@Injectable()
export class TechniciansService {
  constructor(
    @Inject(TECHNICIAN_REPOSITORY)
    private readonly technicians: TechnicianRepository,
  ) {}

  create(input: CreateTechnicianInput): Promise<Technician> {
    return this.technicians.create(input);
  }

  async findById(id: TechnicianId): Promise<Technician> {
    const row = await this.technicians.findById(id);
    if (!row) {
      throw new TechnicianNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  list(query: ListTechniciansQuery): Promise<TechnicianPage> {
    return this.technicians.list(query);
  }

  async update(
    id: TechnicianId,
    input: UpdateTechnicianInput,
  ): Promise<Technician> {
    if (
      !Object.prototype.hasOwnProperty.call(input, 'dealershipId') &&
      !Object.prototype.hasOwnProperty.call(input, 'name') &&
      !Object.prototype.hasOwnProperty.call(input, 'qualifiedServiceTypeIds')
    ) {
      throw new EmptyUpdateError();
    }
    return this.technicians.update(id, input);
  }

  delete(id: TechnicianId): Promise<void> {
    return this.technicians.delete(id);
  }
}
