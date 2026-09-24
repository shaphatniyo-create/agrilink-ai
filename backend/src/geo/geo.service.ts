import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GeoLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const CHILD_LEVEL: Record<GeoLevel, GeoLevel | null> = {
  COUNTRY: 'PROVINCE',
  PROVINCE: 'DISTRICT',
  DISTRICT: 'SECTOR',
  SECTOR: 'CELL',
  CELL: 'VILLAGE',
  VILLAGE: null,
};

@Injectable()
export class GeoService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Root nodes (the country) or children of a given node -- drives the drill-down UI. */
  async children(parentId?: string) {
    if (!parentId) {
      return this.prisma.adminArea.findMany({ where: { level: 'COUNTRY' } });
    }
    return this.prisma.adminArea.findMany({
      where: { parentId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const area = await this.prisma.adminArea.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Administrative area not found.');
    return area;
  }

  /** Breadcrumb from root (country) down to this area. */
  async path(id: string) {
    const trail: any[] = [];
    let current = await this.findOne(id);
    trail.unshift(current);
    while (current.parentId) {
      current = await this.findOne(current.parentId);
      trail.unshift(current);
    }
    return trail;
  }

  async listByLevel(level: GeoLevel, activeOnly = false) {
    return this.prisma.adminArea.findMany({
      where: { level, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: {
    level: GeoLevel;
    code: string;
    name: string;
    nameLocal?: string;
    parentId?: string;
    latitude?: number;
    longitude?: number;
    population?: number;
  }) {
    if (data.parentId) {
      const parent = await this.findOne(data.parentId);
      if (CHILD_LEVEL[parent.level] !== data.level) {
        throw new BadRequestException(
          `A ${parent.level} node's children must be level ${CHILD_LEVEL[parent.level]}.`,
        );
      }
    }
    return this.prisma.adminArea.create({ data });
  }

  /**
   * ACTIVE DEPLOYMENT AREAS toggle. Super Admin only (enforced at controller
   * level via @Roles). Deactivating a node does NOT cascade-delete its
   * children's own isActive flags -- each level is toggled independently so
   * operators can, e.g., keep a district active while pausing one sector.
   */
  async setActive(id: string, active: boolean, actorUserId: string, cascade = false) {
    const area = await this.findOne(id);
    const now = new Date();
    await this.prisma.adminArea.update({
      where: { id },
      data: active
        ? { isActive: true, activatedAt: now, activatedBy: actorUserId, deactivatedAt: null }
        : { isActive: false, deactivatedAt: now },
    });

    if (cascade) {
      // Cascade to all descendants (useful for "activate this whole district").
      const toVisit = [id];
      while (toVisit.length) {
        const parentId = toVisit.pop()!;
        const kids = await this.prisma.adminArea.findMany({ where: { parentId } });
        for (const kid of kids) {
          await this.prisma.adminArea.update({
            where: { id: kid.id },
            data: active
              ? { isActive: true, activatedAt: now, activatedBy: actorUserId, deactivatedAt: null }
              : { isActive: false, deactivatedAt: now },
          });
          toVisit.push(kid.id);
        }
      }
    }

    await this.audit.log(actorUserId, active ? 'AREA_ACTIVATED' : 'AREA_DEACTIVATED', 'AdminArea', id, {
      cascade,
      areaName: area.name,
      level: area.level,
    });
    return this.findOne(id);
  }

  /** Quick stats for org-chart / drill-down cards. */
  async stats(areaId: string) {
    const descendantIds = await this.descendantIds(areaId);
    const allIds = [areaId, ...descendantIds];
    const [farmerCount, farmCount, listingCount, orderCount, revenue] = await Promise.all([
      this.prisma.roleAssignment.count({ where: { role: 'FARMER', geoAreaId: { in: allIds } } }),
      this.prisma.farm.count({ where: { areaId: { in: allIds } } }),
      this.prisma.marketplaceListing.count({ where: { areaId: { in: allIds } } }),
      this.prisma.order.count({ where: { listing: { areaId: { in: allIds } } } }),
      this.prisma.order.aggregate({
        where: { listing: { areaId: { in: allIds } }, status: 'COMPLETED' },
        _sum: { totalAmount: true, commissionAmount: true },
      }),
    ]);
    return {
      farmerCount,
      farmCount,
      listingCount,
      orderCount,
      totalRevenue: revenue._sum.totalAmount ?? 0,
      totalCommission: revenue._sum.commissionAmount ?? 0,
    };
  }

  async descendantIds(areaId: string): Promise<string[]> {
    const result: string[] = [];
    let frontier = [areaId];
    while (frontier.length) {
      const kids = await this.prisma.adminArea.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = kids.map((k) => k.id);
      result.push(...frontier);
    }
    return result;
  }
}
