import { Injectable, NotFoundException } from '@nestjs/common';
import { CommissionTxStatus, Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { computeCommission, CommissionResult } from './commission-engine';

@Injectable()
export class CommissionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ---- Rule management (DAF / Super Admin configure; no hard-coded rates) ----

  listRules(serviceType?: ServiceType) {
    return this.prisma.commissionRule.findMany({
      where: serviceType ? { serviceType } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(data: Prisma.CommissionRuleUncheckedCreateInput, actorUserId: string) {
    const rule = await this.prisma.commissionRule.create({
      data: { ...data, createdById: actorUserId },
    });
    await this.audit.log(actorUserId, 'COMMISSION_RULE_CREATED', 'CommissionRule', rule.id, {
      name: rule.name,
    });
    return rule;
  }

  async updateRule(id: string, data: Prisma.CommissionRuleUncheckedUpdateInput, actorUserId: string) {
    const existing = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Commission rule not found.');
    const rule = await this.prisma.commissionRule.update({ where: { id }, data });
    await this.audit.log(actorUserId, 'COMMISSION_RULE_UPDATED', 'CommissionRule', id);
    return rule;
  }

  async approveRule(id: string, actorUserId: string) {
    return this.prisma.commissionRule.update({ where: { id }, data: { approvedById: actorUserId } });
  }

  /**
   * Finds the single best-matching active rule for a service type + optional
   * geographic/crop context. Specificity order: geo+crop match > geo-only >
   * crop-only > fully national/generic rule. Ties broken by most recent.
   */
  async resolveRule(serviceType: ServiceType, opts: { areaIds?: string[]; cropId?: string } = {}) {
    const now = new Date();
    const candidates = await this.prisma.commissionRule.findMany({
      where: {
        serviceType,
        active: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const matches = candidates.filter((rule) => {
      const geoOk =
        !rule.geographicScope ||
        (Array.isArray(rule.geographicScope) &&
          (opts.areaIds ?? []).some((id) => (rule.geographicScope as string[]).includes(id)));
      const cropOk =
        !rule.cropScope ||
        (Array.isArray(rule.cropScope) &&
          opts.cropId &&
          (rule.cropScope as string[]).includes(opts.cropId));
      return geoOk && cropOk;
    });

    if (matches.length === 0) {
      throw new NotFoundException(
        `No active commission rule configured for ${serviceType}. Ask DAF/Super Admin to create one.`,
      );
    }

    const specificity = (r: (typeof matches)[number]) =>
      (r.geographicScope ? 1 : 0) + (r.cropScope ? 1 : 0);
    matches.sort((a, b) => specificity(b) - specificity(a));
    return matches[0];
  }

  async quote(
    serviceType: ServiceType,
    grossAmount: number,
    opts: { areaIds?: string[]; cropId?: string } = {},
  ): Promise<{ ruleId: string } & CommissionResult> {
    const rule = await this.resolveRule(serviceType, opts);
    const result = computeCommission(grossAmount, rule);
    return { ruleId: rule.id, ...result };
  }

  async recordTransaction(params: {
    ruleId: string;
    grossAmount: number;
    commissionAmount: number;
    orderId?: string;
    inputOrderId?: string;
    transportQuoteId?: string;
    status?: CommissionTxStatus;
  }) {
    return this.prisma.commissionTransaction.create({
      data: {
        ruleId: params.ruleId,
        grossAmount: params.grossAmount,
        commissionAmount: params.commissionAmount,
        orderId: params.orderId,
        inputOrderId: params.inputOrderId,
        transportQuoteId: params.transportQuoteId,
        status: params.status ?? 'ACCRUED',
      },
    });
  }

  ledger(filters: { status?: CommissionTxStatus; from?: Date; to?: Date } = {}) {
    return this.prisma.commissionTransaction.findMany({
      where: {
        status: filters.status,
        createdAt:
          filters.from || filters.to
            ? { gte: filters.from, lte: filters.to }
            : undefined,
      },
      include: { rule: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
