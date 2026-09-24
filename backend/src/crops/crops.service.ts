import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CropsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll(activeOnly = false) {
    return this.prisma.crop.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const crop = await this.prisma.crop.findUnique({ where: { id } });
    if (!crop) throw new NotFoundException('Crop not found.');
    return crop;
  }

  create(data: any) {
    return this.prisma.crop.create({ data: { ...data, isActive: false } });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.crop.update({ where: { id }, data });
  }

  /** Pilot crop activation system -- Super Admin / Agriculture Manager only. */
  async setActive(id: string, active: boolean, actorUserId: string) {
    await this.findOne(id);
    const crop = await this.prisma.crop.update({
      where: { id },
      data: active
        ? { isActive: true, activatedAt: new Date(), activatedBy: actorUserId }
        : { isActive: false },
    });
    await this.audit.log(actorUserId, active ? 'CROP_ACTIVATED' : 'CROP_DEACTIVATED', 'Crop', id);
    return crop;
  }
}
