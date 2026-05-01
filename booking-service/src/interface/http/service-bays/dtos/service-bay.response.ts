import type { ServiceBayPage } from '../../../../domain/ports';
import type { ServiceBay } from '../../../../domain/service-bay/service-bay.entity';

export type ServiceBayResponse = {
  id: string;
  dealershipId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceBayListResponse = {
  total: number;
  items: ServiceBayResponse[];
};

export function toServiceBayResponse(b: ServiceBay): ServiceBayResponse {
  return {
    id: b.id.value,
    dealershipId: b.dealershipId.value,
    label: b.label,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export function toServiceBayListResponse(
  page: ServiceBayPage,
): ServiceBayListResponse {
  return {
    total: page.total,
    items: page.items.map(toServiceBayResponse),
  };
}
