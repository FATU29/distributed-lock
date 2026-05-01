export class WorkingHoursNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkingHoursNotFoundError';
  }
}

export class WorkingHoursAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkingHoursAlreadyExistsError';
  }
}

export class InvalidWorkingHoursError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWorkingHoursError';
  }
}

export class HolidayNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HolidayNotFoundError';
  }
}

export class HolidayAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HolidayAlreadyExistsError';
  }
}

export class OutsideWorkingHoursError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutsideWorkingHoursError';
  }
}

export class DealershipClosedOnHolidayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DealershipClosedOnHolidayError';
  }
}
