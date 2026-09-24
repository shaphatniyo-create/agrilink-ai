import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FarmsService } from '../farms/farms.service';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CROP_REQUIREMENTS, FERTILIZER_OPTIONS, LIME_BANDS, REQUIREMENT_SOURCE, SOURCES,
} from './knowledge/reference-data';

export const ENGINE_VERSION = 'soil-intel-1.0';

/** A cached reference point is reused for any location within this distance. */
const REFERENCE_RADIUS_KM = 1.0;
const SOILGRIDS_TIMEOUT_MS = 10_000;

type Band = 'LOW' | 'OK' | 'HIGH' | 'UNKNOWN';

interface Values {
  ph: number | null;
  phSource: 'SENSOR' | 'REFERENCE' | null;
  nitrogenPpm: number | null;
  phosphorusPpm: number | null;
  potassiumPpm: number | null;
  moisturePct: number | null;
}

interface Requirement {
  cropId: string;
  phMin: number; phMax: number; phAbsMin: number | null; phAbsMax: number | null;
  nitrogenMinPpm: number | null; nitrogenMaxPpm: number | null;
  phosphorusMinPpm: number | null; phosphorusMaxPpm: number | null;
  potassiumMinPpm: number | null; potassiumMaxPpm: number | null;
  moistureMinPct: number | null; moistureMaxPct: number | null;
  limeResponsive: boolean;
}

function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function band(v: number | null | undefined, min: number | null, max: number | null): Band {
  if (v == null || min == null || max == null) return 'UNKNOWN';
  if (v < min) return 'LOW';
  if (v > max) return 'HIGH';
  return 'OK';
}

/** Simplified USDA texture class from clay/sand/silt percentages. */
function textureClass(clay?: number | null, sand?: number | null, silt?: number | null): string | null {
  if (clay == null || sand == null || silt == null) return null;
  if (clay >= 40) return silt >= 40 ? 'Silty clay' : sand >= 45 ? 'Sandy clay' : 'Clay';
  if (clay >= 27) return sand > 45 ? 'Sandy clay loam' : silt >= 40 ? 'Silty clay loam' : 'Clay loam';
  if (clay >= 20 && sand > 45) return 'Sandy clay loam';
  if (silt >= 80 && clay < 12) return 'Silt';
  if (silt >= 50) return 'Silt loam';
  if (sand >= 85) return 'Sand';
  if (sand >= 70) return 'Loamy sand';
  if (sand >= 52) return 'Sandy loam';
  return 'Loam';
}

/**
 * The comparison engine: latest ESP32 sensor reading + reference soil data
 * (SoilGrids / RwaSIS imports) + crop requirements -> crop suitability, lime
 * advice, fertilizer option, and a ranking of the best-suited crops. Each run
 * is stored in AiRecommendation.
 */
@Injectable()
export class SoilIntelService implements OnModuleInit {
  private readonly logger = new Logger(SoilIntelService.name);

  constructor(private prisma: PrismaService, private farms: FarmsService) {}

  async onModuleInit() {
    try {
      await this.ensureReferenceData();
    } catch (e: any) {
      this.logger.warn(`Reference data not seeded yet: ${e?.message ?? e}`);
    }
  }

  // ---------------------------------------------------------------------
  // Reference data seeding (idempotent; never overwrites admin edits)
  // ---------------------------------------------------------------------
  async ensureReferenceData() {
    if ((await this.prisma.limeRecommendation.count()) === 0) {
      await this.prisma.limeRecommendation.createMany({ data: LIME_BANDS });
    }
    const crops = await this.prisma.crop.findMany({ select: { id: true, name: true, growingPeriodDays: true, rainfallRequirementsMm: true } });
    const byName = new Map(crops.map((c) => [c.name.toLowerCase(), c]));
    for (const r of CROP_REQUIREMENTS) {
      const crop = byName.get(r.crop.toLowerCase());
      if (!crop) continue;
      await this.prisma.cropSoilRequirement.upsert({
        where: { cropId: crop.id },
        update: {},
        create: {
          cropId: crop.id,
          phMin: r.phMin, phMax: r.phMax, phAbsMin: r.phAbsMin, phAbsMax: r.phAbsMax,
          nitrogenMinPpm: r.n[0], nitrogenMaxPpm: r.n[1],
          phosphorusMinPpm: r.p[0], phosphorusMaxPpm: r.p[1],
          potassiumMinPpm: r.k[0], potassiumMaxPpm: r.k[1],
          moistureMinPct: r.moisture[0], moistureMaxPct: r.moisture[1],
          waterRequirement: crop.rainfallRequirementsMm ? `${crop.rainfallRequirementsMm} mm/season` : null,
          maturityDays: crop.growingPeriodDays ?? null,
          limeResponsive: !!r.limeResponsive,
          source: REQUIREMENT_SOURCE,
          sourceUrl: SOURCES.ecocrop.url,
          notes: r.notes ?? null,
        },
      });
    }
    for (const f of FERTILIZER_OPTIONS) {
      const crop = byName.get(f.crop.toLowerCase());
      if (!crop) continue;
      await this.prisma.fertilizerRecommendation.upsert({
        where: { cropId_code: { cropId: crop.id, code: f.code } },
        update: {},
        create: {
          cropId: crop.id, code: f.code, name: f.name,
          dapKgHa: f.dap, npk171717KgHa: f.npk, ureaKgHa: f.urea, totalNKgHa: f.totalN,
          nitrogenLevel: f.nitrogenLevel, timing: f.timing, source: f.source, sourceUrl: f.sourceUrl, notes: f.notes,
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Reference soil (rwanda_soils): nearest cached point, else SoilGrids
  // ---------------------------------------------------------------------
  async referenceAt(lat: number, lng: number, areaId?: string | null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequestException('lat and lng are required numbers.');
    const d = 0.02; // ~2 km box, then exact distance check
    const near = await this.prisma.soilReference.findMany({
      where: { latitude: { gte: lat - d, lte: lat + d }, longitude: { gte: lng - d, lte: lng + d } },
    });
    const best = near
      .map((p) => ({ p, dist: km(lat, lng, p.latitude, p.longitude) }))
      .filter((x) => x.dist <= REFERENCE_RADIUS_KM)
      .sort((a, b) => a.dist - b.dist)[0];
    if (best) return best.p;
    return this.fetchSoilGrids(lat, lng, areaId ?? null);
  }

  private async fetchSoilGrids(lat: number, lng: number, areaId: string | null) {
    const props = ['phh2o', 'nitrogen', 'soc', 'cec', 'clay', 'sand', 'silt'];
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}`
      + props.map((p) => `&property=${p}`).join('')
      + '&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), SOILGRIDS_TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`SoilGrids HTTP ${res.status}`);
      const json: any = await res.json();
      const out: Record<string, number | null> = {};
      for (const layer of json?.properties?.layers ?? []) {
        const dFactor = layer?.unit_measure?.d_factor || 1;
        let sum = 0; let wsum = 0;
        for (const depth of layer.depths ?? []) {
          const mean = depth?.values?.mean;
          if (mean == null) continue;
          const w = (depth.range?.bottom_depth ?? 0) - (depth.range?.top_depth ?? 0) || 1;
          sum += (mean / dFactor) * w; wsum += w;
        }
        out[layer.name] = wsum ? Math.round((sum / wsum) * 100) / 100 : null;
      }
      if (Object.values(out).every((v) => v == null)) return null; // e.g. water / no-data pixel
      return this.prisma.soilReference.create({
        data: {
          latitude: lat, longitude: lng, areaId, depthLabel: '0-30cm',
          ph: out.phh2o ?? null,
          nitrogenGKg: out.nitrogen ?? null,
          organicCarbonGKg: out.soc ?? null,
          cecCmolKg: out.cec ?? null,
          clayPct: out.clay ?? null, sandPct: out.sand ?? null, siltPct: out.silt ?? null,
          texture: textureClass(out.clay, out.sand, out.silt),
          source: SOURCES.soilGrids.name,
          sourceUrl: url,
          raw: json,
        },
      });
    } catch (e: any) {
      this.logger.warn(`SoilGrids lookup failed for ${lat},${lng}: ${e?.message ?? e}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // Comparison engine
  // ---------------------------------------------------------------------
  private scoreCrop(req: Requirement, v: Values) {
    let earned = 0; let possible = 0;
    const add = (weight: number, pts: number | null) => { if (pts == null) return; possible += weight; earned += weight * pts; };

    if (v.ph != null) {
      if (v.ph >= req.phMin && v.ph <= req.phMax) add(35, 1);
      else if ((req.phAbsMin == null || v.ph >= req.phAbsMin) && (req.phAbsMax == null || v.ph <= req.phAbsMax)) add(35, 0.5);
      else add(35, 0);
    }
    const nb = band(v.nitrogenPpm, req.nitrogenMinPpm, req.nitrogenMaxPpm);
    const pb = band(v.phosphorusPpm, req.phosphorusMinPpm, req.phosphorusMaxPpm);
    const kb = band(v.potassiumPpm, req.potassiumMinPpm, req.potassiumMaxPpm);
    const mb = band(v.moisturePct, req.moistureMinPct, req.moistureMaxPct);
    // Nutrients that are low can be fixed with fertilizer, so they cost less than a pH mismatch.
    add(15, nb === 'UNKNOWN' ? null : nb === 'OK' ? 1 : 0.4);
    add(15, pb === 'UNKNOWN' ? null : pb === 'OK' ? 1 : 0.4);
    add(15, kb === 'UNKNOWN' ? null : kb === 'OK' ? 1 : 0.4);
    add(20, mb === 'UNKNOWN' ? null : mb === 'OK' ? 1 : 0.3);
    return possible ? Math.round((earned / possible) * 100) : null;
  }

  private nitrogenLevel(n: number | null, req?: Requirement | null): 'LOW' | 'MEDIUM' | 'HIGH' | null {
    if (n == null || !req || req.nitrogenMinPpm == null || req.nitrogenMaxPpm == null) return null;
    if (n < req.nitrogenMinPpm) return 'LOW';
    return n >= req.nitrogenMinPpm + 0.5 * (req.nitrogenMaxPpm - req.nitrogenMinPpm) ? 'HIGH' : 'MEDIUM';
  }

  private async locate(farm: any, reading: any): Promise<{ lat: number; lng: number; from: string } | null> {
    if (farm.latitude != null && farm.longitude != null) return { lat: farm.latitude, lng: farm.longitude, from: 'FARM' };
    if (reading?.latitude != null && reading?.longitude != null) return { lat: reading.latitude, lng: reading.longitude, from: 'SENSOR_GPS' };
    let areaId: string | null = farm.areaId;
    for (let i = 0; areaId && i < 6; i++) {
      const a = await this.prisma.adminArea.findUnique({ where: { id: areaId } });
      if (!a) break;
      if (a.latitude != null && a.longitude != null) return { lat: a.latitude, lng: a.longitude, from: `AREA_${a.level}` };
      areaId = a.parentId;
    }
    return null;
  }

  async analyze(farmId: string, user: AuthenticatedUser, cropId?: string) {
    const farm: any = await this.farms.findOne(farmId, user);
    if ((await this.prisma.cropSoilRequirement.count()) === 0) await this.ensureReferenceData();

    const reading = await this.prisma.soilReading.findFirst({ where: { farmId }, orderBy: { recordedAt: 'desc' } });

    // Crop: explicit choice, else the farm's most recent non-harvested crop.
    let crop: any = null;
    if (cropId) crop = await this.prisma.crop.findUnique({ where: { id: cropId } });
    if (!crop) {
      const fc = [...(farm.farmCrops ?? [])]
        .filter((x: any) => x.status !== 'HARVESTED' && x.status !== 'FAILED')
        .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
      crop = fc?.crop ?? null;
    }

    const loc = await this.locate(farm, reading);
    const reference = loc ? await this.referenceAt(loc.lat, loc.lng, farm.areaId) : null;

    const values: Values = {
      ph: reading?.ph ?? reference?.ph ?? null,
      phSource: reading?.ph != null ? 'SENSOR' : reference?.ph != null ? 'REFERENCE' : null,
      nitrogenPpm: reading?.nitrogenPpm ?? null,
      phosphorusPpm: reading?.phosphorusPpm ?? null,
      potassiumPpm: reading?.potassiumPpm ?? null,
      moisturePct: reading?.moisturePct ?? null,
    };

    const allReqs = await this.prisma.cropSoilRequirement.findMany({ include: { crop: true } });
    const req = crop ? (allReqs.find((r) => r.cropId === crop.id) as Requirement | undefined) ?? null : null;

    // Parameter-by-parameter comparison for the chosen crop
    const comparisons = [
      { key: 'ph', label: 'Soil pH', unit: '', sensor: reading?.ph ?? null, reference: reference?.ph ?? null, min: req?.phMin ?? null, max: req?.phMax ?? null },
      { key: 'nitrogen', label: 'Nitrogen (N)', unit: 'mg/kg', sensor: reading?.nitrogenPpm ?? null, reference: null, min: req?.nitrogenMinPpm ?? null, max: req?.nitrogenMaxPpm ?? null },
      { key: 'phosphorus', label: 'Phosphorus (P)', unit: 'mg/kg', sensor: reading?.phosphorusPpm ?? null, reference: reference?.phosphorusMgKg ?? null, min: req?.phosphorusMinPpm ?? null, max: req?.phosphorusMaxPpm ?? null },
      { key: 'potassium', label: 'Potassium (K)', unit: 'mg/kg', sensor: reading?.potassiumPpm ?? null, reference: reference?.potassiumMgKg ?? null, min: req?.potassiumMinPpm ?? null, max: req?.potassiumMaxPpm ?? null },
      { key: 'moisture', label: 'Soil moisture', unit: '%', sensor: reading?.moisturePct ?? null, reference: null, min: req?.moistureMinPct ?? null, max: req?.moistureMaxPct ?? null },
    ].map((c) => ({ ...c, status: band(c.sensor ?? (c.key === 'ph' ? c.reference : null), c.min, c.max) }));

    // Lime
    const limeBands = await this.prisma.limeRecommendation.findMany({ orderBy: { phFrom: 'asc' } });
    const limeBand = values.ph != null ? limeBands.find((b) => values.ph! >= b.phFrom && values.ph! < b.phTo) ?? null : null;
    const lime = limeBand && {
      ...limeBand,
      ph: values.ph,
      phSource: values.phSource,
      needed: limeBand.rateTHa != null || (limeBand.fertilityClass === 'MEDIUM' && !!req?.limeResponsive),
      cropNote: req && values.ph! < req.phMin
        ? `${crop.name} prefers pH ${req.phMin}-${req.phMax}; this soil is below that range.`
        : null,
    };

    // Fertilizer
    const nLevel = this.nitrogenLevel(values.nitrogenPpm, req);
    const options = crop ? await this.prisma.fertilizerRecommendation.findMany({ where: { cropId: crop.id }, orderBy: { code: 'asc' } }) : [];
    const chosen = options.find((o) => o.nitrogenLevel === nLevel) ?? options.find((o) => o.nitrogenLevel === 'ANY') ?? null;
    const nutrientNotes: string[] = [];
    const cmp = (k: string) => comparisons.find((c) => c.key === k)?.status;
    if (cmp('nitrogen') === 'LOW') nutrientNotes.push('Nitrogen is below the crop range: plan a urea top-dress.');
    if (cmp('phosphorus') === 'LOW') nutrientNotes.push('Phosphorus is low: use a P-containing basal fertilizer (DAP or NPK 17-17-17) at planting.');
    if (cmp('potassium') === 'LOW') nutrientNotes.push('Potassium is low: choose a K-containing fertilizer (NPK 17-17-17, or KCl where advised).');
    if (cmp('nitrogen') === 'HIGH') nutrientNotes.push('Nitrogen is above the crop range: reduce or skip urea this season.');
    const fertilizer = {
      nitrogenLevel: nLevel,
      recommended: chosen,
      options,
      nutrientNotes,
      note: options.length
        ? 'The official option for your exact plot comes from RwaSIS; confirm it on Smart Nkunganire before buying. AgriLink picks among the options using your sensor nitrogen reading.'
        : `No sourced fertilizer rates are loaded for ${crop?.name ?? 'this crop'} yet. Get the site-specific rate for your plot from Smart Nkunganire.`,
      moreInfoUrl: SOURCES.smartNkunganire.url,
    };

    // Crop ranking
    const ranking = allReqs
      .map((r) => ({ cropId: r.cropId, name: r.crop.name, localName: r.crop.localName, score: this.scoreCrop(r as Requirement, values), phRange: `${r.phMin}-${r.phMax}` }))
      .filter((r) => r.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5);

    const score = req ? this.scoreCrop(req, values) : null;
    const hasData = !!reading || !!reference;
    const status = !hasData ? 'NO_DATA'
      : score == null ? 'NO_CROP'
      : score >= 80 ? 'SUITABLE' : score >= 60 ? 'MODERATE' : 'POOR';

    const parts: string[] = [];
    if (!hasData) parts.push('No sensor reading or reference soil data yet. Connect the sensor or add the farm\'s GPS location.');
    else {
      if (crop && score != null) parts.push(`${crop.name}: ${score}/100 suitability (${status.toLowerCase()}).`);
      if (!crop) parts.push('Pick a crop to get crop-specific advice.');
      if (lime?.needed && lime.rateTHa) parts.push(`Apply ${lime.product} at ${lime.rateTHa} t/ha (pH ${values.ph}).`);
      if (fertilizer.recommended) parts.push(`Fertilizer: ${fertilizer.recommended.name}.`);
      if (ranking[0] && ranking[0].cropId !== crop?.id) parts.push(`Best match for this soil: ${ranking[0].name} (${ranking[0].score}/100).`);
    }
    const summary = parts.join(' ');

    const details = {
      location: loc,
      reading: reading && { id: reading.id, recordedAt: reading.recordedAt, ...values },
      reference: reference && {
        id: reference.id, ph: reference.ph, nitrogenGKg: reference.nitrogenGKg, organicCarbonGKg: reference.organicCarbonGKg,
        cecCmolKg: reference.cecCmolKg, clayPct: reference.clayPct, sandPct: reference.sandPct, siltPct: reference.siltPct,
        texture: reference.texture, phosphorusMgKg: reference.phosphorusMgKg, potassiumMgKg: reference.potassiumMgKg,
        source: reference.source, depth: reference.depthLabel,
      },
      crop: crop && { id: crop.id, name: crop.name, localName: crop.localName },
      requirement: req,
      comparisons,
      lime,
      fertilizer,
      ranking,
      disclaimer: 'Decision support only. N/P/K and moisture bands are AgriLink defaults pending calibration with RAB soil-lab results; confirm fertilizer choices on Smart Nkunganire.',
    };

    const saved = await this.prisma.aiRecommendation.create({
      data: {
        farmId, cropId: crop?.id ?? null, readingId: reading?.id ?? null, soilReferenceId: reference?.id ?? null,
        suitabilityScore: score, status, summary, details: details as any, engineVersion: ENGINE_VERSION, createdById: user.id,
      },
    });
    return { id: saved.id, createdAt: saved.createdAt, status, summary, suitabilityScore: score, engineVersion: ENGINE_VERSION, ...details };
  }

  async history(farmId: string, user: AuthenticatedUser, limit = 10) {
    await this.farms.findOne(farmId, user);
    return this.prisma.aiRecommendation.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      select: { id: true, createdAt: true, status: true, summary: true, suitabilityScore: true, crop: { select: { name: true } } },
    });
  }

  async cropRequirements() {
    const [requirements, fertilizer, lime] = await Promise.all([
      this.prisma.cropSoilRequirement.findMany({ include: { crop: { select: { name: true, localName: true, scientificName: true } } } }),
      this.prisma.fertilizerRecommendation.findMany({ include: { crop: { select: { name: true } } } }),
      this.prisma.limeRecommendation.findMany({ orderBy: { phFrom: 'asc' } }),
    ]);
    return { requirements, fertilizer, lime };
  }
}
