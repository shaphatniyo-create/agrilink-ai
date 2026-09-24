import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoScopeService } from '../common/geo-scope.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class FarmsService {
  constructor(
    private prisma: PrismaService,
    private geoScope: GeoScopeService,
  ) {}

  /** Farmers see only their own farms; leaders see their jurisdiction; HQ sees all.
   *  Regardless of role, always include farms directly owned by the user. */
  async findAll(user: AuthenticatedUser) {
    if (user.roleNames.includes('FARMER') && !this.geoScope.hasNationalAccess(user)) {
      return this.prisma.farm.findMany({ where: { ownerId: user.id }, include: { farmCrops: true, area: true } });
    }
    const areaIds = await this.geoScope.accessibleAreaIds(user);
    return this.prisma.farm.findMany({
      where: areaIds
        ? { OR: [{ areaId: { in: areaIds } }, { ownerId: user.id }] }
        : undefined,
      include: { farmCrops: true, area: true },
      take: 500,
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const farm = await this.prisma.farm.findUnique({
      where: { id },
      include: { farmCrops: { include: { crop: true } }, area: true, owner: true },
    });
    if (!farm) throw new NotFoundException('Farm not found.');
    if (farm.ownerId !== user.id) {
      const allowed = await this.geoScope.canAccessArea(user, farm.areaId);
      if (!allowed) throw new ForbiddenException('You cannot view this farm.');
    }
    return farm;
  }

  async create(data: { name: string; areaId: string; sizeHectares?: number; soilType?: string; latitude?: number; longitude?: number; isB2B?: boolean }, user: AuthenticatedUser) {
    const area = await this.prisma.adminArea.findUnique({ where: { id: data.areaId } });
    if (!area) throw new NotFoundException('Administrative area not found.');
    if (!area.isActive) {
      throw new ForbiddenException('This area is not yet active for operations.');
    }
    return this.prisma.farm.create({ data: { ...data, ownerId: user.id } });
  }

  async addFarmCrop(
    farmId: string,
    data: { cropId: string; season: string; plantedAreaHa?: number; plantingDate?: Date; expectedHarvestDate?: Date; expectedYieldKg?: number },
    user: AuthenticatedUser,
  ) {
    const farm = await this.findOne(farmId, user);
    const crop = await this.prisma.crop.findUnique({ where: { id: data.cropId } });
    if (!crop) throw new NotFoundException('Crop not found.');
    if (!crop.isActive) {
      throw new ForbiddenException('This crop is not yet activated for the pilot.');
    }
    return this.prisma.farmCrop.create({ data: { ...data, farmId: farm.id } });
  }

  async updateFarmCrop(id: string, data: any, user: AuthenticatedUser) {
    const farmCrop = await this.prisma.farmCrop.findUnique({ where: { id }, include: { farm: true } });
    if (!farmCrop) throw new NotFoundException('Production record not found.');
    if (farmCrop.farm.ownerId !== user.id) {
      const allowed = await this.geoScope.canAccessArea(user, farmCrop.farm.areaId);
      if (!allowed) throw new ForbiddenException('You cannot edit this production record.');
    }
    return this.prisma.farmCrop.update({ where: { id }, data });
  }

  // ---------------------------------------------------------------------
  // GIS: farm boundary / soil / irrigation / crop-health zones.
  // `boundary` is a plain [{lat,lng}, ...] polygon (no PostGIS extension
  // required) -- enough to draw a shape on a map, not for spatial queries.
  // ---------------------------------------------------------------------

  async listZones(farmId: string, user: AuthenticatedUser) {
    await this.findOne(farmId, user); // reuses the same view-authorization as the farm itself
    return this.prisma.farmZone.findMany({ where: { farmId }, orderBy: { createdAt: 'asc' } });
  }

  async addZone(
    farmId: string,
    data: { name: string; zoneType: 'BOUNDARY' | 'SOIL' | 'IRRIGATION' | 'CROP_HEALTH'; boundary: { lat: number; lng: number }[]; notes?: string },
    user: AuthenticatedUser,
  ) {
    if (!data.boundary || data.boundary.length < 3) {
      throw new ForbiddenException('A zone boundary needs at least 3 points to form a shape.');
    }
    await this.findOne(farmId, user);
    return this.prisma.farmZone.create({
      data: { farmId, name: data.name, zoneType: data.zoneType, boundary: data.boundary as any, notes: data.notes },
    });
  }

  async deleteZone(zoneId: string, user: AuthenticatedUser) {
    const zone = await this.prisma.farmZone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new NotFoundException('Zone not found.');
    await this.findOne(zone.farmId, user);
    await this.prisma.farmZone.delete({ where: { id: zoneId } });
    return { success: true };
  }
}
