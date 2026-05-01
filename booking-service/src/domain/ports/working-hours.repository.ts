import type { DealershipId } from '../identifiers/dealership-id.vo';
import type { WorkingHoursId } from '../identifiers/working-hours-id.vo';
import type { DayOfWeek } from '../schedule/day-of-week.vo';
import type { WorkingHours } from '../schedule/working-hours.entity';

export type CreateWorkingHoursInput = {
  dealershipId: DealershipId;
  dayOfWeek: DayOfWeek;
  openMinutes: number;
  closeMinutes: number;
  isClosed: boolean;
};

export type UpdateWorkingHoursInput = {
  openMinutes?: number;
  closeMinutes?: number;
  isClosed?: boolean;
};

export interface WorkingHoursRepository {
  findById(id: WorkingHoursId): Promise<WorkingHours | null>;
  listForDealership(dealershipId: DealershipId): Promise<WorkingHours[]>;
  findForDealershipDay(
    dealershipId: DealershipId,
    dayOfWeek: DayOfWeek,
  ): Promise<WorkingHours | null>;
  /** Throws `WorkingHoursAlreadyExistsError` when the dealership/day pair clashes. */
  create(input: CreateWorkingHoursInput): Promise<WorkingHours>;
  /** Throws `WorkingHoursNotFoundError` when the row is missing. */
  update(
    id: WorkingHoursId,
    input: UpdateWorkingHoursInput,
  ): Promise<WorkingHours>;
  /** Throws `WorkingHoursNotFoundError` when the row is missing. */
  delete(id: WorkingHoursId): Promise<void>;
}

export const WORKING_HOURS_REPOSITORY = Symbol('WORKING_HOURS_REPOSITORY');
