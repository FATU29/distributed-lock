export class ForeignKeyReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForeignKeyReferenceError';
  }
}

export class EmptyUpdateError extends Error {
  constructor() {
    super('At least one field is required');
    this.name = 'EmptyUpdateError';
  }
}
