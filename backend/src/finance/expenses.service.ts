import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  create(user: AuthenticatedUser, data: any) {
    return this.prisma.expense.create({ data: { ...data, createdById: user.id } });
  }

  list(filters: { category?: any; status?: any }) {
    return this.prisma.expense.findMany({
      where: filters,
      include: { area: true, createdBy: true, approvedBy: true },
      orderBy: { incurredAt: 'desc' },
    });
  }

  async approve(id: string, approverId: string, approve: boolean) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found.');
    return this.prisma.expense.update({
      where: { id },
      data: { status: approve ? 'APPROVED' : 'REJECTED', approvedById: approverId },
    });
  }

  async markPaid(id: string) {
    return this.prisma.expense.update({ where: { id }, data: { status: 'PAID' } });
  }
}
