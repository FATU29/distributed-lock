import type { DealershipId } from '../identifiers/dealership-id.vo';
import type { HolidayId } from '../identifiers/holiday-id.vo';
import type { Holiday } from '../schedule/holiday.entity';

export type CreateHolidayInput = {
  dealershipId: DealershipId;
  date: Date;
  name: string;
  isRecurring: boolean;
};

export type UpdateHolidayInput = {
  date?: Date;
  name?: string;
  isRecurring?: boolean;
};

export type ListHolidaysQuery = {
  dealershipId: DealershipId;
  limit: number;
  offset: number;
};

export type HolidayPage = {
  items: Holiday[];
  total: number;
};

export interface HolidayRepository {
  findById(id: HolidayId): Promise<Holiday | null>;
  list(query: ListHolidaysQuery): Promise<HolidayPage>;
  /**
   * Loads every holiday for the dealership — fixed and recurring.
   * Callers that need "is `target` a holiday?" filter via
   * {@link Holiday.matches} in memory; the table is small so we avoid
   * EXTRACT(...) gymnastics in SQL.
   */
  listAllForDealership(dealershipId: DealershipId): Promise<Holiday[]>;
  /** Throws `HolidayAlreadyExistsError` on `(dealershipId, date, isRecurring)` clash. */
  create(input: CreateHolidayInput): Promise<Holiday>;
  /** Throws `HolidayNotFoundError` when missing. */
  update(id: HolidayId, input: UpdateHolidayInput): Promise<Holiday>;
  /** Throws `HolidayNotFoundError` when missing. */
  delete(id: HolidayId): Promise<void>;
}

export const HOLIDAY_REPOSITORY = Symbol('HOLIDAY_REPOSITORY');
