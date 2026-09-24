import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * HQ / national roles that are never geographically scoped -- they see
 * every province/district/sector/cell/village regardless of activation.
 */
export const HQ_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'CEO',
  'DAF',
  'CTO',
  'AGRICULTURE_MANAGER',
  'FINANCE_MANAGER',
];

const LEADER_ROLES: UserRole[] = [
  'PROVINCE_LEADER',
  'DISTRICT_LEADER',
  'SECTOR_LEADER',
  'CELL_LEADER',
  'VILLAGE_LEADER',
];

@Injectable()
export class GeoScopeService {
  constructor(private prisma: PrismaService) {}

  hasNationalAccess(user: AuthenticatedUser): boolean {
    return user.roleNames.some((r) => HQ_ROLES.includes(r));
  }

  /**
   * Returns the list of AdminArea ids the user administers directly
   * (from their leader role assignments). Empty for HQ roles (national access)
   * and for non-leader roles (farmer/buyer/etc. -- scoped to their own records instead).
   */
  leaderAreaIds(user: AuthenticatedUser): string[] {
    return user.roles
      .filter((r) => LEADER_ROLES.includes(r.role) && r.geoAreaId)
      .map((r) => r.geoAreaId as string);
  }

  /**
   * Walks up from `areaId` to the root, returning true if `candidateAreaIds`
   * contains the area itself or any ancestor (i.e. the leader's jurisdiction
   * covers this area).
   */
  async isAreaWithinJurisdiction(areaId: string, candidateAreaIds: string[]): Promise<boolean> {
    if (candidateAreaIds.length === 0) return false;
    let current = await this.prisma.adminArea.findUnique({ where: { id: areaId } });
    const visited = new Set<string>();
    while (current) {
      if (candidateAreaIds.includes(current.id)) return true;
      if (!current.parentId || visited.has(current.parentId)) return false;
      visited.add(current.parentId);
      current = await this.prisma.adminArea.findUnique({ where: { id: current.parentId } });
    }
    return false;
  }

  /**
   * Returns true if `user` may act on data located at `areaId`:
   * national HQ roles always can; leader roles only within their jurisdiction
   * (their assigned area or any descendant of it).
   */
  async canAccessArea(user: AuthenticatedUser, areaId: string): Promise<boolean> {
    if (this.hasNationalAccess(user)) return true;
    const jurisdiction = this.leaderAreaIds(user);
    if (jurisdiction.length === 0) return false;
    // Leader's jurisdiction covers descendants of their assigned area, so we
    // walk up from the target area looking for a match in the leader's areas.
    return this.isAreaWithinJurisdiction(areaId, jurisdiction);
  }

  /**
   * Returns the set of AdminArea ids (self + all descendants) a leader
   * governs, for building "WHERE areaId IN (...)" aggregation queries.
   * Returns null for national-access users (meaning: no filter needed).
   */
  async accessibleAreaIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (this.hasNationalAccess(user)) return null;
    const roots = this.leaderAreaIds(user);
    if (roots.length === 0) return [];
    const result = new Set<string>(roots);
    let frontier = roots;
    while (frontier.length > 0) {
      const children = await this.prisma.adminArea.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id).filter((id) => !result.has(id));
      frontier.forEach((id) => result.add(id));
    }
    return Array.from(result);
  }

  /** Only ACTIVE areas (and active ancestors) are considered operational. */
  async isAreaActive(areaId: string): Promise<boolean> {
    const area = await this.prisma.adminArea.findUnique({ where: { id: areaId } });
    return !!area?.isActive;
  }
}
