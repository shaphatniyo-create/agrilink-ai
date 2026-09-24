import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfWeek = (d = new Date()) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
};
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1);

@Injectable()
export class DafDashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * DAF dashboard: revenue, commission, payments, expenses, and the
   * gross-to-net operating result. AgriLink's *revenue* here is what the
   * revenue engine actually earns (settled commissions + subscription +
   * advertising income) -- never conflated with marketplace GMV, and this
   * result is explicitly the "Net Operating Result", not "profit" (spec 16).
   */
  async overview() {
    const now = new Date();
    const [
      commissionByPeriod,
      commissionByService,
      subscriptionRevenue,
      adRevenue,
      paymentsByStatus,
      expensesByCategory,
      refundsTotal,
    ] = await Promise.all([
      this.commissionSumSince(startOfDay(now)),
      this.prisma.commissionTransaction.groupBy({
        by: ['ruleId'],
        where: { status: 'SETTLED' },
        _sum: { commissionAmount: true },
      }),
      this.prisma.subscriptionPayment.aggregate({ _sum: { amount: true } }),
      this.prisma.adCampaign.aggregate({ _sum: { spentRwf: true } }),
      this.prisma.paymentTransaction.groupBy({
        by: ['status'],
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: { status: { in: ['APPROVED', 'PAID'] } },
        _sum: { amountRwf: true },
      }),
      this.prisma.paymentRefund.aggregate({ _sum: { amount: true } }),
    ]);

    const [today, week, month, year, allTime] = await Promise.all([
      this.commissionSumSince(startOfDay(now)),
      this.commissionSumSince(startOfWeek(now)),
      this.commissionSumSince(startOfMonth(now)),
      this.commissionSumSince(startOfYear(now)),
      this.commissionSumSince(new Date(0)),
    ]);

    const commissionRevenue = allTime;
    const subscriptionRevenueTotal = subscriptionRevenue._sum.amount ?? 0;
    const adRevenueTotal = adRevenue._sum.spentRwf ?? 0;
    const grossRevenue = commissionRevenue + subscriptionRevenueTotal + adRevenueTotal;

    const operatingExpenses = expensesByCategory.reduce((sum, e) => sum + (e._sum.amountRwf ?? 0), 0);
    const refunds = refundsTotal._sum.amount ?? 0;
    // Payment gateway fees and third-party commission payable are integration
    // points for when a live provider fee schedule / partner-payout ledger
    // exists; kept at 0 here rather than hard-coding a placeholder rate.
    const paymentFees = 0;
    const commissionPayable = 0;
    const netOperatingResult = grossRevenue - refunds - paymentFees - commissionPayable - operatingExpenses;

    return {
      revenue: { today, week, month, year, allTime: grossRevenue },
      commission: {
        total: commissionRevenue,
        subscriptionRevenue: subscriptionRevenueTotal,
        advertisingRevenue: adRevenueTotal,
      },
      payments: paymentsByStatus.map((p) => ({ status: p.status, count: p._count, total: p._sum.amount ?? 0 })),
      expenses: {
        byCategory: expensesByCategory.map((e) => ({ category: e.category, total: e._sum.amountRwf ?? 0 })),
        total: operatingExpenses,
      },
      profitability: {
        grossRevenue,
        refunds,
        paymentFees,
        commissionPayable,
        operatingExpenses,
        netOperatingResult,
      },
    };
  }

  async revenueByArea(level: 'PROVINCE' | 'DISTRICT') {
    const areas = await this.prisma.adminArea.findMany({ where: { level } });
    const results = [] as { areaId: string; name: string; revenue: number; commission: number }[];
    for (const area of areas) {
      const descendantIds = await this.descendantIds(area.id);
      const allIds = [area.id, ...descendantIds];
      const agg = await this.prisma.order.aggregate({
        where: { listing: { areaId: { in: allIds } }, status: 'COMPLETED' },
        _sum: { totalAmount: true, commissionAmount: true },
      });
      results.push({
        areaId: area.id,
        name: area.name,
        revenue: agg._sum.totalAmount ?? 0,
        commission: agg._sum.commissionAmount ?? 0,
      });
    }
    return results;
  }

  private async commissionSumSince(date: Date) {
    const agg = await this.prisma.commissionTransaction.aggregate({
      where: { status: 'SETTLED', settledAt: { gte: date } },
      _sum: { commissionAmount: true },
    });
    return agg._sum.commissionAmount ?? 0;
  }

  private async descendantIds(areaId: string): Promise<string[]> {
    const result: string[] = [];
    let frontier = [areaId];
    while (frontier.length) {
      const kids = await this.prisma.adminArea.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
      frontier = kids.map((k) => k.id);
      result.push(...frontier);
    }
    return result;
  }
}
