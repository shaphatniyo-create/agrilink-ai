import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class AdvertisingService {
  constructor(private prisma: PrismaService) {}

  async createCampaign(user: AuthenticatedUser, data: any) {
    const { targetAreaIds, ...rest } = data;
    return this.prisma.adCampaign.create({
      data: {
        ...rest,
        advertiserId: user.id,
        status: 'PENDING_APPROVAL',
        targets: targetAreaIds
          ? { create: (targetAreaIds as string[]).map((areaId) => ({ areaId })) }
          : undefined,
      },
      include: { targets: true },
    });
  }

  async approve(id: string, approve: boolean) {
    return this.prisma.adCampaign.update({
      where: { id },
      data: { status: approve ? 'ACTIVE' : 'REJECTED' },
    });
  }

  myCampaigns(user: AuthenticatedUser) {
    return this.prisma.adCampaign.findMany({
      where: { advertiserId: user.id },
      include: { targets: { include: { area: true } }, metrics: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  activePlacements(placementType?: string) {
    return this.prisma.adPlacement.findMany({
      where: { active: true, placementType, campaign: { status: 'ACTIVE' } },
      include: { campaign: true, listing: true },
    });
  }

  async recordImpression(campaignId: string) {
    return this.bumpMetric(campaignId, { impressions: 1 });
  }
  async recordClick(campaignId: string) {
    return this.bumpMetric(campaignId, { clicks: 1 });
  }
  async recordConversion(campaignId: string) {
    return this.bumpMetric(campaignId, { conversions: 1 });
  }

  private async bumpMetric(campaignId: string, delta: Partial<Record<'impressions' | 'clicks' | 'leads' | 'conversions', number>>) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await this.prisma.adMetric.findUnique({
      where: { campaignId_date: { campaignId, date: today } },
    });
    if (existing) {
      return this.prisma.adMetric.update({
        where: { id: existing.id },
        data: {
          impressions: existing.impressions + (delta.impressions ?? 0),
          clicks: existing.clicks + (delta.clicks ?? 0),
          leads: existing.leads + (delta.leads ?? 0),
          conversions: existing.conversions + (delta.conversions ?? 0),
        },
      });
    }
    return this.prisma.adMetric.create({
      data: {
        campaignId,
        date: today,
        impressions: delta.impressions ?? 0,
        clicks: delta.clicks ?? 0,
        leads: delta.leads ?? 0,
        conversions: delta.conversions ?? 0,
      },
    });
  }

  async campaignPerformance(id: string, user: AuthenticatedUser) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id }, include: { metrics: true } });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    if (campaign.advertiserId !== user.id) throw new ForbiddenException('Not your campaign.');
    const totals = campaign.metrics.reduce(
      (acc, m) => ({
        impressions: acc.impressions + m.impressions,
        clicks: acc.clicks + m.clicks,
        leads: acc.leads + m.leads,
        conversions: acc.conversions + m.conversions,
        spendRwf: acc.spendRwf + m.spendRwf,
      }),
      { impressions: 0, clicks: 0, leads: 0, conversions: 0, spendRwf: 0 },
    );
    return { campaign, totals };
  }
}
