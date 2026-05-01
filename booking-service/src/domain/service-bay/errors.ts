export class ServiceBayNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceBayNotFoundError';
  }
}
