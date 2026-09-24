import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';

const LEADER_ROLE_BY_LEVEL: Record<string, string> = {
  PROVINCE: 'PROVINCE_LEADER',
  DISTRICT: 'DISTRICT_LEADER',
  SECTOR: 'SECTOR_LEADER',
  CELL: 'CELL_LEADER',
  VILLAGE: 'VILLAGE_LEADER',
};

@Injectable()
export class OrgChartService {
  constructor(
    private prisma: PrismaService,
    private geoService: GeoService,
  ) {}

  /** HQ departments (CTO/DAF/Agri Ops/Marketplace/Transport/AI-Data/Support/Compliance/Regional Ops). */
  async departmentTree() {
    const departments = await this.prisma.department.findMany({ include: { head: true } });
    const byParent = new Map<string | null, typeof departments>();
    for (const d of departments) {
      const key = d.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, [] as any);
      (byParent.get(key) as any).push(d);
    }
    const build = (parentId: string | null): any[] =>
      (byParent.get(parentId) ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        head: d.head ? `${d.head.firstName} ${d.head.lastName}` : null,
        children: build(d.id),
      }));
    return build(null);
  }

  /** Geographic org chart node: HQ -> Province -> District -> Sector -> Cell -> Village. */
  async node(areaId: string) {
    const area = await this.prisma.adminArea.findUnique({ where: { id: areaId } });
    if (!area) throw new NotFoundException('Administrative area not found.');

    const leaderRole = LEADER_ROLE_BY_LEVEL[area.level];
    const leaderAssignment = leaderRole
      ? await this.prisma.roleAssignment.findFirst({
          where: { role: leaderRole as any, geoAreaId: areaId, revokedAt: null },
          include: { user: true },
        })
      : null;

    const children = await this.prisma.adminArea.findMany({ where: { parentId: areaId }, orderBy: { name: 'asc' } });
    const stats = await this.geoService.stats(areaId);

    return {
      area,
      leader: leaderAssignment
        ? {
            name: `${leaderAssignment.user.firstName} ${leaderAssignment.user.lastName}`,
            phone: leaderAssignment.user.phone,
            email: leaderAssignment.user.email,
            status: leaderAssignment.user.status,
          }
        : null,
      stats,
      children: children.map((c) => ({ id: c.id, name: c.name, level: c.level, isActive: c.isActive })),
    };
  }

  async root() {
    const country = await this.prisma.adminArea.findFirst({ where: { level: 'COUNTRY' } });
    if (!country) throw new NotFoundException('Country root not found -- seed the geography first.');
    return this.node(country.id);
  }
}
