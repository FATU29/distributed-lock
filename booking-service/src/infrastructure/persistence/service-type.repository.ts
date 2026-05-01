import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { ServiceTypeId } from '../../domain/identifiers/service-type-id.vo';
import type {
  CreateServiceTypeInput,
  ListServiceTypesQuery,
  ServiceTypePage,
  ServiceTypeRepository,
  UpdateServiceTypeInput,
} from '../../domain/ports';
import {
  ServiceTypeCodeAlreadyExistsError,
  ServiceTypeNotFoundError,
} from '../../domain/service-type/errors';
import type { ServiceTypeSpec } from '../../domain/service-type/service-type-spec.vo';
import { PrismaService } from '../prisma/prisma.service';
import { mapServiceTypeRowToSpec } from './mappers/service-type-spec.mapper';

@Injectable()
export class PrismaServiceTypeRepository implements ServiceTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: ServiceTypeId): Promise<ServiceTypeSpec | null> {
    const row = await this.prisma.serviceType.findUnique({
      where: { id: id.value },
    });
    return row ? mapServiceTypeRowToSpec(row) : null;
  }

  async create(input: CreateServiceTypeInput): Promise<ServiceTypeSpec> {
    try {
      const row = await this.prisma.serviceType.create({
        data: {
          code: input.code.trim(),
          name: input.name.trim(),
          durationMinutes: input.durationMinutes,
          requiredSkillTag: input.requiredSkillTag,
        },
      });
      return mapServiceTypeRowToSpec(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ServiceTypeCodeAlreadyExistsError(input.code.trim());
      }
      throw e;
    }
  }

  async list(query: ListServiceTypesQuery): Promise<ServiceTypePage> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceType.findMany({
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.serviceType.count(),
    ]);
    return {
      items: rows.map(mapServiceTypeRowToSpec),
      total,
    };
  }

  async update(
    id: ServiceTypeId,
    input: UpdateServiceTypeInput,
  ): Promise<ServiceTypeSpec> {
    const data: Prisma.ServiceTypeUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(input, 'code')) {
      data.code = input.code?.trim();
    }
    if (Object.prototype.hasOwnProperty.call(input, 'name')) {
      data.name = input.name?.trim();
    }
    if (Object.prototype.hasOwnProperty.call(input, 'durationMinutes')) {
      data.durationMinutes = input.durationMinutes;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'requiredSkillTag')) {
      data.requiredSkillTag = input.requiredSkillTag;
    }
    try {
      const row = await this.prisma.serviceType.update({
        where: { id: id.value },
        data,
      });
      return mapServiceTypeRowToSpec(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new ServiceTypeNotFoundError(`id=${id.value}`);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ServiceTypeCodeAlreadyExistsError(String(input.code ?? ''));
      }
      throw e;
    }
  }

  async delete(id: ServiceTypeId): Promise<void> {
    try {
      await this.prisma.serviceType.delete({
        where: { id: id.value },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new ServiceTypeNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
