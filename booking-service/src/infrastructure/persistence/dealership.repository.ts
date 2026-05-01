import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import type {
  CreateDealershipInput,
  DealershipPage,
  DealershipRepository,
  ListDealershipsQuery,
  UpdateDealershipInput,
} from '../../domain/ports';
import {
  DealershipCodeAlreadyExistsError,
  DealershipNotFoundError,
} from '../../domain/dealership/errors';
import { Dealership } from '../../domain/dealership/dealership.entity';
import { PrismaService } from '../prisma/prisma.service';
import { mapDealershipRowToDomain } from './mappers/dealership.mapper';

@Injectable()
export class PrismaDealershipRepository implements DealershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: DealershipId): Promise<Dealership | null> {
    const row = await this.prisma.dealership.findUnique({
      where: { id: id.value },
    });
    return row ? mapDealershipRowToDomain(row) : null;
  }

  async create(input: CreateDealershipInput): Promise<Dealership> {
    try {
      const row = await this.prisma.dealership.create({
        data: {
          code: input.code.trim(),
          name: input.name.trim(),
        },
      });
      return mapDealershipRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new DealershipCodeAlreadyExistsError(input.code.trim());
      }
      throw e;
    }
  }

  async list(query: ListDealershipsQuery): Promise<DealershipPage> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dealership.findMany({
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dealership.count(),
    ]);
    return {
      items: rows.map(mapDealershipRowToDomain),
      total,
    };
  }

  async update(
    id: DealershipId,
    input: UpdateDealershipInput,
  ): Promise<Dealership> {
    const data: Prisma.DealershipUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(input, 'code')) {
      data.code = input.code?.trim();
    }
    if (Object.prototype.hasOwnProperty.call(input, 'name')) {
      data.name = input.name?.trim();
    }
    try {
      const row = await this.prisma.dealership.update({
        where: { id: id.value },
        data,
      });
      return mapDealershipRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new DealershipNotFoundError(`id=${id.value}`);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new DealershipCodeAlreadyExistsError(String(input.code ?? ''));
      }
      throw e;
    }
  }

  async delete(id: DealershipId): Promise<void> {
    try {
      await this.prisma.dealership.delete({
        where: { id: id.value },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new DealershipNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
