import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionsService } from '../commissions/commissions.service';
import { AuthenticatedUser } from '../auth/auth.types';

const round = (n: number) => Math.round(n);

@Injectable()
export class TransportService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
  ) {}

  // ---- Vehicles ----
  registerVehicle(user: AuthenticatedUser, data: any) {
    return this.prisma.vehicle.create({ data: { ...data, transporterId: user.id } });
  }

  myVehicles(user: AuthenticatedUser) {
    return this.prisma.vehicle.findMany({ where: { transporterId: user.id } });
  }

  // ---- Configurable fee schedule (Super Admin / DAF) ----
  listFeeConfig() {
    return this.prisma.transportFeeConfig.findMany({ where: { active: true } });
  }

  upsertFeeConfig(data: any) {
    return this.prisma.transportFeeConfig.create({ data });
  }

  // ---- Requests ----
  createRequest(user: AuthenticatedUser, data: any) {
    return this.prisma.transportRequest.create({ data: { ...data, requesterId: user.id } });
  }

  availableJobs() {
    return this.prisma.transportRequest.findMany({
      where: { status: 'REQUESTED' },
      include: { pickupArea: true, destinationArea: true, crop: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Transport costing engine: base + distance + weight/load + vehicle +
   * loading + unloading + waiting + special-handling + cold-chain fees, all
   * pulled from the configurable TransportFeeConfig (never hard-coded), then
   * AgriLink's transport commission (DAF-configurable) is added on top to
   * produce the customer price. See spec section 20.
   */
  async submitQuote(
    user: AuthenticatedUser,
    requestId: string,
    input: { vehicleId?: string; waitingHours?: number },
  ) {
    const request = await this.prisma.transportRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Transport request not found.');
    if (request.status !== 'REQUESTED' && request.status !== 'QUOTED') {
      throw new BadRequestException('This request is no longer open for quotes.');
    }

    const vehicleType = request.vehicleTypeRequired ?? 'PICKUP';
    const feeConfig = await this.prisma.transportFeeConfig.findFirst({
      where: { vehicleType, active: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!feeConfig) {
      throw new BadRequestException(`No transport fee configuration for vehicle type ${vehicleType}.`);
    }

    const distanceKm = request.distanceKm ?? 0;
    const weightKg = request.weightKg;
    const waitingHours = input.waitingHours ?? 0;

    const baseFee = feeConfig.baseFeeRwf;
    const distanceFee = round(distanceKm * feeConfig.perKmFeeRwf);
    const weightFee = round(weightKg * feeConfig.perKgFeeRwf);
    const loadingFee = feeConfig.loadingFeeRwf;
    const unloadingFee = feeConfig.unloadingFeeRwf;
    const waitingFee = round(waitingHours * feeConfig.waitingFeePerHourRwf);
    const coldChainFee = request.requiresColdChain ? feeConfig.coldChainFeeRwf : 0;
    const specialHandlingFee = 0; // reserved for per-request surcharge negotiation

    const transportCost = round(
      baseFee + distanceFee + weightFee + loadingFee + unloadingFee + waitingFee + coldChainFee + specialHandlingFee,
    );

    const quote = await this.commissions.quote('TRANSPORT', transportCost);

    const created = await this.prisma.transportQuote.create({
      data: {
        requestId,
        transporterId: user.id,
        vehicleId: input.vehicleId,
        baseFee,
        distanceFee,
        weightFee,
        vehicleFee: 0,
        loadingFee,
        unloadingFee,
        waitingFee,
        specialHandlingFee,
        coldChainFee,
        transportCost,
        commissionRuleId: quote.ruleId,
        commissionAmount: quote.commissionAmount,
        customerPrice: quote.buyerPays,
      },
    });

    if (request.status === 'REQUESTED') {
      await this.prisma.transportRequest.update({ where: { id: requestId }, data: { status: 'QUOTED' } });
    }
    return created;
  }

  async acceptQuote(quoteId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.transportQuote.findUnique({ where: { id: quoteId }, include: { request: true } });
    if (!quote) throw new NotFoundException('Quote not found.');
    if (quote.request.requesterId !== user.id) throw new ForbiddenException('Not your request.');

    await this.prisma.$transaction([
      this.prisma.transportQuote.update({ where: { id: quoteId }, data: { accepted: true } }),
      this.prisma.transportRequest.update({ where: { id: quote.requestId }, data: { status: 'ACCEPTED' } }),
      this.prisma.commissionTransaction.create({
        data: {
          ruleId: quote.commissionRuleId!,
          transportQuoteId: quote.id,
          grossAmount: quote.transportCost,
          commissionAmount: quote.commissionAmount,
          status: 'PENDING',
        },
      }),
    ]);
    return this.prisma.transportQuote.findUnique({ where: { id: quoteId } });
  }

  async updateRequestStatus(requestId: string, status: string, user: AuthenticatedUser) {
    const request = await this.prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: { quotes: { where: { accepted: true } } },
    });
    if (!request) throw new NotFoundException('Transport request not found.');
    const acceptedQuote = request.quotes[0];
    const isTransporter = acceptedQuote?.transporterId === user.id;
    const isRequester = request.requesterId === user.id;
    if (!isTransporter && !isRequester) throw new ForbiddenException('Not part of this delivery.');

    const updated = await this.prisma.transportRequest.update({
      where: { id: requestId },
      data: { status: status as any },
    });
    if (status === 'DELIVERED' && acceptedQuote) {
      await this.prisma.commissionTransaction.updateMany({
        where: { transportQuoteId: acceptedQuote.id },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
    }
    return updated;
  }

  // ---- Transporter dashboard ----
  async transporterDashboard(user: AuthenticatedUser) {
    const [acceptedJobs, completedJobs, earningsAgg, vehicles] = await Promise.all([
      this.prisma.transportQuote.findMany({
        where: { transporterId: user.id, accepted: true, request: { status: { in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'] } } },
        include: { request: true },
      }),
      this.prisma.transportQuote.findMany({
        where: { transporterId: user.id, accepted: true, request: { status: 'DELIVERED' } },
        include: { request: true },
      }),
      this.prisma.transportQuote.aggregate({
        where: { transporterId: user.id, accepted: true, request: { status: 'DELIVERED' } },
        _sum: { transportCost: true, commissionAmount: true },
      }),
      this.prisma.vehicle.findMany({ where: { transporterId: user.id } }),
    ]);
    return {
      activeDeliveries: acceptedJobs,
      completedDeliveries: completedJobs,
      totalEarnings: earningsAgg._sum.transportCost ?? 0,
      totalCommissionPaid: earningsAgg._sum.commissionAmount ?? 0,
      vehicles,
    };
  }
}
