/**
 * Local TF-IDF + cosine-similarity plant-disease inference engine.
 *
 * Architecture
 * ─────────────
 *  1. At startup the engine indexes every DiseaseEntry from the knowledge base:
 *     • tokenises symptom + visualSigns text
 *     • computes IDF for every unique term across the corpus
 *     • pre-computes TF-IDF unit-vector for each entry
 *
 *  2. At query time:
 *     • tokenise the farmer's symptom text (+ optional image-feature hints)
 *     • compute query TF-IDF vector
 *     • score each entry via cosine similarity
 *     • apply crop-match boost so per-crop diseases rank above generic ones
 *     • return top-N results with explanations
 *
 * No external API, no network call, no Python — runs entirely inside the
 * Node.js process.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PLANT_DISEASE_KB, DiseaseEntry } from './knowledge/plant-disease-kb';

export interface DiagnosisMatch {
  entry: DiseaseEntry;
  score: number;          // 0-1 cosine similarity (after crop boost)
  confidence: number;     // same, rounded to 2 dp
  matchedTerms: string[]; // terms that contributed to the score
}

export interface ImageFeatures {
  /** Dominant hue of the discoloured/abnormal area (0-360) */
  dominantHue?: number;
  /** Fraction of image pixels that are yellow/brown (0-1) */
  yellowRatio?: number;
  /** Whether significant necrotic (dark-brown/black) tissue was detected */
  highNecrosis?: boolean;
  /** Pattern detected by frontend Canvas analysis */
  lesionPattern?: 'SPOTS' | 'STRIPES' | 'BLIGHT' | 'MOSAIC' | 'WILT' | 'POWDER' | 'NONE';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'or', 'in', 'on', 'at', 'to', 'of', 'a', 'an', 'is', 'are',
  'was', 'be', 'by', 'with', 'from', 'as', 'for', 'its', 'it', 'this', 'that',
  'which', 'can', 'may', 'will', 'has', 'have', 'had', 'not', 'but', 'all',
  'more', 'also', 'if', 'are', 'do', 'does', 'would', 'very', 'than', 'each',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1 / tokens.length);
  return tf;
}

function dotProduct(a: Map<string, number>, b: Map<string, number>): number {
  let sum = 0;
  for (const [term, val] of a) {
    const bVal = b.get(term);
    if (bVal !== undefined) sum += val * bVal;
  }
  return sum;
}

function magnitude(v: Map<string, number>): number {
  let sq = 0;
  for (const val of v.values()) sq += val * val;
  return Math.sqrt(sq);
}

// ── Engine ───────────────────────────────────────────────────────────────────

interface IndexedEntry {
  entry: DiseaseEntry;
  tfidfVec: Map<string, number>;
  magnitude: number;
  terms: Set<string>;
}

@Injectable()
export class PlantDoctorEngine implements OnModuleInit {
  private index: IndexedEntry[] = [];
  private idf: Map<string, number> = new Map();
  private N = 0;

  onModuleInit() {
    this.buildIndex();
  }

  private buildIndex() {
    this.N = PLANT_DISEASE_KB.length;

    // Step 1: collect document frequency (df) for each term
    const df = new Map<string, number>();
    const rawTokens: string[][] = [];

    for (const entry of PLANT_DISEASE_KB) {
      const tokens = tokenize(`${entry.symptoms} ${entry.visualSigns} ${entry.name}`);
      rawTokens.push(tokens);
      const seen = new Set(tokens);
      for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
    }

    // Step 2: IDF
    this.idf = new Map();
    for (const [term, docCount] of df) {
      this.idf.set(term, Math.log((this.N + 1) / (docCount + 1)) + 1); // smoothed
    }

    // Step 3: TF-IDF vectors
    this.index = [];
    for (let i = 0; i < PLANT_DISEASE_KB.length; i++) {
      const entry = PLANT_DISEASE_KB[i];
      const tokens = rawTokens[i];
      const tf = termFreq(tokens);
      const tfidfVec = new Map<string, number>();
      for (const [term, tfVal] of tf) {
        const idfVal = this.idf.get(term) ?? 1;
        tfidfVec.set(term, tfVal * idfVal);
      }
      const mag = magnitude(tfidfVec);
      this.index.push({
        entry,
        tfidfVec,
        magnitude: mag,
        terms: new Set(tokens),
      });
    }
  }

  /**
   * Score all knowledge-base entries against the farmer's symptom description.
   *
   * @param symptomsText   Free-text symptom description from the farmer
   * @param cropName       Name of the crop (used for boost)
   * @param imageFeatures  Optional features extracted from an uploaded photo
   * @param topN           Number of results to return (default 3)
   */
  diagnose(
    symptomsText: string,
    cropName: string,
    imageFeatures?: ImageFeatures,
    topN = 3,
  ): DiagnosisMatch[] {
    // Build query vector (text + image hints appended as virtual text)
    let queryText = symptomsText;
    if (imageFeatures) queryText += ' ' + this.imageFeaturesToText(imageFeatures);

    const queryTokens = tokenize(queryText);
    if (queryTokens.length === 0) return [];

    const qTf = termFreq(queryTokens);
    const qVec = new Map<string, number>();
    for (const [term, tfVal] of qTf) {
      const idfVal = this.idf.get(term) ?? Math.log((this.N + 1) / 1) + 1;
      qVec.set(term, tfVal * idfVal);
    }
    const qMag = magnitude(qVec);
    if (qMag === 0) return [];

    const cropLower = cropName.toLowerCase();

    const scored: DiagnosisMatch[] = this.index.map((idx) => {
      // Cosine similarity
      let sim = dotProduct(qVec, idx.tfidfVec) / (qMag * (idx.magnitude || 1));

      // Crop-match boost: diseases explicitly listed for this crop rank higher
      const cropBoost = idx.entry.crops.some(
        (c) => cropLower.includes(c) || c.includes(cropLower),
      ) ? 1.35 : 1.0;

      // Image hint boost: if image features match the entry's imageHints
      const imgBoost = this.imageBoost(imageFeatures, idx.entry);

      sim = Math.min(1, sim * cropBoost * imgBoost);

      // Which query terms matched?
      const matchedTerms = queryTokens.filter((t) => idx.terms.has(t));

      return {
        entry: idx.entry,
        score: sim,
        confidence: Math.round(sim * 100) / 100,
        matchedTerms: [...new Set(matchedTerms)].slice(0, 6),
      };
    });

    return scored
      .filter((s) => s.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  /** Convert image features to extra symptom tokens for the TF-IDF query */
  private imageFeaturesToText(f: ImageFeatures): string {
    const parts: string[] = [];
    if (f.highNecrosis) parts.push('brown black dead necrotic dark tissue');
    if (typeof f.yellowRatio === 'number' && f.yellowRatio > 0.3)
      parts.push('yellow chlorosis yellowing');
    if (f.lesionPattern === 'SPOTS')   parts.push('spots circular lesions');
    if (f.lesionPattern === 'STRIPES') parts.push('stripes streaks parallel lines');
    if (f.lesionPattern === 'BLIGHT')  parts.push('blight large lesions rapid spread');
    if (f.lesionPattern === 'MOSAIC')  parts.push('mosaic mottling irregular patches');
    if (f.lesionPattern === 'WILT')    parts.push('wilting drooping collapse');
    if (f.lesionPattern === 'POWDER')  parts.push('powdery white coating spores');
    if (f.dominantHue !== undefined) {
      if (f.dominantHue < 40)  parts.push('brown rust orange discoloration');
      if (f.dominantHue < 80)  parts.push('yellow chlorotic');
      if (f.dominantHue > 240) parts.push('purple dark discoloration');
    }
    return parts.join(' ');
  }

  /** Multiplier when image features match the entry's imageHints */
  private imageBoost(f: ImageFeatures | undefined, entry: DiseaseEntry): number {
    if (!f || !entry.imageHints) return 1.0;
    const h = entry.imageHints;
    let boost = 1.0;

    if (h.lesionPattern && f.lesionPattern === h.lesionPattern) boost *= 1.3;
    if (h.highNecrosis && f.highNecrosis) boost *= 1.2;
    if (h.yellowRatio === 'HIGH' && typeof f.yellowRatio === 'number' && f.yellowRatio > 0.3) boost *= 1.15;
    if (h.yellowRatio === 'MEDIUM' && typeof f.yellowRatio === 'number' && f.yellowRatio > 0.15) boost *= 1.1;
    if (h.dominantHue && f.dominantHue !== undefined) {
      const [lo, hi] = h.dominantHue;
      const inRange = lo <= hi
        ? f.dominantHue >= lo && f.dominantHue <= hi
        : f.dominantHue >= lo || f.dominantHue <= hi;
      if (inRange) boost *= 1.2;
    }
    return boost;
  }
}
