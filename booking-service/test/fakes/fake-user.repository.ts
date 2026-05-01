import { randomUUID } from 'node:crypto';

import { Customer } from '../../src/domain/customer/customer.entity';
import { CustomerId } from '../../src/domain/identifiers/customer-id.vo';
import { UserId } from '../../src/domain/identifiers/user-id.vo';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserProfile,
  UserProfilePage,
  UserRepository,
} from '../../src/domain/ports';
import {
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../src/domain/user/errors';
import { User } from '../../src/domain/user/user.entity';

/**
 * In-memory UserRepository implementation for unit tests of the application
 * layer. Mirrors the production adapter's contract (server-assigned UUIDs,
 * UserAlreadyExistsError on duplicate email, UserNotFoundError on missing)
 * without touching Prisma.
 */
export class FakeUserRepository implements UserRepository {
  private readonly profiles = new Map<string, UserProfile>();
  private nextCreatedAt = Date.parse('2026-01-01T00:00:00.000Z');

  findById(userId: UserId): Promise<UserProfile | null> {
    return Promise.resolve(this.profiles.get(userId.value) ?? null);
  }

  findByEmail(email: string): Promise<UserProfile | null> {
    const normalized = email.trim().toLowerCase();
    for (const profile of this.profiles.values()) {
      if (profile.user.email === normalized) {
        return Promise.resolve(profile);
      }
    }
    return Promise.resolve(null);
  }

  create(input: CreateUserInput): Promise<UserProfile> {
    const email = input.email.trim().toLowerCase();
    for (const profile of this.profiles.values()) {
      if (profile.user.email === email) {
        return Promise.reject(new UserAlreadyExistsError(email));
      }
    }
    const now = new Date(this.nextCreatedAt);
    this.nextCreatedAt += 1000;
    const userId = UserId.from(randomUUID());
    const customerId = CustomerId.from(randomUUID());
    const profile: UserProfile = {
      user: new User(userId, email, input.displayName, now, now),
      customer: new Customer(customerId, userId, now, now),
      vehicles: [],
    };
    this.profiles.set(userId.value, profile);
    return Promise.resolve(profile);
  }

  list(query: ListUsersQuery): Promise<UserProfilePage> {
    const all = Array.from(this.profiles.values()).sort(
      (a, b) => a.user.createdAt.getTime() - b.user.createdAt.getTime(),
    );
    return Promise.resolve({
      total: all.length,
      items: all.slice(query.offset, query.offset + query.limit),
    });
  }

  update(userId: UserId, input: UpdateUserInput): Promise<UserProfile> {
    const existing = this.profiles.get(userId.value);
    if (!existing) {
      return Promise.reject(new UserNotFoundError(`id=${userId.value}`));
    }
    const displayName = Object.prototype.hasOwnProperty.call(
      input,
      'displayName',
    )
      ? (input.displayName ?? null)
      : existing.user.displayName;
    const updated: UserProfile = {
      ...existing,
      user: new User(
        existing.user.id,
        existing.user.email,
        displayName,
        existing.user.createdAt,
        new Date(existing.user.updatedAt.getTime() + 1000),
      ),
    };
    this.profiles.set(userId.value, updated);
    return Promise.resolve(updated);
  }

  delete(userId: UserId): Promise<void> {
    if (!this.profiles.delete(userId.value)) {
      return Promise.reject(new UserNotFoundError(`id=${userId.value}`));
    }
    return Promise.resolve();
  }
}
