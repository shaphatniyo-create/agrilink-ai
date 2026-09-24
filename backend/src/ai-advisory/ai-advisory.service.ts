import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from '../farms/farms.service';
import { FarmFinanceService } from '../farm-finance/farm-finance.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PlantDoctorEngine, ImageFeatures } from './plant-doctor-engine';

@Injectable()
export class AiAdvisoryService {
  constructor(
    private prisma: PrismaService,
    private farms: FarmsService,
    private farmFinance: FarmFinanceService,
    private engine: PlantDoctorEngine,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Plant Doctor — TF-IDF cosine similarity against the local disease KB
  // (50+ diseases, 9 crops). Image features extracted by the frontend Canvas
  // analyser are accepted as optional structured hints that boost matching.
  // ───────────────────────────────────────────────────────────────────────────
  async diagnosePlant(
    user: AuthenticatedUser,
    data: {
      cropId: string;
      farmId?: string;
      symptomsText: string;
      imageNote?: string;
      imageFeatures?: ImageFeatures; // from frontend Canvas analysis
    },
  ) {
    if (!data.symptomsText || data.symptomsText.trim().length < 5) {
      throw new BadRequestException(
        'Describe what you see (e.g. "yellow spots on leaves, worse after rain").',
      );
    }
    const crop = await this.prisma.crop.findUnique({ where: { id: data.cropId } });
    if (!crop) throw new NotFoundException('Crop not found.');
    if (data.farmId) await this.farms.findOne(data.farmId, user);

    // Run the local TF-IDF engine
    const matches = this.engine.diagnose(
      data.symptomsText,
      crop.name,
      data.imageFeatures,
      3,
    );

    const CONFIDENCE_FLOOR = 0.12;
    const best = matches[0];
    const confident = best && best.score >= CONFIDENCE_FLOOR;

    let recommendation: string;
    let findings: any;

    if (confident) {
      const top = matches[0];
      const lines: string[] = [
        `🔍 Most likely: **${top.entry.name}** (${top.entry.category.toLowerCase().replace('_', ' ')}, ${Math.round(top.score * 100)}% match).`,
        ``,
        `📋 **Symptoms matched:** ${top.matchedTerms.join(', ') || 'general pattern match'}.`,
        ``,
        `💊 **Treatment:** ${top.entry.management}`,
        ``,
        `🛡️ **Prevention:** ${top.entry.prevention}`,
        ``,
        `⚠️ **Urgency:** ${top.entry.urgency}`,
      ];

      if (matches.length > 1 && matches[1].score >= CONFIDENCE_FLOOR) {
        lines.push(
          ``,
          `Also consider: **${matches[1].entry.name}** (${Math.round(matches[1].score * 100)}% match) — ${matches[1].entry.management}`,
        );
      }
      lines.push(
        ``,
        `*Diagnosed by AgriLink AI local plant-disease model (TF-IDF, ${new Date().toLocaleDateString()}). Confirm with a certified agronomist for high-value crops or rapidly spreading outbreaks.*`,
      );
      recommendation = lines.join('\n');
      findings = { matches: matches.map((m) => ({ name: m.entry.name, category: m.entry.category, score: m.score, urgency: m.entry.urgency, matchedTerms: m.matchedTerms, management: m.entry.management, prevention: m.entry.prevention })) };
    } else {
      recommendation =
        `No confident match found in the AgriLink disease database for that description on ${crop.name}. ` +
        `Try adding more detail: which part of the plant is affected (leaf, stem, root, fruit)? ` +
        `What colour/shape are the lesions? Did symptoms appear after rain, drought, or fertiliser? ` +
        `Consult a local agricultural extension officer or an AGRICULTURAL_EXPERT on the platform.`;
      findings = { matches: [], query: data.symptomsText };
    }

    return this.prisma.aiDiagnosis.create({
      data: {
        userId: user.id,
        farmId: data.farmId,
        cropId: data.cropId,
        engineType: 'PLANT_DOCTOR',
        inputText: data.symptomsText,
        inputImageNote: data.imageNote,
        findings: findings as any,
        recommendation,
        confidence: best?.score ?? 0,
      },
    });
  }

  async myDiagnoses(user: AuthenticatedUser, farmId?: string) {
    return this.prisma.aiDiagnosis.findMany({
      where: { userId: user.id, farmId },
      include: { crop: true, farm: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Weather alerts
  // ───────────────────────────────────────────────────────────────────────────
  async getWeatherAlerts(geoAreaId: string) {
    const area = await this.prisma.adminArea.findUnique({ where: { id: geoAreaId } });
    if (!area) throw new NotFoundException('Administrative area not found.');
    const ancestorIds = [area.id];
    let current = area;
    const visited = new Set<string>([area.id]);
    while (current.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      const parent = await this.prisma.adminArea.findUnique({ where: { id: current.parentId } });
      if (!parent) break;
      ancestorIds.push(parent.id);
      current = parent;
    }
    return this.prisma.weatherAlert.findMany({
      where: { geoAreaId: { in: ancestorIds }, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
      include: { geoArea: true },
      orderBy: { startsAt: 'desc' },
      take: 50,
    });
  }

  async postWeatherAlert(
    user: AuthenticatedUser,
    data: {
      geoAreaId: string;
      alertType: 'RAIN' | 'FLOOD' | 'DROUGHT' | 'WIND' | 'FROST' | 'LIGHTNING';
      severity?: 'ADVISORY' | 'WATCH' | 'WARNING';
      message: string;
      recommendation?: string;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    return this.prisma.weatherAlert.create({
      data: {
        geoAreaId: data.geoAreaId,
        alertType: data.alertType,
        severity: data.severity ?? 'ADVISORY',
        message: data.message,
        recommendation: data.recommendation,
        startsAt: data.startsAt ? new Date(data.startsAt) : new Date(),
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        createdById: user.id,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Farm planner
  // ───────────────────────────────────────────────────────────────────────────
  async planFarm(user: AuthenticatedUser, data: { farmId: string; cropId: string }) {
    const farm = await this.farms.findOne(data.farmId, user);
    const crop = await this.prisma.crop.findUnique({ where: { id: data.cropId } });
    if (!crop) throw new NotFoundException('Crop not found.');
    if (!crop.isActive) throw new BadRequestException('This crop is not yet activated for the pilot.');
    const ha = farm.sizeHectares ?? 1;
    const expectedYieldKg = crop.expectedYieldPerHaKg != null ? Math.round(crop.expectedYieldPerHaKg * ha) : null;
    const budgetRwf = crop.productionCostRwfPerHa != null ? Math.round(crop.productionCostRwfPerHa * ha) : null;
    const expectedRevenueRwf = crop.estimatedRevenueRwfPerHa != null ? Math.round(crop.estimatedRevenueRwfPerHa * ha) : null;
    const projectedNetRwf = budgetRwf != null && expectedRevenueRwf != null ? expectedRevenueRwf - budgetRwf : null;
    const lines: string[] = [];
    lines.push(`Plan for ${crop.name} on ${ha} ha at ${farm.name}.`);
    if (crop.plantingPeriod) lines.push(`Planting window: ${crop.plantingPeriod}.`);
    if (crop.harvestPeriod) lines.push(`Expected harvest window: ${crop.harvestPeriod}.`);
    if (crop.growingPeriodDays) lines.push(`Typical growing period: ${crop.growingPeriodDays} days.`);
    if (crop.inputRequirements) lines.push(`Input needs (per ha, scale by ${ha}): ${JSON.stringify(crop.inputRequirements)}.`);
    if (budgetRwf != null) lines.push(`Estimated production budget: RWF ${budgetRwf.toLocaleString()}.`);
    if (expectedRevenueRwf != null) lines.push(`Estimated revenue at seeded average price: RWF ${expectedRevenueRwf.toLocaleString()}.`);
    if (projectedNetRwf != null) lines.push(`Projected net result: RWF ${projectedNetRwf.toLocaleString()}.`);
    if (crop.marketInfo) lines.push(`Market context: ${JSON.stringify(crop.marketInfo)}.`);
    const recommendation = lines.join(' ');
    return this.prisma.aiDiagnosis.create({
      data: {
        userId: user.id,
        farmId: farm.id,
        cropId: crop.id,
        engineType: 'FARM_PLANNER',
        findings: { ha, expectedYieldKg, budgetRwf, expectedRevenueRwf, projectedNetRwf } as any,
        recommendation,
        confidence: 1,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Financial advisor
  // ───────────────────────────────────────────────────────────────────────────
  async financialAdvice(user: AuthenticatedUser, farmId: string) {
    const farm = await this.farms.findOne(farmId, user);
    const summary = await this.farmFinance.summary(farmId, user);
    const topExpense = Object.entries(summary.expenseByCategory).sort((a, b) => b[1] - a[1])[0];
    const topIncome = Object.entries(summary.incomeBySource).sort((a, b) => b[1] - a[1])[0];
    const lines: string[] = [];
    lines.push(`${farm.name}: recorded income RWF ${summary.totalIncome.toLocaleString()}, expenses RWF ${summary.totalExpense.toLocaleString()}, net RWF ${summary.net.toLocaleString()}.`);
    if (topExpense) lines.push(`Largest expense category: ${topExpense[0]} (RWF ${topExpense[1].toLocaleString()}).`);
    if (topIncome) lines.push(`Largest income source: ${topIncome[0]} (RWF ${topIncome[1].toLocaleString()}).`);
    lines.push(
      summary.net >= 0
        ? 'Net result is positive — consider setting aside a portion as savings or a buffer for the next planting season.'
        : 'Net result is negative — review the largest expense category above for savings, and confirm all sales income has been logged.',
    );
    lines.push('This is general guidance based on your own recorded farm income and expenses, not professional financial advice.');
    return this.prisma.aiDiagnosis.create({
      data: {
        userId: user.id,
        farmId: farm.id,
        engineType: 'FINANCIAL_ADVISOR',
        findings: summary as any,
        recommendation: lines.join(' '),
        confidence: 1,
      },
    });
  }
}
