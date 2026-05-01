import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { BayId } from '../../domain/identifiers/bay-id.vo';
import type {
  CreateServiceBayInput,
  ListServiceBaysQuery,
  ServiceBayPage,
  ServiceBayRepository,
  UpdateServiceBayInput,
} from '../../domain/ports';
import { ForeignKeyReferenceError } from '../../domain/reference.errors';
import { ServiceBayNotFoundError } from '../../domain/service-bay/errors';
import { ServiceBay } from '../../domain/service-bay/service-bay.entity';
import { PrismaService } from '../prisma/prisma.service';
import { mapServiceBayRowToDomain } from './mappers/service-bay.mapper';

@Injectable()
export class PrismaServiceBayRepository implements ServiceBayRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: BayId): Promise<ServiceBay | null> {
    const row = await this.prisma.serviceBay.findUnique({
      where: { id: id.value },
    });
    return row ? mapServiceBayRowToDomain(row) : null;
  }

  async create(input: CreateServiceBayInput): Promise<ServiceBay> {
    try {
      const row = await this.prisma.serviceBay.create({
        data: {
          dealershipId: input.dealershipId.value,
          label: input.label.trim(),
        },
      });
      return mapServiceBayRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ForeignKeyReferenceError(
          `dealership_id=${input.dealershipId.value}`,
        );
      }
      throw e;
    }
  }

  async list(query: ListServiceBaysQuery): Promise<ServiceBayPage> {
    const where: Prisma.ServiceBayWhereInput = {};
    if (query.dealershipId) {
      where.dealershipId = query.dealershipId.value;
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceBay.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.serviceBay.count({ where }),
    ]);
    return {
      items: rows.map(mapServiceBayRowToDomain),
      total,
    };
  }

  async update(id: BayId, input: UpdateServiceBayInput): Promise<ServiceBay> {
    const data: Prisma.ServiceBayUpdateInput = {};
    if (input.dealershipId) {
      data.dealership = {
        connect: { id: input.dealershipId.value },
      };
    }
    if (Object.prototype.hasOwnProperty.call(input, 'label')) {
      data.label = input.label?.trim();
    }
    try {
      const row = await this.prisma.serviceBay.update({
        where: { id: id.value },
        data,
      });
      return mapServiceBayRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new ServiceBayNotFoundError(`id=${id.value}`);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ForeignKeyReferenceError(
          'service bay update referenced missing row',
        );
      }
      throw e;
    }
  }

  async delete(id: BayId): Promise<void> {
    try {
      await this.prisma.serviceBay.delete({
        where: { id: id.value },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new ServiceBayNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
