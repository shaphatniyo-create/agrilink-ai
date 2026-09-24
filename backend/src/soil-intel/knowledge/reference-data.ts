/**
 * Reference data for the soil-intelligence engine. Seeded idempotently into
 * LimeRecommendation / CropSoilRequirement / FertilizerRecommendation at
 * startup (see SoilIntelService#ensureReferenceData).
 *
 * Every row states its source. Values labelled "AgriLink default" have NO
 * published source: they are working bands for the low-cost RS485 NPK probe
 * and must be calibrated (e.g. against RAB soil-lab results) before being
 * presented as official advice. Replace/extend with RwaSIS / RAB files when
 * they are available.
 */

export const SOURCES = {
  faoGsp: {
    name: 'FAO Global Soil Partnership - Rwanda priorities',
    url: 'https://www.fao.org/fileadmin/user_upload/GSP/docs/elmina/Rwanda_Priorities.pdf',
  },
  oafTravertine: {
    name: 'One Acre Fund - Targeting travertine application in Rwanda',
    url: 'https://oneacrefund.org/sites/default/files/2023-09/Targeting_Travertine_Application_in_Rwanda.pdf',
  },
  ecocrop: {
    name: 'FAO ECOCROP (approximate pH ranges)',
    url: 'https://gaez.fao.org/pages/ecocrop',
  },
  maizeSsr: {
    name: 'CGIAR & RAB - Smart Fertiliser Recommendations for Maize in Rwanda (Nov 2025), Table 2',
    url: 'https://cgspace.cgiar.org/bitstreams/ddda75f4-25c5-4d38-8160-6b35f237033f/download',
  },
  smartNkunganire: {
    name: 'RwaSIS site-specific recommendations via Smart Nkunganire',
    url: 'https://smartnkunganire.rw/',
  },
  soilGrids: {
    name: 'ISRIC SoilGrids 2.0',
    url: 'https://rest.isric.org/soilgrids/v2.0/docs',
  },
} as const;

/** Fertility classes (pH in water): FAO GSP. Travertine rates: One Acre Fund. */
export const LIME_BANDS = [
  {
    phFrom: 0, phTo: 5.2, fertilityClass: 'INFERTILE',
    product: 'Travertine (agricultural lime)', rateTHa: 2.5, altRateTHa: 1.5,
    frequency: 'Once every 2 years (4 growing seasons)',
    advice: 'Soil is strongly acidic (pH below 5.2). Apply travertine before planting and mix it into the topsoil. 1.5 t/ha is an acceptable lower-cost option. Beans respond more to liming than maize.',
    source: `${SOURCES.oafTravertine.name}; ${SOURCES.faoGsp.name}`, sourceUrl: SOURCES.oafTravertine.url,
  },
  {
    phFrom: 5.2, phTo: 5.5, fertilityClass: 'MEDIUM',
    product: 'Travertine (agricultural lime)', rateTHa: null, altRateTHa: null, frequency: null,
    advice: 'Soil is moderately acidic (pH 5.2-5.5). Liming is usually not needed for maize; consider it for lime-responsive crops such as beans, and re-test next season.',
    source: `${SOURCES.faoGsp.name}; ${SOURCES.oafTravertine.name}`, sourceUrl: SOURCES.faoGsp.url,
  },
  {
    phFrom: 5.5, phTo: 14, fertilityClass: 'FERTILE',
    product: null, rateTHa: null, altRateTHa: null, frequency: null,
    advice: 'pH is above 5.5: no liming needed.',
    source: SOURCES.faoGsp.name, sourceUrl: SOURCES.faoGsp.url,
  },
];

const REQ_SOURCE = `pH: ${SOURCES.ecocrop.name}. N/P/K & moisture: AgriLink default sensor bands (unverified - calibrate with RAB soil lab).`;

type Req = {
  crop: string; phMin: number; phMax: number; phAbsMin: number; phAbsMax: number;
  n: [number, number]; p: [number, number]; k: [number, number]; moisture: [number, number];
  limeResponsive?: boolean; notes?: string;
};

export const CROP_REQUIREMENTS: Req[] = [
  { crop: 'Maize',            phMin: 5.5, phMax: 7.0, phAbsMin: 4.5, phAbsMax: 8.5, n: [80, 250], p: [40, 400], k: [100, 400], moisture: [35, 80] },
  { crop: 'Irish Potato',     phMin: 5.0, phMax: 6.5, phAbsMin: 4.5, phAbsMax: 8.0, n: [80, 250], p: [40, 400], k: [120, 400], moisture: [40, 80], notes: 'Tolerates acidity better than most crops.' },
  { crop: 'Common Bean',      phMin: 5.5, phMax: 7.0, phAbsMin: 4.5, phAbsMax: 8.0, n: [40, 200], p: [40, 400], k: [100, 400], moisture: [35, 75], limeResponsive: true, notes: 'Responds well to liming on acid soils.' },
  { crop: 'Coffee (Arabica)', phMin: 5.0, phMax: 6.0, phAbsMin: 4.3, phAbsMax: 7.5, n: [80, 250], p: [30, 400], k: [100, 400], moisture: [40, 80] },
  { crop: 'Cassava',          phMin: 5.5, phMax: 6.5, phAbsMin: 4.0, phAbsMax: 8.0, n: [40, 200], p: [20, 400], k: [80, 400],  moisture: [25, 75], notes: 'Very tolerant of acid, low-fertility soils.' },
  { crop: 'Tomato',           phMin: 5.5, phMax: 6.8, phAbsMin: 4.3, phAbsMax: 8.0, n: [80, 250], p: [40, 400], k: [120, 400], moisture: [45, 80] },
  { crop: 'Banana',           phMin: 5.5, phMax: 7.0, phAbsMin: 4.5, phAbsMax: 8.0, n: [80, 250], p: [30, 400], k: [150, 500], moisture: [45, 85], notes: 'High potassium demand.' },
  { crop: 'Sorghum',          phMin: 5.5, phMax: 7.5, phAbsMin: 5.0, phAbsMax: 8.5, n: [60, 250], p: [30, 400], k: [100, 400], moisture: [25, 75], notes: 'Drought tolerant.' },
  { crop: 'Rice',             phMin: 5.5, phMax: 7.0, phAbsMin: 4.0, phAbsMax: 8.0, n: [80, 250], p: [30, 400], k: [100, 400], moisture: [70, 100], notes: 'Lowland/paddy crop - keep soil saturated.' },
].map((r) => ({ ...r })) as Req[];

export const REQUIREMENT_SOURCE = REQ_SOURCE;

/**
 * Maize options from the CGIAR/RAB Nov 2025 report. The SSR option for a plot
 * is normally assigned by location through RwaSIS / Smart Nkunganire; linking
 * an option to the sensor N band ("nitrogenLevel") is an AgriLink heuristic.
 */
export const FERTILIZER_OPTIONS = [
  { crop: 'Maize', code: 'BR',   name: 'National blanket recommendation', dap: 100, npk: 0,   urea: 100, totalN: 64,  nitrogenLevel: 'ANY',    notes: 'Previous country-wide recommendation.' },
  { crop: 'Maize', code: 'SSR1', name: 'Site-specific option 1',           dap: 25,  npk: 50,  urea: 100, totalN: 59,  nitrogenLevel: 'HIGH',   notes: 'Lowest N: for plots where soil N is already adequate.' },
  { crop: 'Maize', code: 'SSR2', name: 'Site-specific option 2',           dap: 50,  npk: 100, urea: 175, totalN: 107, nitrogenLevel: 'MEDIUM', notes: null },
  { crop: 'Maize', code: 'SSR3', name: 'Site-specific option 3',           dap: 50,  npk: 100, urea: 200, totalN: 118, nitrogenLevel: 'LOW',    notes: 'Highest N: for N-poor plots.' },
].map((f) => ({
  ...f,
  timing: 'Basal (DAP / NPK) by spot application at planting; urea top-dress at 6-8 leaves (about 4-6 weeks after emergence).',
  source: SOURCES.maizeSsr.name,
  sourceUrl: SOURCES.maizeSsr.url,
}));
