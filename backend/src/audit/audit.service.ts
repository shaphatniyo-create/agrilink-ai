import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
  ) {
    await this.prisma.auditLog.create({
      data: { userId, action, entityType, entityId, metadata: metadata as any, ipAddress },
    });
  }
}
