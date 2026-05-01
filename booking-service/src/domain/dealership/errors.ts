export class DealershipNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DealershipNotFoundError';
  }
}

export class DealershipCodeAlreadyExistsError extends Error {
  constructor(public readonly code: string) {
    super(`Dealership code already exists: ${code}`);
    this.name = 'DealershipCodeAlreadyExistsError';
  }
}
