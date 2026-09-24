import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Restrict an endpoint to the given roles. Combine with RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Marks an endpoint as public (skips JwtAuthGuard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Marks an endpoint as geo-scoped: the resolved AdminArea id must be supplied
 * via the named request param/query/body key, and GeoScopeGuard will verify
 * the current user's role assignments cover that area (or a parent of it).
 */
export const GEO_SCOPE_PARAM_KEY = 'geoScopeParam';
export const GeoScoped = (paramName = 'areaId') => SetMetadata(GEO_SCOPE_PARAM_KEY, paramName);
