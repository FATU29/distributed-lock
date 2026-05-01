import type { DealershipId } from '../identifiers/dealership-id.vo';
import type { HolidayId } from '../identifiers/holiday-id.vo';

export class Holiday {
  constructor(
    readonly id: HolidayId,
    readonly dealershipId: DealershipId,
    readonly date: Date,
    readonly name: string,
    readonly isRecurring: boolean,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  matches(target: Date): boolean {
    if (this.isRecurring) {
      return (
        this.date.getUTCMonth() === target.getUTCMonth() &&
        this.date.getUTCDate() === target.getUTCDate()
      );
    }
    return (
      this.date.getUTCFullYear() === target.getUTCFullYear() &&
      this.date.getUTCMonth() === target.getUTCMonth() &&
      this.date.getUTCDate() === target.getUTCDate()
    );
  }
}
