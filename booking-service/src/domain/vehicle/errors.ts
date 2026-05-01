export class VehicleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VehicleNotFoundError';
  }
}

export class VehicleVinAlreadyExistsError extends Error {
  constructor(public readonly vin: string) {
    super(`Vehicle VIN already exists: ${vin}`);
    this.name = 'VehicleVinAlreadyExistsError';
  }
}
