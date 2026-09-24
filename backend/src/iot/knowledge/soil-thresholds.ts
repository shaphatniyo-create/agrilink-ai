import { SensorAlertType, WeatherAlertSeverity } from '@prisma/client';

/**
 * Conservative, illustrative default thresholds for a generic NPK
 * multi-parameter soil probe. These are NOT crop-specific -- a real deployment
 * would want to derive bands from Crop.soilRequirements per farm-crop, but
 * that data isn't structured for it yet (it's free text). Until then, this
 * gives farmers a genuinely useful early-warning signal instead of nothing,
 * and is a natural place to plug in per-crop bands later without touching
 * IotService's ingest logic.
 */
export interface ThresholdRule {
  type: SensorAlertType;
  severity: WeatherAlertSeverity;
  message: string;
  recommendation: string;
  /** Returns true if this reading breaches the rule. */
  breaches: (reading: {
    moisturePct?: number | null;
    ph?: number | null;
    nitrogenPpm?: number | null;
    phosphorusPpm?: number | null;
    potassiumPpm?: number | null;
  }) => boolean;
}

export const SOIL_THRESHOLD_RULES: ThresholdRule[] = [
  {
    type: 'LOW_MOISTURE',
    severity: 'WARNING',
    message: 'Soil moisture is critically low.',
    recommendation: 'Irrigate soon if the crop is in a moisture-sensitive growth stage.',
    breaches: (r) => typeof r.moisturePct === 'number' && r.moisturePct < 20,
  },
  {
    type: 'HIGH_MOISTURE',
    severity: 'WATCH',
    message: 'Soil moisture is very high -- possible waterlogging.',
    recommendation: 'Check drainage; prolonged waterlogging can damage roots.',
    breaches: (r) => typeof r.moisturePct === 'number' && r.moisturePct > 85,
  },
  {
    type: 'PH_LOW',
    severity: 'WATCH',
    message: 'Soil pH is quite acidic.',
    recommendation: 'Consider liming; strongly acidic soil limits nutrient uptake for most crops.',
    breaches: (r) => typeof r.ph === 'number' && r.ph < 5.0,
  },
  {
    type: 'PH_HIGH',
    severity: 'WATCH',
    message: 'Soil pH is quite alkaline.',
    recommendation: 'Consider sulfur or organic matter amendments; alkaline soil can lock out iron and zinc.',
    breaches: (r) => typeof r.ph === 'number' && r.ph > 8.0,
  },
  {
    type: 'LOW_NITROGEN',
    severity: 'ADVISORY',
    message: 'Nitrogen reading is low.',
    recommendation: 'A nitrogen top-dress may be worth considering for the current crop stage.',
    breaches: (r) => typeof r.nitrogenPpm === 'number' && r.nitrogenPpm < 20,
  },
  {
    type: 'LOW_PHOSPHORUS',
    severity: 'ADVISORY',
    message: 'Phosphorus reading is low.',
    recommendation: 'Low phosphorus can slow root development and flowering.',
    breaches: (r) => typeof r.phosphorusPpm === 'number' && r.phosphorusPpm < 10,
  },
  {
    type: 'LOW_POTASSIUM',
    severity: 'ADVISORY',
    message: 'Potassium reading is low.',
    recommendation: 'Low potassium can weaken stems and reduce disease resistance.',
    breaches: (r) => typeof r.potassiumPpm === 'number' && r.potassiumPpm < 15,
  },
];

/** A device is treated as offline if it's never reported, or hasn't reported in this long. */
export const DEVICE_OFFLINE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours
