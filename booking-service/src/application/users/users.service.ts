import { Inject, Injectable } from '@nestjs/common';

import type { UserId } from '../../domain/identifiers/user-id.vo';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserProfile,
  UserProfilePage,
  UserRepository,
} from '../../domain/ports';
import { USER_REPOSITORY } from '../../domain/ports';
import { UserNotFoundError } from '../../domain/user/errors';

/**
 * Application service for the User aggregate. Orchestrates CRUD on the
 * `UserRepository` port. Lives in the application layer (no Prisma, no HTTP,
 * no framework imports beyond `@nestjs/common` for DI).
 *
 * Naming: this is a **NestJS-style aggregate service** — appropriate for
 * straightforward CRUD on one aggregate. Multi-step orchestration (e.g. the
 * booking flow) gets its own single-purpose use-case class instead. See
 * CLAUDE.md §"Application layer organization" for the decision rule.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  create(input: CreateUserInput): Promise<UserProfile> {
    return this.users.create(input);
  }

  async findById(userId: UserId): Promise<UserProfile> {
    const profile = await this.users.findById(userId);
    if (!profile) {
      throw new UserNotFoundError(`id=${userId.value}`);
    }
    return profile;
  }

  async findByEmail(email: string): Promise<UserProfile> {
    const profile = await this.users.findByEmail(email);
    if (!profile) {
      throw new UserNotFoundError(`email=${email.trim().toLowerCase()}`);
    }
    return profile;
  }

  list(query: ListUsersQuery): Promise<UserProfilePage> {
    return this.users.list(query);
  }

  update(userId: UserId, input: UpdateUserInput): Promise<UserProfile> {
    return this.users.update(userId, input);
  }

  delete(userId: UserId): Promise<void> {
    return this.users.delete(userId);
  }
}
