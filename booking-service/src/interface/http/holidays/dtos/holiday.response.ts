import type { HolidayPage } from '../../../../domain/ports';
import type { Holiday } from '../../../../domain/schedule/holiday.entity';

export type HolidayResponse = {
  id: string;
  dealershipId: string;
  date: string; // YYYY-MM-DD (UTC)
  name: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HolidayListResponse = {
  total: number;
  items: HolidayResponse[];
};

export function toHolidayResponse(h: Holiday): HolidayResponse {
  return {
    id: h.id.value,
    dealershipId: h.dealershipId.value,
    date: h.date.toISOString().slice(0, 10),
    name: h.name,
    isRecurring: h.isRecurring,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  };
}

export function toHolidayListResponse(page: HolidayPage): HolidayListResponse {
  return {
    total: page.total,
    items: page.items.map(toHolidayResponse),
  };
}
