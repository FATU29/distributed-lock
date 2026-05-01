import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { TechnicianId } from '../../domain/identifiers/technician-id.vo';
import type {
  CreateTechnicianInput,
  ListTechniciansQuery,
  TechnicianPage,
  TechnicianRepository,
  UpdateTechnicianInput,
} from '../../domain/ports';
import { ForeignKeyReferenceError } from '../../domain/reference.errors';
import { TechnicianNotFoundError } from '../../domain/technician/errors';
import { Technician } from '../../domain/technician/technician.entity';
import { PrismaService } from '../prisma/prisma.service';
import { mapTechnicianRowToDomain } from './mappers/technician.mapper';

const technicianInclude = {
  qualifiedServices: true,
} satisfies Prisma.TechnicianInclude;

@Injectable()
export class PrismaTechnicianRepository implements TechnicianRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: TechnicianId): Promise<Technician | null> {
    const row = await this.prisma.technician.findUnique({
      where: { id: id.value },
      include: technicianInclude,
    });
    return row ? mapTechnicianRowToDomain(row) : null;
  }

  async create(input: CreateTechnicianInput): Promise<Technician> {
    try {
      const row = await this.prisma.technician.create({
        data: {
          dealershipId: input.dealershipId.value,
          name: input.name.trim(),
          qualifiedServices: {
            create: input.qualifiedServiceTypeIds.map((sid) => ({
              serviceTypeId: sid.value,
            })),
          },
        },
        include: technicianInclude,
      });
      return mapTechnicianRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ForeignKeyReferenceError(
          'technician create referenced missing dealership or service type',
        );
      }
      throw e;
    }
  }

  async list(query: ListTechniciansQuery): Promise<TechnicianPage> {
    const where: Prisma.TechnicianWhereInput = {};
    if (query.dealershipId) {
      where.dealershipId = query.dealershipId.value;
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.technician.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'asc' },
        include: technicianInclude,
      }),
      this.prisma.technician.count({ where }),
    ]);
    return {
      items: rows.map(mapTechnicianRowToDomain),
      total,
    };
  }

  async update(
    id: TechnicianId,
    input: UpdateTechnicianInput,
  ): Promise<Technician> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const data: Prisma.TechnicianUpdateInput = {};
        if (input.dealershipId) {
          data.dealership = {
            connect: { id: input.dealershipId.value },
          };
        }
        if (Object.prototype.hasOwnProperty.call(input, 'name')) {
          data.name = input.name?.trim();
        }

        if (Object.keys(data).length > 0) {
          await tx.technician.update({
            where: { id: id.value },
            data,
          });
        }

        if (input.qualifiedServiceTypeIds !== undefined) {
          await tx.technicianQualifiedService.deleteMany({
            where: { technicianId: id.value },
          });
          if (input.qualifiedServiceTypeIds.length > 0) {
            await tx.technicianQualifiedService.createMany({
              data: input.qualifiedServiceTypeIds.map((sid) => ({
                technicianId: id.value,
                serviceTypeId: sid.value,
              })),
            });
          }
        }

        const refreshed = await tx.technician.findUniqueOrThrow({
          where: { id: id.value },
          include: technicianInclude,
        });
        return refreshed;
      });
      return mapTechnicianRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new TechnicianNotFoundError(`id=${id.value}`);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ForeignKeyReferenceError(
          'technician update referenced missing row',
        );
      }
      throw e;
    }
  }

  async delete(id: TechnicianId): Promise<void> {
    try {
      await this.prisma.technician.delete({
        where: { id: id.value },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new TechnicianNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
