import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionsService } from '../commissions/commissions.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class InputsService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
  ) {}

  listProducts(category?: any) {
    return this.prisma.inputProduct.findMany({
      where: { active: true, category },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProduct(user: AuthenticatedUser, data: any) {
    return this.prisma.inputProduct.create({ data: { ...data, supplierId: user.id } });
  }

  async createOrder(user: AuthenticatedUser, data: { productId: string; quantity: number }) {
    const product = await this.prisma.inputProduct.findUnique({ where: { id: data.productId } });
    if (!product || !product.active) throw new NotFoundException('Product not found.');
    if (data.quantity <= 0 || data.quantity > product.stockQuantity) {
      throw new BadRequestException('Invalid quantity requested.');
    }
    const gross = Math.round(data.quantity * product.price);
    const quote = await this.commissions.quote('INPUT_SALE', gross);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.inputOrder.create({
        data: {
          productId: product.id,
          buyerId: user.id,
          quantity: data.quantity,
          totalAmount: gross,
          commissionRuleId: quote.ruleId,
          commissionAmount: quote.commissionAmount,
          supplierReceives: quote.sellerReceives,
          status: 'PENDING',
        },
      });
      await tx.inputProduct.update({
        where: { id: product.id },
        data: { stockQuantity: product.stockQuantity - data.quantity },
      });
      await tx.commissionTransaction.create({
        data: {
          ruleId: quote.ruleId,
          inputOrderId: order.id,
          grossAmount: gross,
          commissionAmount: quote.commissionAmount,
          status: 'PENDING',
        },
      });
      return order;
    });
  }

  async updateOrderStatus(id: string, status: string, user: AuthenticatedUser) {
    const order = await this.prisma.inputOrder.findUnique({ where: { id }, include: { product: true } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.buyerId !== user.id && order.product.supplierId !== user.id) {
      throw new ForbiddenException('Not your order.');
    }
    const updated = await this.prisma.inputOrder.update({ where: { id }, data: { status: status as any } });
    if (status === 'DELIVERED') {
      await this.prisma.commissionTransaction.updateMany({
        where: { inputOrderId: id },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
    }
    return updated;
  }

  myOrders(user: AuthenticatedUser) {
    return this.prisma.inputOrder.findMany({
      where: { buyerId: user.id },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
