export class UserAlreadyExistsError extends Error {
  constructor(readonly email: string) {
    super(`User already exists for email ${email}`);
    this.name = 'UserAlreadyExistsError';
  }
}

export class UserNotFoundError extends Error {
  constructor(readonly criterion: string) {
    super(`User not found: ${criterion}`);
    this.name = 'UserNotFoundError';
  }
}
