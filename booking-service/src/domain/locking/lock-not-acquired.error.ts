export class LockNotAcquiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockNotAcquiredError';
  }
}
