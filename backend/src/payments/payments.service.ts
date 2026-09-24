import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { MockPaymentAdapter } from './adapters/mock.adapter';
import { MtnMomoAdapter } from './adapters/mtn-momo.adapter';
import { PaymentAdapter } from './adapters/payment-adapter.interface';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class PaymentsService {
  private adapters: Map<string, PaymentAdapter>;

  constructor(
    private prisma: PrismaService,
    mock: MockPaymentAdapter,
    mtnMomo: MtnMomoAdapter,
    // See SubscriptionsService for why this is a forwardRef -- Payments and
    // Subscriptions call into each other (subscribe -> initiate; a
    // provider's async webhook -> activateFromPayment).
    @Inject(forwardRef(() => SubscriptionsService)) private subscriptions: SubscriptionsService,
  ) {
    this.adapters = new Map<string, PaymentAdapter>([
      [mock.code, mock],
      [mtnMomo.code, mtnMomo],
    ]);
  }

  listProviders() {
    return this.prisma.paymentProvider.findMany({ where: { isActive: true } });
  }

  async addMethod(user: AuthenticatedUser, data: { providerCode: string; type: any; accountRefMasked: string; isDefault?: boolean }) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { code: data.providerCode } });
    if (!provider) throw new NotFoundException('Payment provider not found.');
    return this.prisma.paymentMethod.create({
      data: {
        userId: user.id,
        providerId: provider.id,
        type: data.type,
        accountRefMasked: data.accountRefMasked,
        isDefault: !!data.isDefault,
      },
    });
  }

  myMethods(user: AuthenticatedUser) {
    return this.prisma.paymentMethod.findMany({ where: { userId: user.id }, include: { provider: true } });
  }

  /**
   * Initiates a charge for any purpose (marketplace order, input order,
   * transport, subscription, advertising...) through the provider abstraction
   * layer -- callers never talk to MTN/Airtel/card APIs directly.
   */
  async initiate(
    user: AuthenticatedUser,
    params: { providerCode: string; purpose: any; sourceId?: string; amount: number; methodId?: string },
  ) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { code: params.providerCode } });
    if (!provider || !provider.isActive) throw new NotFoundException('Payment provider not available.');
    const adapter = this.adapters.get(provider.code);
    if (!adapter) throw new BadRequestException(`No adapter registered for provider ${provider.code}.`);

    const reference = `AGL-${Date.now()}-${uuid().slice(0, 8)}`;
    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        reference,
        providerId: provider.id,
        methodId: params.methodId,
        userId: user.id,
        purpose: params.purpose,
        sourceId: params.sourceId,
        amount: params.amount,
        status: 'PENDING',
      },
    });

    const result = await adapter.initiate({
      reference,
      amount: params.amount,
      currency: 'RWF',
      purpose: params.purpose,
    });

    await this.prisma.paymentAttempt.create({
      data: {
        transactionId: transaction.id,
        attemptNumber: 1,
        status: result.status,
        providerResponse: result.raw as any,
      },
    });

    const updated = await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: result.status,
        completedAt: result.status === 'SUCCESSFUL' ? new Date() : undefined,
      },
    });

    return { transaction: updated, redirectUrl: result.redirectUrl };
  }

  async handleWebhook(providerCode: string, payload: unknown, signatureHeader?: string) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { code: providerCode } });
    if (!provider) throw new NotFoundException('Unknown payment provider.');
    const adapter = this.adapters.get(provider.code);
    if (!adapter) throw new BadRequestException('No adapter for this provider.');

    const signatureValid = adapter.verifySignature(payload, signatureHeader);
    const parsed = adapter.parseWebhook(payload);

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { reference: { contains: parsed.providerReference.replace(/^MOCK-|^MTN-/, '') } },
    });

    await this.prisma.paymentWebhook.create({
      data: {
        providerId: provider.id,
        eventType: parsed.status,
        payload: payload as any,
        signatureValid,
        transactionId: transaction?.id,
        processedAt: new Date(),
      },
    });

    if (!signatureValid) throw new BadRequestException('Invalid webhook signature.');
    if (!transaction) return { matched: false }; // recorded as unmatched for reconciliation

    if (parsed.status === 'SUCCESSFUL' || parsed.status === 'FAILED') {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: parsed.status, completedAt: new Date() },
      });
    }

    // Async confirmation path for push-to-pay providers (e.g. real MTN MoMo):
    // subscribe() couldn't activate the plan inline because the charge was
    // still PENDING when it returned, so the activation happens here once
    // the provider's webhook confirms success. Guarded against duplicate
    // webhook deliveries by checking the subscription isn't ACTIVE already.
    const subscriptionSourceId = transaction.sourceId;
    if (parsed.status === 'SUCCESSFUL' && transaction.purpose === 'SUBSCRIPTION' && subscriptionSourceId) {
      const sub = await this.prisma.userSubscription.findUnique({ where: { id: subscriptionSourceId } });
      if (sub && sub.status !== 'ACTIVE') {
        await this.subscriptions.activateFromPayment(subscriptionSourceId, transaction.id, transaction.amount);
      }
    }

    return { matched: true, status: parsed.status };
  }

  async refund(transactionId: string, amount: number, reason: string) {
    const tx = await this.prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found.');
    const refund = await this.prisma.paymentRefund.create({
      data: { transactionId, amount, reason, status: 'SUCCESSFUL', processedAt: new Date() },
    });
    await this.prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { status: amount >= tx.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });
    return refund;
  }

  async reverse(transactionId: string, amount: number, reason: string) {
    const reversal = await this.prisma.paymentReversal.create({
      data: { transactionId, amount, reason, status: 'SUCCESSFUL', processedAt: new Date() },
    });
    await this.prisma.paymentTransaction.update({ where: { id: transactionId }, data: { status: 'REVERSED' } });
    return reversal;
  }

  listTransactions(filters: { status?: any; userId?: string }) {
    return this.prisma.paymentTransaction.findMany({
      where: { status: filters.status, userId: filters.userId },
      include: { provider: true },
      orderBy: { initiatedAt: 'desc' },
      take: 200,
    });
  }

  async reconcile(providerCode: string, date: Date, providerTotal: number) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { code: providerCode } });
    if (!provider) throw new NotFoundException('Provider not found.');
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const agg = await this.prisma.paymentTransaction.aggregate({
      where: { providerId: provider.id, status: 'SUCCESSFUL', completedAt: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    });
    const systemTotal = agg._sum.amount ?? 0;
    const discrepancy = systemTotal - providerTotal;
    return this.prisma.paymentReconciliation.create({
      data: {
        providerId: provider.id,
        date,
        systemTotal,
        providerTotal,
        discrepancy,
        status: discrepancy === 0 ? 'RESOLVED' : 'OPEN',
      },
    });
  }
}
