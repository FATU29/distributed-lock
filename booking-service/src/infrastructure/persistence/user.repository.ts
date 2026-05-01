import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { UserId } from '../../domain/identifiers/user-id.vo';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserProfile,
  UserProfilePage,
  UserRepository,
} from '../../domain/ports';
import {
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../domain/user/errors';
import { PrismaService } from '../prisma/prisma.service';
import { mapCustomerRowToDomain } from './mappers/customer.mapper';
import { mapUserRowToDomain } from './mappers/user.mapper';
import { mapVehicleRowToDomain } from './mappers/vehicle.mapper';

const userInclude = {
  customer: {
    include: { vehicles: true },
  },
} satisfies Prisma.UserInclude;

type UserRowWithRelations = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapToProfile(row: UserRowWithRelations): UserProfile | null {
  if (!row.customer) {
    return null;
  }
  return {
    user: mapUserRowToDomain(row),
    customer: mapCustomerRowToDomain(row.customer),
    vehicles: row.customer.vehicles.map(mapVehicleRowToDomain),
  };
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: UserId): Promise<UserProfile | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId.value },
      include: userInclude,
    });
    if (!row) {
      return null;
    }
    return mapToProfile(row);
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: userInclude,
    });
    if (!row) {
      return null;
    }
    return mapToProfile(row);
  }

  async create(input: CreateUserInput): Promise<UserProfile> {
    const email = normalizeEmail(input.email);
    try {
      const row = await this.prisma.user.create({
        data: {
          email,
          displayName: input.displayName ?? null,
          customer: {
            create: {},
          },
        },
        include: userInclude,
      });
      const profile = mapToProfile(row);
      if (!profile) {
        throw new Error('Invariant: user profile incomplete after create');
      }
      return profile;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new UserAlreadyExistsError(email);
      }
      throw e;
    }
  }

  async list(query: ListUsersQuery): Promise<UserProfilePage> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'asc' },
        include: userInclude,
      }),
      this.prisma.user.count(),
    ]);

    const items: UserProfile[] = [];
    for (const row of rows) {
      const profile = mapToProfile(row);
      if (profile) {
        items.push(profile);
      }
    }
    return { items, total };
  }

  async update(userId: UserId, input: UpdateUserInput): Promise<UserProfile> {
    const data: Prisma.UserUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(input, 'displayName')) {
      data.displayName = input.displayName ?? null;
    }

    try {
      const row = await this.prisma.user.update({
        where: { id: userId.value },
        data,
        include: userInclude,
      });
      const profile = mapToProfile(row);
      if (!profile) {
        throw new UserNotFoundError(`id=${userId.value}`);
      }
      return profile;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new UserNotFoundError(`id=${userId.value}`);
      }
      throw e;
    }
  }

  async delete(userId: UserId): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id: userId.value },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new UserNotFoundError(`id=${userId.value}`);
      }
      throw e;
    }
  }
}
