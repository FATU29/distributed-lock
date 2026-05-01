export class ServiceTypeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceTypeNotFoundError';
  }
}

export class ServiceTypeCodeAlreadyExistsError extends Error {
  constructor(public readonly code: string) {
    super(`Service type code already exists: ${code}`);
    this.name = 'ServiceTypeCodeAlreadyExistsError';
  }
}
