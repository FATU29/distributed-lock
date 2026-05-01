export class AppointmentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentNotFoundError';
  }
}

export class InvalidSlotWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSlotWindowError';
  }
}

export class SlotAlreadyBookedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotAlreadyBookedError';
  }
}
