import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from '../farms/farms.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { SOIL_THRESHOLD_RULES, DEVICE_OFFLINE_AFTER_MS } from './knowledge/soil-thresholds';

export interface IngestDto {
  deviceCode: string;
  apiKey: string;
  moisturePct?: number;
  temperatureC?: number;
  ph?: number;
  nitrogenPpm?: number;
  phosphorusPpm?: number;
  potassiumPpm?: number;
  pumpState?: 'ON' | 'OFF';
  recordedAt?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Field-sensor ingestion + read-back for the farmer dashboard. The ingest
 * endpoint is deliberately NOT behind the global JWT guard (an ESP32 can't
 * do an interactive login) -- it authenticates each push with a per-device
 * secret instead (see #ingest). Everything a human touches (registering a
 * device, viewing readings/alerts, resolving an alert) goes through the
 * normal authenticated API and reuses FarmsService.findOne for authorization,
 * same rule as viewing the farm itself.
 */
@Injectable()
export class IotService {
  constructor(
    private prisma: PrismaService,
    private farms: FarmsService,
  ) {}

  // ---------------------------------------------------------------------
  // Device registration (human-facing, authenticated)
  // ---------------------------------------------------------------------

  /** Returns the plaintext device secret ONCE -- flash it into the ESP32's firmware/config; it cannot be retrieved again. */
  async registerDevice(farmId: string, data: { label?: string }, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user); // authorize

    const apiKey = randomBytes(24).toString('hex');
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    for (let attempt = 0; attempt < 5; attempt++) {
      const deviceCode = `IOT-${randomBytes(4).toString('hex').toUpperCase()}`;
      try {
        const device = await this.prisma.iotDevice.create({
          data: { farmId, deviceCode, apiKeyHash, label: data.label, createdById: user.id },
        });
        return { device, apiKey }; // apiKey shown exactly once
      } catch (err: any) {
        if (err?.code === 'P2002') continue; // deviceCode collision, retry
        throw err;
      }
    }
    throw new BadRequestException('Could not generate a unique device code. Please try again.');
  }

  async listDevices(farmId: string, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    const devices = await this.prisma.iotDevice.findMany({ where: { farmId }, orderBy: { createdAt: 'desc' } });
    const now = Date.now();
    return devices.map((d) => ({
      ...d,
      apiKeyHash: undefined, // never expose the hash
      online: d.status === 'ACTIVE' && !!d.lastSeenAt && now - d.lastSeenAt.getTime() < DEVICE_OFFLINE_AFTER_MS,
    }));
  }

  async deactivateDevice(deviceId: string, user: AuthenticatedUser) {
    const device = await this.prisma.iotDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found.');
    await this.farms.findOne(device.farmId, user);
    return this.prisma.iotDevice.update({ where: { id: deviceId }, data: { status: 'INACTIVE' } });
  }

  async setPumpMode(deviceId: string, pumpMode: string, user: AuthenticatedUser) {
    if (!['AUTO', 'ON', 'OFF'].includes(pumpMode)) throw new BadRequestException('Invalid pump mode.');
    const device = await this.prisma.iotDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found.');
    await this.farms.findOne(device.farmId, user);
    return this.prisma.iotDevice.update({
      where: { id: deviceId },
      data: { pumpMode },
    });
  }

  // ---------------------------------------------------------------------
  // Ingestion (device-facing, NOT a user JWT -- see class doc comment)
  // ---------------------------------------------------------------------

  async ingest(dto: IngestDto) {
    if (!dto.deviceCode || !dto.apiKey) {
      throw new BadRequestException('deviceCode and apiKey are required.');
    }
    const device = await this.prisma.iotDevice.findUnique({ where: { deviceCode: dto.deviceCode } });
    if (!device) throw new UnauthorizedException('Unknown device.');
    if (device.status !== 'ACTIVE') throw new ForbiddenException('This device has been deactivated.');
    const valid = await bcrypt.compare(dto.apiKey, device.apiKeyHash);
    if (!valid) throw new UnauthorizedException('Invalid device credentials.');

    const reading = await this.prisma.soilReading.create({
      data: {
        deviceId: device.id,
        farmId: device.farmId,
        moisturePct: dto.moisturePct,
        temperatureC: dto.temperatureC,
        ph: dto.ph,
        nitrogenPpm: dto.nitrogenPpm,
        phosphorusPpm: dto.phosphorusPpm,
        potassiumPpm: dto.potassiumPpm,
        pumpState: dto.pumpState,
        latitude: dto.latitude,
        longitude: dto.longitude,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
      },
    });

    await this.prisma.iotDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

    // The device is clearly reachable right now -- clear any stale "offline" alert.
    await this.prisma.sensorAlert.updateMany({
      where: { deviceId: device.id, alertType: 'DEVICE_OFFLINE', resolvedAt: null },
      data: { resolvedAt: new Date() },
    });

    const newAlerts = await this.evaluateThresholds(device.id, device.farmId, reading);
    return { reading, alerts: newAlerts, pumpCommand: device.pumpMode };
  }

  /** Creates a new open alert per breached rule (skipping ones already open for this device), and auto-resolves rules that are no longer breached. */
  private async evaluateThresholds(
    deviceId: string,
    farmId: string,
    reading: { moisturePct: number | null; ph: number | null; nitrogenPpm: number | null; phosphorusPpm: number | null; potassiumPpm: number | null },
  ) {
    const openAlerts = await this.prisma.sensorAlert.findMany({ where: { deviceId, resolvedAt: null } });
    const openByType = new Map(openAlerts.map((a) => [a.alertType, a]));
    const created: any[] = [];

    for (const rule of SOIL_THRESHOLD_RULES) {
      const breached = rule.breaches(reading);
      const existing = openByType.get(rule.type);
      if (breached && !existing) {
        const alert = await this.prisma.sensorAlert.create({
          data: {
            farmId,
            deviceId,
            alertType: rule.type,
            severity: rule.severity,
            message: rule.message,
            recommendation: rule.recommendation,
          },
        });
        created.push(alert);
      } else if (!breached && existing) {
        await this.prisma.sensorAlert.update({ where: { id: existing.id }, data: { resolvedAt: new Date() } });
      }
    }
    return created;
  }

  // ---------------------------------------------------------------------
  // Read-back for the farmer dashboard (human-facing, authenticated)
  // ---------------------------------------------------------------------

  async latest(farmId: string, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    await this.flagOfflineDevices(farmId);

    // Deactivated devices are "removed" from the dashboard (kept in the database, can be re-activated).
    const devices = await this.prisma.iotDevice.findMany({ where: { farmId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
    const now = Date.now();
    const readings = await Promise.all(
      devices.map((d) => this.prisma.soilReading.findFirst({ where: { deviceId: d.id }, orderBy: { recordedAt: 'desc' } })),
    );
    const devicesWithReadings = devices.map((d, i) => ({
      ...d,
      apiKeyHash: undefined,
      online: d.status === 'ACTIVE' && !!d.lastSeenAt && now - d.lastSeenAt.getTime() < DEVICE_OFFLINE_AFTER_MS,
      latestReading: readings[i] ?? null,
    }));

    const alerts = await this.prisma.sensorAlert.findMany({
      where: { farmId, resolvedAt: null },
      include: { device: { select: { deviceCode: true, label: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { devices: devicesWithReadings, alerts };
  }

  async history(farmId: string, user: AuthenticatedUser, limit = 50) {
    await this.farms.findOne(farmId, user);
    return this.prisma.soilReading.findMany({
      where: { farmId },
      orderBy: { recordedAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async listAlerts(farmId: string, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);
    await this.flagOfflineDevices(farmId);
    return this.prisma.sensorAlert.findMany({
      where: { farmId },
      include: { device: { select: { deviceCode: true, label: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async resolveAlert(alertId: string, user: AuthenticatedUser) {
    const alert = await this.prisma.sensorAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found.');
    await this.farms.findOne(alert.farmId, user);
    return this.prisma.sensorAlert.update({ where: { id: alertId }, data: { resolvedAt: new Date() } });
  }

  /** Ensures an open DEVICE_OFFLINE alert exists for any ACTIVE device that has gone quiet -- checked lazily on read, no cron job needed. */
  private async flagOfflineDevices(farmId: string) {
    const cutoff = new Date(Date.now() - DEVICE_OFFLINE_AFTER_MS);
    const staleDevices = await this.prisma.iotDevice.findMany({
      where: {
        farmId,
        status: 'ACTIVE',
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }],
      },
    });
    for (const device of staleDevices) {
      const alreadyOpen = await this.prisma.sensorAlert.findFirst({
        where: { deviceId: device.id, alertType: 'DEVICE_OFFLINE', resolvedAt: null },
      });
      if (!alreadyOpen) {
        await this.prisma.sensorAlert.create({
          data: {
            farmId,
            deviceId: device.id,
            alertType: 'DEVICE_OFFLINE',
            severity: 'WATCH',
            message: `${device.label || device.deviceCode} has not reported in over 6 hours.`,
            recommendation: 'Check the device power, GSM signal, and SIM balance.',
          },
        });
      }
    }
  }

  // ─── AI Soil Analysis ────────────────────────────────────────────────────────

  async aiAnalysis(farmId: string, user: AuthenticatedUser) {
    await this.farms.findOne(farmId, user);

    // Pull latest reading across all devices for this farm
    const latestReading = await this.prisma.soilReading.findFirst({
      where: { farmId },
      orderBy: { recordedAt: 'desc' },
    });

    if (!latestReading) {
      return {
        status: 'NO_DATA',
        summary: 'No sensor data available yet.',
        insights: [],
        recommendations: [],
        overallScore: null,
        recordedAt: null,
      };
    }

    const insights: Array<{
      parameter: string;
      value: string;
      status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
      icon: string;
      detail: string;
    }> = [];

    const recommendations: Array<{
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      action: string;
      reason: string;
      icon: string;
    }> = [];

    let scoreDeductions = 0;
    const r = latestReading;

    // ── Moisture ─────────────────────────────────────────────────────────────
    if (r.moisturePct !== null) {
      const m = r.moisturePct;
      if (m < 20) {
        insights.push({ parameter: 'Soil Moisture', value: `${m.toFixed(1)}%`, status: 'CRITICAL', icon: '💧', detail: 'Critically dry – crops are under severe water stress.' });
        recommendations.push({ priority: 'HIGH', action: 'Irrigate immediately', reason: `Moisture at ${m.toFixed(1)}% is below the critical 20% threshold. Delay will cause crop failure.`, icon: '🚿' });
        scoreDeductions += 30;
      } else if (m < 35) {
        insights.push({ parameter: 'Soil Moisture', value: `${m.toFixed(1)}%`, status: 'WARNING', icon: '💧', detail: 'Soil is drying out – irrigation recommended soon.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Schedule irrigation within 24 hours', reason: `Moisture at ${m.toFixed(1)}% is approaching stress levels. Water before it drops below 20%.`, icon: '🚿' });
        scoreDeductions += 15;
      } else if (m > 90) {
        insights.push({ parameter: 'Soil Moisture', value: `${m.toFixed(1)}%`, status: 'WARNING', icon: '💧', detail: 'Soil is waterlogged – risk of root rot and nutrient leaching.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Stop irrigation & improve drainage', reason: `Moisture at ${m.toFixed(1)}% is too high. Turn pump to OFF and check drainage channels.`, icon: '🛑' });
        scoreDeductions += 15;
      } else {
        insights.push({ parameter: 'Soil Moisture', value: `${m.toFixed(1)}%`, status: 'OPTIMAL', icon: '💧', detail: 'Moisture is in the optimal range for most crops.' });
      }
    }

    // ── Temperature ──────────────────────────────────────────────────────────
    if (r.temperatureC !== null) {
      const t = r.temperatureC;
      if (t > 40) {
        insights.push({ parameter: 'Soil Temperature', value: `${t.toFixed(1)}°C`, status: 'CRITICAL', icon: '🌡️', detail: 'Dangerously hot – soil microbial activity is collapsing.' });
        recommendations.push({ priority: 'HIGH', action: 'Apply mulch & activate irrigation cooling', reason: `${t.toFixed(1)}°C soil temp kills beneficial bacteria and damages root systems. Mulching and light irrigation reduces soil temp by 5–10°C.`, icon: '🌿' });
        scoreDeductions += 25;
      } else if (t > 35) {
        insights.push({ parameter: 'Soil Temperature', value: `${t.toFixed(1)}°C`, status: 'WARNING', icon: '🌡️', detail: 'Elevated temperature – microbial activity may be reduced.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Apply organic mulch layer (5–8 cm)', reason: `Soil at ${t.toFixed(1)}°C is warm. Mulching regulates temperature and retains moisture.`, icon: '🌿' });
        scoreDeductions += 10;
      } else if (t < 10) {
        insights.push({ parameter: 'Soil Temperature', value: `${t.toFixed(1)}°C`, status: 'WARNING', icon: '🌡️', detail: 'Cold soil – slow germination and nutrient uptake.' });
        recommendations.push({ priority: 'LOW', action: 'Consider black plastic mulch to warm soil', reason: `${t.toFixed(1)}°C is below optimal for most crops (15–25°C). Planting may be delayed.`, icon: '⚫' });
        scoreDeductions += 10;
      } else {
        insights.push({ parameter: 'Soil Temperature', value: `${t.toFixed(1)}°C`, status: 'OPTIMAL', icon: '🌡️', detail: 'Temperature is ideal for plant growth and microbial activity.' });
      }
    }

    // ── pH ───────────────────────────────────────────────────────────────────
    if (r.ph !== null) {
      const ph = r.ph;
      if (ph > 8.5) {
        insights.push({ parameter: 'Soil pH', value: ph.toFixed(1), status: 'CRITICAL', icon: '⚗️', detail: 'Highly alkaline – most nutrients are unavailable to plants.' });
        recommendations.push({ priority: 'HIGH', action: 'Apply elemental sulfur or acidifying fertilizer', reason: `pH ${ph.toFixed(1)} locks out iron, manganese, and zinc. Apply 200–400 kg/ha elemental sulfur to lower pH toward 6.5.`, icon: '🧪' });
        scoreDeductions += 25;
      } else if (ph > 7.5) {
        insights.push({ parameter: 'Soil pH', value: ph.toFixed(1), status: 'WARNING', icon: '⚗️', detail: 'Mildly alkaline – some micronutrient deficiencies likely.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Apply gypsum (calcium sulfate) or acidifying fertilizer', reason: `pH ${ph.toFixed(1)} can reduce availability of iron and phosphorus. Gypsum at 1–2 t/ha helps.`, icon: '🧪' });
        scoreDeductions += 12;
      } else if (ph < 5.0) {
        insights.push({ parameter: 'Soil pH', value: ph.toFixed(1), status: 'CRITICAL', icon: '⚗️', detail: 'Highly acidic – aluminium toxicity risk and phosphorus lock-out.' });
        recommendations.push({ priority: 'HIGH', action: 'Apply agricultural lime immediately', reason: `pH ${ph.toFixed(1)} causes aluminium toxicity and locks out phosphorus. Apply 2–4 t/ha dolomitic lime.`, icon: '🪨' });
        scoreDeductions += 25;
      } else if (ph < 5.8) {
        insights.push({ parameter: 'Soil pH', value: ph.toFixed(1), status: 'WARNING', icon: '⚗️', detail: 'Slightly acidic – phosphorus and calcium availability is reduced.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Apply 1–2 t/ha agricultural lime', reason: `pH ${ph.toFixed(1)} is below optimal (6.0–7.0). Lime application will improve nutrient availability.`, icon: '🪨' });
        scoreDeductions += 12;
      } else {
        insights.push({ parameter: 'Soil pH', value: ph.toFixed(1), status: 'OPTIMAL', icon: '⚗️', detail: 'pH is in the optimal range (5.8–7.5) for most crops.' });
      }
    }

    // ── Nitrogen ─────────────────────────────────────────────────────────────
    if (r.nitrogenPpm !== null) {
      const n = r.nitrogenPpm;
      if (n > 400) {
        insights.push({ parameter: 'Nitrogen (N)', value: `${n} ppm`, status: 'CRITICAL', icon: '🌿', detail: 'Toxic nitrogen levels – can burn roots and contaminate groundwater.' });
        recommendations.push({ priority: 'HIGH', action: 'Stop all nitrogen fertilization immediately', reason: `N at ${n} ppm is dangerously high. Flush with clean irrigation water to dilute. Do not apply any urea, DAP, or CAN fertilizers.`, icon: '🛑' });
        scoreDeductions += 20;
      } else if (n > 250) {
        insights.push({ parameter: 'Nitrogen (N)', value: `${n} ppm`, status: 'WARNING', icon: '🌿', detail: 'High nitrogen – excessive vegetative growth at the expense of yield.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Pause nitrogen fertilization for 2–3 weeks', reason: `N at ${n} ppm promotes excessive leaf growth over fruiting/grain fill. Hold off on N applications.`, icon: '⏸️' });
        scoreDeductions += 10;
      } else if (n < 30) {
        insights.push({ parameter: 'Nitrogen (N)', value: `${n} ppm`, status: 'CRITICAL', icon: '🌿', detail: 'Severe nitrogen deficiency – yellowing and stunted growth expected.' });
        recommendations.push({ priority: 'HIGH', action: 'Apply nitrogen fertilizer immediately', reason: `N at ${n} ppm is critically low. Apply urea (46% N) at 50–100 kg/ha or CAN at 100–150 kg/ha.`, icon: '🌱' });
        scoreDeductions += 20;
      } else if (n < 80) {
        insights.push({ parameter: 'Nitrogen (N)', value: `${n} ppm`, status: 'WARNING', icon: '🌿', detail: 'Low nitrogen – apply top-dress soon to prevent yield loss.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Top-dress with 30–50 kg/ha urea', reason: `N at ${n} ppm is below optimal (80–250 ppm). Apply before the next growth stage.`, icon: '🌱' });
        scoreDeductions += 10;
      } else {
        insights.push({ parameter: 'Nitrogen (N)', value: `${n} ppm`, status: 'OPTIMAL', icon: '🌿', detail: 'Nitrogen is in the optimal range for vigorous growth.' });
      }
    }

    // ── Phosphorus ───────────────────────────────────────────────────────────
    if (r.phosphorusPpm !== null) {
      const p = r.phosphorusPpm;
      if (p > 800) {
        insights.push({ parameter: 'Phosphorus (P)', value: `${p} ppm`, status: 'CRITICAL', icon: '🔵', detail: 'Extreme phosphorus – blocks zinc and iron uptake.' });
        recommendations.push({ priority: 'HIGH', action: 'Stop all phosphate fertilization', reason: `P at ${p} ppm creates micronutrient toxicity. Do not apply DAP, TSP, or rock phosphate. Consider foliar zinc supplementation.`, icon: '🛑' });
        scoreDeductions += 20;
      } else if (p > 400) {
        insights.push({ parameter: 'Phosphorus (P)', value: `${p} ppm`, status: 'WARNING', icon: '🔵', detail: 'High phosphorus – may interfere with zinc and copper absorption.' });
        recommendations.push({ priority: 'LOW', action: 'Hold phosphate applications for this season', reason: `P at ${p} ppm is elevated. No phosphate fertilizer needed for at least one season.`, icon: '⏸️' });
        scoreDeductions += 8;
      } else if (p < 15) {
        insights.push({ parameter: 'Phosphorus (P)', value: `${p} ppm`, status: 'CRITICAL', icon: '🔵', detail: 'Critical phosphorus deficiency – root development and energy transfer impaired.' });
        recommendations.push({ priority: 'HIGH', action: 'Apply DAP or TSP fertilizer at planting', reason: `P at ${p} ppm is critically low. Apply DAP (18% N, 46% P₂O₅) at 100–150 kg/ha or TSP at 70–100 kg/ha.`, icon: '💊' });
        scoreDeductions += 20;
      } else if (p < 40) {
        insights.push({ parameter: 'Phosphorus (P)', value: `${p} ppm`, status: 'WARNING', icon: '🔵', detail: 'Low phosphorus – root growth and flowering may be limited.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Apply 50–80 kg/ha single superphosphate', reason: `P at ${p} ppm is below the recommended 40–400 ppm range. Band application near roots maximizes efficiency.`, icon: '💊' });
        scoreDeductions += 10;
      } else {
        insights.push({ parameter: 'Phosphorus (P)', value: `${p} ppm`, status: 'OPTIMAL', icon: '🔵', detail: 'Phosphorus is in the optimal range for root development and flowering.' });
      }
    }

    // ── Potassium ────────────────────────────────────────────────────────────
    if (r.potassiumPpm !== null) {
      const k = r.potassiumPpm;
      if (k > 800) {
        insights.push({ parameter: 'Potassium (K)', value: `${k} ppm`, status: 'CRITICAL', icon: '🟡', detail: 'Potassium toxicity – interferes with magnesium and calcium uptake.' });
        recommendations.push({ priority: 'HIGH', action: 'Stop all potash fertilization', reason: `K at ${k} ppm causes magnesium and calcium antagonism. No KCl, K₂SO₄, or NPK blends for this season.`, icon: '🛑' });
        scoreDeductions += 20;
      } else if (k > 400) {
        insights.push({ parameter: 'Potassium (K)', value: `${k} ppm`, status: 'WARNING', icon: '🟡', detail: 'Elevated potassium – reduce potash application to avoid imbalances.' });
        recommendations.push({ priority: 'LOW', action: 'Reduce or eliminate potash inputs this cycle', reason: `K at ${k} ppm is above optimal. Monitor magnesium levels as antagonism can reduce Mg uptake.`, icon: '⏸️' });
        scoreDeductions += 8;
      } else if (k < 40) {
        insights.push({ parameter: 'Potassium (K)', value: `${k} ppm`, status: 'CRITICAL', icon: '🟡', detail: 'Severe potassium deficiency – poor fruit quality and disease resistance.' });
        recommendations.push({ priority: 'HIGH', action: 'Apply muriate of potash (KCl) immediately', reason: `K at ${k} ppm is critically low. Apply KCl at 60–100 kg/ha. Potassium is critical for disease resistance and fruit quality.`, icon: '💊' });
        scoreDeductions += 20;
      } else if (k < 100) {
        insights.push({ parameter: 'Potassium (K)', value: `${k} ppm`, status: 'WARNING', icon: '🟡', detail: 'Low potassium – crop may have reduced stress tolerance.' });
        recommendations.push({ priority: 'MEDIUM', action: 'Apply 30–60 kg/ha muriate of potash (KCl)', reason: `K at ${k} ppm is below the 100–400 ppm optimal range. Foliar K₂SO₄ can provide quick correction.`, icon: '💊' });
        scoreDeductions += 10;
      } else {
        insights.push({ parameter: 'Potassium (K)', value: `${k} ppm`, status: 'OPTIMAL', icon: '🟡', detail: 'Potassium is optimal for water regulation and disease resistance.' });
      }
    }

    // ── Overall health score ──────────────────────────────────────────────────
    const overallScore = Math.max(0, 100 - scoreDeductions);

    const status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' =
      overallScore >= 90 ? 'EXCELLENT' :
      overallScore >= 75 ? 'GOOD' :
      overallScore >= 55 ? 'FAIR' :
      overallScore >= 35 ? 'POOR' : 'CRITICAL';

    const summaryMap: Record<typeof status, string> = {
      EXCELLENT: '🌟 Your soil is in excellent condition. Keep up current management practices.',
      GOOD:      '✅ Soil health is good with minor areas to improve.',
      FAIR:      '⚠️ Soil has notable issues that need attention to protect yield.',
      POOR:      '🚨 Multiple serious soil problems detected. Take corrective action soon.',
      CRITICAL:  '🆘 Soil is in critical condition. Immediate intervention required to save the crop.',
    };

    // Sort recommendations by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      status,
      summary: summaryMap[status],
      overallScore,
      insights,
      recommendations,
      recordedAt: r.recordedAt,
      analyzedAt: new Date(),
    };
  }
}
