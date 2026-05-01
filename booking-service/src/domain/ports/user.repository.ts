import type { Customer } from '../customer/customer.entity';
import type { User } from '../user/user.entity';
import type { Vehicle } from '../vehicle/vehicle.entity';
import type { UserId } from '../identifiers/user-id.vo';

export type UserProfile = {
  user: User;
  customer: Customer;
  vehicles: Vehicle[];
};

export type CreateUserInput = {
  email: string;
  displayName: string | null;
};

export type UpdateUserInput = {
  displayName?: string | null;
};

export type ListUsersQuery = {
  limit: number;
  offset: number;
};

export type UserProfilePage = {
  items: UserProfile[];
  total: number;
};

export interface UserRepository {
  findById(userId: UserId): Promise<UserProfile | null>;
  findByEmail(email: string): Promise<UserProfile | null>;
  /**
   * Creates a User and its Customer FK target. Identifiers are assigned by
   * the database (`@default(uuid())`) — callers never pass IDs in create
   * flows.
   */
  create(input: CreateUserInput): Promise<UserProfile>;
  list(query: ListUsersQuery): Promise<UserProfilePage>;
  /** Throws `UserNotFoundError` if the user does not exist. */
  update(userId: UserId, input: UpdateUserInput): Promise<UserProfile>;
  /** Throws `UserNotFoundError` if the user does not exist. */
  delete(userId: UserId): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
