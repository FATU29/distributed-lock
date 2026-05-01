import type { UserProfile, UserProfilePage } from '../../../../domain/ports';

export type VehicleResponse = {
  id: string;
  vin: string;
  label: string | null;
};

export type UserResponse = {
  id: string;
  email: string;
  displayName: string | null;
  customerId: string;
  vehicles: VehicleResponse[];
};

export type UserListResponse = {
  total: number;
  items: UserResponse[];
};

export function toUserResponse(profile: UserProfile): UserResponse {
  return {
    id: profile.user.id.value,
    email: profile.user.email,
    displayName: profile.user.displayName,
    customerId: profile.customer.id.value,
    vehicles: profile.vehicles.map((v) => ({
      id: v.id.value,
      vin: v.vin.value,
      label: v.label,
    })),
  };
}

export function toUserListResponse(page: UserProfilePage): UserListResponse {
  return {
    total: page.total,
    items: page.items.map(toUserResponse),
  };
}
