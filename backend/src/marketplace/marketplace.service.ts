import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionsService } from '../commissions/commissions.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { GeoScopeService } from '../common/geo-scope.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
    private geoScope: GeoScopeService,
  ) {}

  async listListings(filters: { cropId?: string; areaId?: string; status?: string }) {
    return this.prisma.marketplaceListing.findMany({
      where: {
        cropId: filters.cropId,
        areaId: filters.areaId,
        status: (filters.status as any) ?? 'ACTIVE',
      },
      include: { crop: true, seller: true, area: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getListing(id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      include: { crop: true, seller: true, area: true },
    });
    if (!listing) throw new NotFoundException('Listing not found.');
    return listing;
  }

  async createListing(user: AuthenticatedUser, data: any) {
    const [crop, area] = await Promise.all([
      this.prisma.crop.findUnique({ where: { id: data.cropId } }),
      this.prisma.adminArea.findUnique({ where: { id: data.areaId } }),
    ]);
    if (!crop?.isActive) throw new ForbiddenException('This crop is not yet activated for the pilot.');
    if (!area?.isActive) throw new ForbiddenException('This area is not yet active for operations.');
    return this.prisma.marketplaceListing.create({
      data: { ...data, sellerId: user.id, status: data.status ?? 'ACTIVE' },
    });
  }

  async updateListing(id: string, user: AuthenticatedUser, data: any) {
    const listing = await this.getListing(id);
    if (listing.sellerId !== user.id) throw new ForbiddenException('Not your listing.');
    return this.prisma.marketplaceListing.update({ where: { id }, data });
  }

  /**
   * Places an order against a listing and settles the marketplace commission
   * per the currently-configured CommissionRule for MARKETPLACE (percentage,
   * fixed fee, min/max, payer model - all DAF-configurable, nothing hard-coded).
   */
  async createOrder(user: AuthenticatedUser, data: { listingId: string; quantity: number }) {
    const listing = await this.getListing(data.listingId);
    if (listing.status !== 'ACTIVE') throw new BadRequestException('Listing is not available.');
    if (data.quantity <= 0 || data.quantity > listing.quantity) {
      throw new BadRequestException('Invalid order quantity.');
    }

    const gross = round(data.quantity * listing.pricePerUnit);
    const areaAncestry = await this.areaAncestryIds(listing.areaId);
    const quote = await this.commissions.quote('MARKETPLACE', gross, {
      areaIds: areaAncestry,
      cropId: listing.cropId,
    });

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId: user.id,
          sellerId: listing.sellerId,
          quantity: data.quantity,
          unitPrice: listing.pricePerUnit,
          totalAmount: gross,
          commissionRuleId: quote.ruleId,
          commissionAmount: quote.commissionAmount,
          sellerReceives: quote.sellerReceives,
          buyerPays: quote.buyerPays,
          status: 'PENDING',
        },
      });

      const remaining = listing.quantity - data.quantity;
      await tx.marketplaceListing.update({
        where: { id: listing.id },
        data: { quantity: remaining, status: remaining <= 0 ? 'RESERVED' : listing.status },
      });

      await tx.commissionTransaction.create({
        data: {
          ruleId: quote.ruleId,
          orderId: created.id,
          grossAmount: gross,
          commissionAmount: quote.commissionAmount,
          status: 'PENDING',
        },
      });

      return created;
    });

    return order;
  }

  async updateOrderStatus(orderId: string, status: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.buyerId !== user.id && order.sellerId !== user.id && !this.geoScope.hasNationalAccess(user)) {
      throw new ForbiddenException('Not your order.');
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: status as any,
        completedAt: status === 'COMPLETED' ? new Date() : order.completedAt,
      },
    });
    if (status === 'COMPLETED') {
      await this.prisma.commissionTransaction.updateMany({
        where: { orderId },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
      await this.prisma.marketplaceListing.update({
        where: { id: order.listingId },
        data: { status: 'SOLD' },
      });
    }
    return updated;
  }

  myOrders(user: AuthenticatedUser) {
    return this.prisma.order.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: { listing: { include: { crop: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async areaAncestryIds(areaId: string): Promise<string[]> {
    const ids: string[] = [];
    let current = await this.prisma.adminArea.findUnique({ where: { id: areaId } });
    while (current) {
      ids.push(current.id);
      current = current.parentId
        ? await this.prisma.adminArea.findUnique({ where: { id: current.parentId } })
        : null;
    }
    return ids;
  }
}

const round = (n: number) => Math.round(n);
