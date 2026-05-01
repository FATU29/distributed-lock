import type { TechnicianPage } from '../../../../domain/ports';
import type { Technician } from '../../../../domain/technician/technician.entity';

export type TechnicianResponse = {
  id: string;
  dealershipId: string;
  name: string;
  qualifiedServiceTypeIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type TechnicianListResponse = {
  total: number;
  items: TechnicianResponse[];
};

export function toTechnicianResponse(t: Technician): TechnicianResponse {
  return {
    id: t.id.value,
    dealershipId: t.dealershipId.value,
    name: t.name,
    qualifiedServiceTypeIds: t.qualifiedServiceTypeIds.map((x) => x.value),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function toTechnicianListResponse(
  page: TechnicianPage,
): TechnicianListResponse {
  return {
    total: page.total,
    items: page.items.map(toTechnicianResponse),
  };
}
