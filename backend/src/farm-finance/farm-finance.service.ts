import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from '../farms/farms.service';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * Per-farm bookkeeping ("Farm budgeting, expense tracking, income tracking,
 * profit analysis, digital bookkeeping, cash flow forecasting") -- distinct
 * from FinanceService, which tracks AgriLink's own platform revenue/DAF
 * dashboard. Authorization is delegated to FarmsService.findOne (same rule
 * as viewing the farm itself: owner, or a leader/HQ within jurisdiction).
 */
@Injectable()
export class FarmFinanceService {
  constructor(
    private prisma: PrismaService,
    private farms: FarmsService,
  ) {}

  async recordExpense(farmId: string, data: { category: string; amount: number; note?: string; incurredAt?: string }, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    return this.prisma.farmExpense.create({
      data: {
        farmId,
        category: data.category,
        amount: data.amount,
        note: data.note,
        incurredAt: data.incurredAt ? new Date(data.incurredAt) : undefined,
        createdById: user.id,
      },
    });
  }

  async recordIncome(farmId: string, data: { source: string; amount: number; note?: string; receivedAt?: string }, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    return this.prisma.farmIncome.create({
      data: {
        farmId,
        source: data.source,
        amount: data.amount,
        note: data.note,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined,
        createdById: user.id,
      },
    });
  }

  async listExpenses(farmId: string, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    return this.prisma.farmExpense.findMany({ where: { farmId }, orderBy: { incurredAt: 'desc' }, take: 500 });
  }

  async listIncome(farmId: string, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    return this.prisma.farmIncome.findMany({ where: { farmId }, orderBy: { receivedAt: 'desc' }, take: 500 });
  }

  /**
   * Income - expense = net result, broken down by category, plus a naive
   * cash-flow forecast: this season's average monthly net, projected forward
   * 3 months. A real forecast would weight by planting/harvest calendar;
   * this is an honest, simple baseline until richer data justifies more.
   */
  async summary(farmId: string, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    const [expenses, income] = await Promise.all([
      this.prisma.farmExpense.findMany({ where: { farmId } }),
      this.prisma.farmIncome.findMany({ where: { farmId } }),
    ]);

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
    const net = totalIncome - totalExpense;

    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount;
    const incomeBySource: Record<string, number> = {};
    for (const i of income) incomeBySource[i.source] = (incomeBySource[i.source] ?? 0) + i.amount;

    const monthsSpanned = this.monthsSpanned([...expenses.map((e) => e.incurredAt), ...income.map((i) => i.receivedAt)]);
    const avgMonthlyNet = monthsSpanned > 0 ? net / monthsSpanned : 0;
    const cashFlowForecast = [1, 2, 3].map((monthsAhead) => ({
      monthsAhead,
      projectedNet: Math.round(net + avgMonthlyNet * monthsAhead),
    }));

    return {
      totalIncome,
      totalExpense,
      net,
      expenseByCategory,
      incomeBySource,
      avgMonthlyNet: Math.round(avgMonthlyNet),
      cashFlowForecast,
      transactionCount: expenses.length + income.length,
    };
  }

  private monthsSpanned(dates: Date[]): number {
    if (dates.length === 0) return 0;
    const times = dates.map((d) => d.getTime());
    const spanMs = Math.max(...times) - Math.min(...times);
    return Math.max(1, Math.round(spanMs / (30 * 24 * 3600 * 1000)));
  }

  /** Dependency-free CSV export (no new npm package needed) -- combined income + expense ledger for a farm. */
  async exportCsv(farmId: string, user: AuthenticatedUser): Promise<string> {
    await this.farms.findOne(farmId, user);
    const [expenses, income] = await Promise.all([
      this.prisma.farmExpense.findMany({ where: { farmId }, orderBy: { incurredAt: 'asc' } }),
      this.prisma.farmIncome.findMany({ where: { farmId }, orderBy: { receivedAt: 'asc' } }),
    ]);

    const header = ['Date', 'Type', 'Category / Source', 'Amount (RWF)', 'Note'];
    const dataRows: string[][] = [];
    for (const e of expenses) dataRows.push([e.incurredAt.toISOString().slice(0, 10), 'Expense', e.category, String(-e.amount), e.note ?? '']);
    for (const i of income) dataRows.push([i.receivedAt.toISOString().slice(0, 10), 'Income', i.source, String(i.amount), i.note ?? '']);
    dataRows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

    const needsQuoting = (cell: string) => cell.includes('"') || cell.includes(',') || cell.includes('\n');
    const escape = (cell: string) => (needsQuoting(cell) ? `"${cell.split('"').join('""')}"` : cell);
    return [header, ...dataRows].map((row) => row.map(escape).join(',')).join('\n');
  }
}
