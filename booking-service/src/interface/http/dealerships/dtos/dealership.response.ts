import type { DealershipPage } from '../../../../domain/ports';
import type { Dealership } from '../../../../domain/dealership/dealership.entity';

export type DealershipResponse = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type DealershipListResponse = {
  total: number;
  items: DealershipResponse[];
};

export function toDealershipResponse(d: Dealership): DealershipResponse {
  return {
    id: d.id.value,
    code: d.code,
    name: d.name,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export function toDealershipListResponse(
  page: DealershipPage,
): DealershipListResponse {
  return {
    total: page.total,
    items: page.items.map(toDealershipResponse),
  };
}
