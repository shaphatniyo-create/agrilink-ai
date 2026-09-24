import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from '../payments/payments.service';

const periodDaysFor = (plan: Pick<SubscriptionPlan, 'billingCycle'>) =>
  plan.billingCycle === 'MONTHLY' ? 30 : plan.billingCycle === 'QUARTERLY' ? 90 : 365;

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    // PaymentsService needs to call back into this service when a webhook
    // confirms a subscription charge, so the dependency is circular --
    // forwardRef() is Nest's supported way to wire that up.
    @Inject(forwardRef(() => PaymentsService)) private payments: PaymentsService,
  ) {}

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      include: { features: true },
      orderBy: { priceRwf: 'asc' },
    });
  }

  async createPlan(data: any) {
    return this.prisma.subscriptionPlan.create({ data });
  }

  async setFeature(planId: string, data: { featureKey: string; featureName: string; limitValue?: number; enabled?: boolean }) {
    return this.prisma.subscriptionFeature.upsert({
      where: { planId_featureKey: { planId, featureKey: data.featureKey } },
      create: { planId, ...data },
      update: data,
    });
  }

  /**
   * FREE plans activate immediately -- no money changes hands. Any paid plan
   * is created PAST_DUE (i.e. "signed up, not yet paid") and a real charge is
   * initiated through PaymentsService's provider abstraction; the plan only
   * becomes ACTIVE once that charge settles as SUCCESSFUL (synchronously for
   * an instant-confirm provider like the mock/card adapters, or asynchronously
   * via PaymentsService.handleWebhook -> activateFromPayment for a
   * push-to-pay provider like MTN MoMo). This is the money side of
   * subscriptions -- previously subscribe() just flipped a status flag with
   * no payment collected at all.
   */
  async subscribe(user: AuthenticatedUser, planId: string, opts: { providerCode?: string; methodId?: string } = {}) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) throw new NotFoundException('Plan not found.');

    const endDate = new Date(Date.now() + periodDaysFor(plan) * 24 * 3600 * 1000);

    if (plan.priceRwf <= 0) {
      const sub = await this.prisma.userSubscription.create({
        data: { userId: user.id, planId, status: 'ACTIVE', endDate },
      });
      return { subscription: sub, payment: null };
    }

    const providerCode = opts.providerCode ?? 'MOCK';
    const subscription = await this.prisma.userSubscription.create({
      data: { userId: user.id, planId, status: 'PAST_DUE', endDate },
    });

    const { transaction, redirectUrl } = await this.payments.initiate(user, {
      providerCode,
      purpose: 'SUBSCRIPTION',
      sourceId: subscription.id,
      amount: plan.priceRwf,
      methodId: opts.methodId,
    });

    if (transaction.status === 'SUCCESSFUL') {
      const activated = await this.activateFromPayment(subscription.id, transaction.id, transaction.amount);
      return { subscription: activated, payment: transaction, redirectUrl };
    }

    return {
      subscription,
      payment: transaction,
      redirectUrl,
      message: 'Payment initiated -- your subscription activates automatically once it is confirmed.',
    };
  }

  /**
   * Called by PaymentsService (synchronously right after a same-request
   * SUCCESSFUL charge, or from handleWebhook once a provider confirms a
   * pending one) to actually flip the subscription ACTIVE and record the
   * payment. This is the only path that activates a paid subscription.
   */
  async activateFromPayment(userSubscriptionId: string, transactionId: string, amount: number) {
    const sub = await this.prisma.userSubscription.findUnique({
      where: { id: userSubscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found for this payment.');
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + periodDaysFor(sub.plan) * 24 * 3600 * 1000);
    return this.recordPayment(userSubscriptionId, transactionId, amount, periodStart, periodEnd);
  }

  mySubscriptions(user: AuthenticatedUser) {
    return this.prisma.userSubscription.findMany({
      where: { userId: user.id },
      include: { plan: { include: { features: true } }, invoices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordPayment(userSubscriptionId: string, transactionId: string, amount: number, periodStart: Date, periodEnd: Date) {
    await this.prisma.subscriptionPayment.create({
      data: { userSubscriptionId, transactionId, amount, periodStart, periodEnd },
    });
    return this.prisma.userSubscription.update({
      where: { id: userSubscriptionId },
      data: { status: 'ACTIVE', endDate: periodEnd },
    });
  }

  async issueInvoice(userSubscriptionId: string, amount: number, dueAt: Date) {
    const invoiceNumber = `INV-${Date.now()}`;
    return this.prisma.subscriptionInvoice.create({
      data: { userSubscriptionId, invoiceNumber, amount, dueAt, status: 'ISSUED' },
    });
  }

  /** Checks whether a user's active plan grants a given feature (and how much of its limit remains, if capped). */
  async hasFeature(userId: string, featureKey: string): Promise<{ enabled: boolean; limitValue: number | null }> {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: { include: { features: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) return { enabled: false, limitValue: 0 };
    const feature = sub.plan.features.find((f) => f.featureKey === featureKey);
    if (!feature || !feature.enabled) return { enabled: false, limitValue: 0 };
    return { enabled: true, limitValue: feature.limitValue };
  }

  async cancel(user: AuthenticatedUser, id: string) {
    const sub = await this.prisma.userSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found.');
    if (sub.userId !== user.id) throw new ForbiddenException('Not your subscription.');
    return this.prisma.userSubscription.update({ where: { id }, data: { status: 'CANCELLED', autoRenew: false } });
  }
}
