import { UserRole } from '@prisma/client';

export interface RoleScope {
  role: UserRole;
  geoAreaId: string | null;
  departmentId: string | null;
}

/** Shape attached to `request.user` after JwtAuthGuard runs. */
export interface AuthenticatedUser {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
  status: string;
  roles: RoleScope[];
  /** Convenience flat list, e.g. ['SUPER_ADMIN', 'DISTRICT_LEADER'] */
  roleNames: UserRole[];
}
