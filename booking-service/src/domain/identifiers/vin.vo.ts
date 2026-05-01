export class Vin {
  private constructor(readonly value: string) {}

  static from(raw: string): Vin {
    const trimmed = raw.trim();
    if (trimmed.length < 5) {
      throw new Error('Invalid VIN');
    }
    return new Vin(trimmed);
  }
}
