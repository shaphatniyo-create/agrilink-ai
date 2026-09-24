/**
 * Crop.diseaseInfo/pestInfo (seeded per pilot crop) only covers named
 * diseases/pests. Nutrient deficiencies and water stress aren't crop-specific
 * in the same way, so they're kept as a small, crop-agnostic static library
 * here rather than duplicated onto every Crop row. Extend this list (or move
 * it into the DB) as real agronomist-reviewed content becomes available.
 */
export interface GenericSymptomEntry {
  name: string;
  category: 'NUTRIENT_DEFICIENCY' | 'WATER_STRESS';
  symptoms: string;
  management: string;
}

export const GENERIC_SYMPTOM_LIBRARY: GenericSymptomEntry[] = [
  {
    name: 'Nitrogen deficiency',
    category: 'NUTRIENT_DEFICIENCY',
    symptoms: 'yellowing of older lower leaves general pale chlorosis stunted slow growth',
    management: 'Apply a nitrogen-rich fertilizer (e.g. urea) in split doses through the growing season; incorporate composted manure to build long-term soil nitrogen.',
  },
  {
    name: 'Phosphorus deficiency',
    category: 'NUTRIENT_DEFICIENCY',
    symptoms: 'dark green or purplish tinged leaves stunted root development delayed flowering maturity',
    management: 'Apply a phosphorus fertilizer (e.g. DAP) at planting time, placed near the root zone; check and correct very acidic soil pH, which locks up phosphorus.',
  },
  {
    name: 'Potassium deficiency',
    category: 'NUTRIENT_DEFICIENCY',
    symptoms: 'yellow to brown scorched dried leaf edges margins weak thin stems poor fruit or grain fill',
    management: 'Apply a potassium-rich fertilizer (e.g. muriate of potash); avoid heavy nitrogen application without matching potassium, which worsens the deficiency.',
  },
  {
    name: 'Water stress (drought)',
    category: 'WATER_STRESS',
    symptoms: 'wilting curling drooping leaves dry cracked soil stunted growth premature leaf drop',
    management: 'Increase irrigation frequency, prioritizing the flowering/grain-fill stage; apply mulch around plants to reduce soil moisture loss.',
  },
  {
    name: 'Waterlogging / excess soil moisture',
    category: 'WATER_STRESS',
    symptoms: 'yellowing wilting despite visibly wet soil root rot standing water poor drainage',
    management: 'Improve field drainage (furrows, raised beds in low-lying plots) and reduce irrigation frequency until the soil dries out.',
  },
];
