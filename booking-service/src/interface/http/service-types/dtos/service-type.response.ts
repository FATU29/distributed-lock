import type { ServiceTypePage } from '../../../../domain/ports';
import type { ServiceTypeSpec } from '../../../../domain/service-type/service-type-spec.vo';

export type ServiceTypeResponse = {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
  requiredSkillTag: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceTypeListResponse = {
  total: number;
  items: ServiceTypeResponse[];
};

export function toServiceTypeResponse(s: ServiceTypeSpec): ServiceTypeResponse {
  return {
    id: s.id.value,
    code: s.code,
    name: s.name,
    durationMinutes: s.durationMinutes,
    requiredSkillTag: s.requiredSkillTag,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toServiceTypeListResponse(
  page: ServiceTypePage,
): ServiceTypeListResponse {
  return {
    total: page.total,
    items: page.items.map(toServiceTypeResponse),
  };
}
