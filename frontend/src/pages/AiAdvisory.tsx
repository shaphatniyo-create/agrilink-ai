import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

type Tab = 'plantDoctor' | 'weather' | 'planner' | 'financial';

// ── Urgency helpers ───────────────────────────────────────────────────────────
const urgencyStyle: Record<string, string> = {
  LOW:      'bg-gray-100 text-gray-600',
  MEDIUM:   'bg-amber-100 text-amber-700',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};
const urgencyIcon: Record<string, string> = {
  LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴',
};

// ── Category badge ────────────────────────────────────────────────────────────
const catStyle: Record<string, string> = {
  FUNGAL:    'bg-purple-100 text-purple-700',
  BACTERIAL: 'bg-blue-100 text-blue-700',
  VIRAL:     'bg-pink-100 text-pink-700',
  PEST:      'bg-yellow-100 text-yellow-700',
  NUTRIENT:  'bg-teal-100 text-teal-700',
  WATER:     'bg-cyan-100 text-cyan-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL IMAGE ANALYSER (runs in-browser using Canvas API — no network call)
// Returns features compatible with ImageFeatures on the backend.
// ─────────────────────────────────────────────────────────────────────────────
interface ImageFeatures {
  dominantHue?: number;
  yellowRatio?: number;
  highNecrosis?: boolean;
  lesionPattern?: 'SPOTS' | 'STRIPES' | 'BLIGHT' | 'MOSAIC' | 'WILT' | 'POWDER' | 'NONE';
}

function analyseImage(file: File): Promise<ImageFeatures> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 200; // work on a small downscaled version for speed
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      // ── Pixel statistics ──────────────────────────────────────────────────
      const hueHist = new Array(36).fill(0); // 10° buckets
      let yellowPx = 0, brownBlackPx = 0, totalPx = 0;
      let hueSumX = 0, hueSumY = 0; // for circular mean

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const delta = max - min;
        const lightness = (max + min) / 2;
        const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

        // skip very dark or very light (background, sky)
        if (lightness < 0.08 || lightness > 0.92) { totalPx++; continue; }
        totalPx++;

        let hue = 0;
        if (delta > 0) {
          if (max === r) hue = 60 * (((g - b) / delta) % 6);
          else if (max === g) hue = 60 * ((b - r) / delta + 2);
          else hue = 60 * ((r - g) / delta + 4);
          if (hue < 0) hue += 360;
        }
        hueHist[Math.floor(hue / 10)]++;
        const radHue = (hue * Math.PI) / 180;
        hueSumX += Math.cos(radHue);
        hueSumY += Math.sin(radHue);

        // Yellow: hue 45-75, moderate-high saturation
        if (hue >= 45 && hue <= 75 && saturation > 0.3) yellowPx++;
        // Brown/black necrosis: dark (lightness < 0.35), low-medium saturation
        if (lightness < 0.35 && saturation < 0.5 && !(r > g && r > b && saturation > 0.5)) brownBlackPx++;
      }

      // Circular mean hue
      const meanHueDeg = (Math.atan2(hueSumY, hueSumX) * 180) / Math.PI;
      const dominantHue = meanHueDeg < 0 ? meanHueDeg + 360 : meanHueDeg;

      const yellowRatio  = totalPx > 0 ? yellowPx / totalPx : 0;
      const necrosisRatio = totalPx > 0 ? brownBlackPx / totalPx : 0;
      const highNecrosis = necrosisRatio > 0.15;

      // ── Pattern detection (coarse) ────────────────────────────────────────
      // Divide image into 4×4 grid of cells and compare variance between cells
      // High inter-cell contrast with small spots → SPOTS
      // Directional banding → STRIPES
      // Widespread necrosis → BLIGHT
      // Mottled low-sat yellow-green → MOSAIC
      const cellW = Math.floor(canvas.width / 4);
      const cellH = Math.floor(canvas.height / 4);
      const cellLuminance: number[] = [];
      for (let cy = 0; cy < 4; cy++) {
        for (let cx = 0; cx < 4; cx++) {
          let sum = 0, count = 0;
          for (let py = cy * cellH; py < (cy + 1) * cellH; py++) {
            for (let px = cx * cellW; px < (cx + 1) * cellW; px++) {
              const idx = (py * canvas.width + px) * 4;
              sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
              count++;
            }
          }
          cellLuminance.push(count > 0 ? sum / count / 255 : 0);
        }
      }
      const lumMean = cellLuminance.reduce((a, b) => a + b, 0) / 16;
      const lumVar = cellLuminance.reduce((s, v) => s + (v - lumMean) ** 2, 0) / 16;
      // Row vs column variance for stripe detection
      const rowMeans  = [0, 1, 2, 3].map((r) => (cellLuminance[r * 4] + cellLuminance[r * 4 + 1] + cellLuminance[r * 4 + 2] + cellLuminance[r * 4 + 3]) / 4);
      const colMeans  = [0, 1, 2, 3].map((c) => (cellLuminance[c] + cellLuminance[c + 4] + cellLuminance[c + 8] + cellLuminance[c + 12]) / 4);
      const rowVar = rowMeans.reduce((s, v) => s + (v - lumMean) ** 2, 0) / 4;
      const colVar = colMeans.reduce((s, v) => s + (v - lumMean) ** 2, 0) / 4;

      let lesionPattern: ImageFeatures['lesionPattern'] = 'NONE';
      if (highNecrosis && necrosisRatio > 0.35)            lesionPattern = 'BLIGHT';
      else if (rowVar > 0.02 || colVar > 0.02)             lesionPattern = 'STRIPES';
      else if (yellowRatio > 0.3 && lumVar < 0.01)         lesionPattern = 'MOSAIC';
      else if (lumVar > 0.008)                             lesionPattern = 'SPOTS';
      else if (yellowRatio > 0.2)                          lesionPattern = 'WILT';

      resolve({ dominantHue: Math.round(dominantHue), yellowRatio: Math.round(yellowRatio * 100) / 100, highNecrosis, lesionPattern });
    };
    img.onerror = () => resolve({});
    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnosis result card
// ─────────────────────────────────────────────────────────────────────────────
function DiagnosisResultCard({ result }: { result: any }) {
  if (!result) return null;
  const matches: any[] = result.findings?.matches ?? [];
  const top = matches[0];

  return (
    <div className="mt-5 space-y-4 animate-fade-in">
      {/* Primary diagnosis */}
      {top ? (
        <div className="rounded-2xl border border-agrigreen-200 bg-gradient-to-br from-agrigreen-50 to-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-agrigreen-800">🔬 {top.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catStyle[top.category] ?? 'bg-gray-100 text-gray-600'}`}>{top.category}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${urgencyStyle[top.urgency] ?? ''}`}>{urgencyIcon[top.urgency]} {top.urgency}</span>
          </div>

          {/* Confidence bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>AI Confidence</span>
              <span className="font-semibold text-agrigreen-700">{Math.round(top.score * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-agrigreen-400 to-agrigreen-600 transition-all duration-700"
                style={{ width: `${Math.round(top.score * 100)}%` }}
              />
            </div>
          </div>

          {/* Matched terms */}
          {top.matchedTerms?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {top.matchedTerms.map((t: string) => (
                <span key={t} className="rounded bg-agrigreen-100 px-1.5 py-0.5 font-mono text-[10px] text-agrigreen-700">{t}</span>
              ))}
            </div>
          )}

          {/* Treatment & prevention */}
          <div className="space-y-3">
            <div className="rounded-xl bg-white border border-gray-100 p-3">
              <p className="mb-1 text-xs font-semibold uppercase text-gray-400">💊 Treatment</p>
              <p className="text-sm text-gray-800">{top.management}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-100 p-3">
              <p className="mb-1 text-xs font-semibold uppercase text-gray-400">🛡️ Prevention</p>
              <p className="text-sm text-gray-800">{top.prevention}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{result.recommendation}</p>
        </div>
      )}

      {/* Secondary matches */}
      {matches.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Also consider</p>
          <div className="space-y-2">
            {matches.slice(1).map((m: any, i: number) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${catStyle[m.category] ?? 'bg-gray-100 text-gray-500'}`}>{m.category}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${urgencyStyle[m.urgency] ?? ''}`}>{urgencyIcon[m.urgency]}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{m.management}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-gray-400">{Math.round(m.score * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-300 text-right">
        AgriLink AI · Local TF-IDF plant disease model · {new Date(result.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plant Doctor panel
// ─────────────────────────────────────────────────────────────────────────────
function PlantDoctorPanel({ farms, crops }: { farms: any[]; crops: any[] }) {
  const { t } = useTranslation();
  const [cropId, setCropId] = useState('');
  const [farmId, setFarmId] = useState('');
  const [symptomsText, setSymptomsText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFeatures, setImageFeatures] = useState<ImageFeatures | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadHistory = () => api.get('/ai/diagnoses').then((r) => setHistory(r.data)).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  const handleImage = async (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setAnalysing(true);
    try {
      const features = await analyseImage(file);
      setImageFeatures(features);
    } finally {
      setAnalysing(false);
    }
  };

  const submit = async () => {
    setError('');
    if (!cropId) { setError(t('ai.selectCropFirst')); return; }
    if (!symptomsText.trim()) { setError('Please describe what you see on the plant.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/ai/plant-doctor', {
        cropId,
        farmId: farmId || undefined,
        symptomsText,
        imageNote: imageFile?.name,
        imageFeatures: imageFeatures ?? undefined,
      });
      setResult(data);
      loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('ai.error'));
    } finally {
      setLoading(false);
    }
  };

  const selectedCropName = crops.find((c) => c.id === cropId)?.name ?? '';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Input panel ─────────────────────────────────────────── */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* AI badge */}
        <div className="flex items-center gap-2 rounded-xl bg-agrigreen-50 border border-agrigreen-100 px-3 py-2">
          <span className="text-lg">🤖</span>
          <div>
            <p className="text-xs font-bold text-agrigreen-700">AgriLink Local AI</p>
            <p className="text-[10px] text-agrigreen-500">TF-IDF model · 50+ diseases · 9 crops · runs offline</p>
          </div>
        </div>

        {/* Crop + farm selects */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Crop *</label>
            <select className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-agrigreen-500 focus:outline-none" value={cropId} onChange={(e) => setCropId(e.target.value)}>
              <option value="">{t('ai.selectCrop')}</option>
              {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Farm (optional)</label>
            <select className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-agrigreen-500 focus:outline-none" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
              <option value="">{t('ai.selectFarmOptional')}</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>

        {/* Symptom description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Describe what you see *</label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agrigreen-500 focus:outline-none"
            rows={4}
            placeholder="e.g. Yellow spots on leaves getting bigger, brown edges, plant wilting in the afternoon…"
            value={symptomsText}
            onChange={(e) => setSymptomsText(e.target.value)}
          />
          <p className="mt-1 text-[10px] text-gray-400">More detail = better diagnosis. Describe colour, shape, location on plant, and when it started.</p>
        </div>

        {/* Image upload + local analysis */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">📷 Upload a photo (optional — analysed locally)</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-4 py-3 hover:border-agrigreen-300 hover:bg-agrigreen-50 transition-colors">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span className="text-sm text-gray-500">{imageFile ? imageFile.name : 'Choose plant photo…'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }} />
          </label>

          {imagePreview && (
            <div className="mt-2 flex items-start gap-3">
              <img src={imagePreview} alt="preview" className="h-28 w-28 rounded-xl object-cover border border-gray-200" />
              {imageFeatures && !analysing && (
                <div className="flex-1 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs space-y-1">
                  <p className="font-semibold text-gray-600">📊 Local image analysis</p>
                  <p className="text-gray-500">Pattern: <span className="font-medium text-gray-700">{imageFeatures.lesionPattern}</span></p>
                  <p className="text-gray-500">Yellowing: <span className="font-medium text-gray-700">{Math.round((imageFeatures.yellowRatio ?? 0) * 100)}%</span></p>
                  <p className="text-gray-500">Necrosis: <span className={`font-medium ${imageFeatures.highNecrosis ? 'text-red-600' : 'text-gray-700'}`}>{imageFeatures.highNecrosis ? 'Detected' : 'None'}</span></p>
                  <p className="text-gray-500">Dominant hue: <span className="font-medium text-gray-700">{imageFeatures.dominantHue}°</span></p>
                </div>
              )}
              {analysing && <p className="mt-2 text-xs text-agrigreen-600 animate-pulse">Analysing image…</p>}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          onClick={submit}
          disabled={loading || analysing || !cropId}
          className="w-full rounded-xl bg-gradient-to-r from-agrigreen-600 to-agrigreen-500 py-3 text-sm font-bold text-white hover:from-agrigreen-700 hover:to-agrigreen-600 disabled:opacity-50 shadow-sm transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Diagnosing…
            </span>
          ) : `🔬 Diagnose ${selectedCropName}`}
        </button>

        <DiagnosisResultCard result={result} />
      </div>

      {/* ── History panel ────────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-700">📋 Diagnosis History</h3>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {history.length === 0 && <p className="text-sm text-gray-400">{t('ai.noHistory')}</p>}
          {history.map((h) => {
            const topMatch = h.findings?.matches?.[0];
            return (
              <div key={h.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{h.crop?.name ?? 'Unknown crop'}</span>
                    {topMatch && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${catStyle[topMatch.category] ?? 'bg-gray-100 text-gray-600'}`}>{topMatch.category}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                </div>
                {topMatch && (
                  <p className="mt-1 text-xs font-medium text-agrigreen-700">
                    {urgencyIcon[topMatch.urgency]} {topMatch.name} — {Math.round(topMatch.score * 100)}% confidence
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{h.inputText}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather panel (unchanged logic, better styling)
// ─────────────────────────────────────────────────────────────────────────────
function WeatherPanel({ farms, canPost }: { farms: any[]; canPost: boolean }) {
  const { t } = useTranslation();
  const [areaId, setAreaId] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const severityColor: Record<string, string> = { ADVISORY: 'bg-blue-100 text-blue-700', WATCH: 'bg-amber-100 text-amber-700', WARNING: 'bg-red-100 text-red-700' };

  useEffect(() => { if (farms.length > 0 && !areaId) setAreaId(farms[0].areaId); }, [farms, areaId]);
  const load = () => { if (!areaId) return; setError(''); api.get('/ai/weather-alerts', { params: { areaId } }).then((r) => setAlerts(r.data)).catch((e) => setError(e?.response?.data?.message || t('ai.error'))); };
  useEffect(() => { load(); }, [areaId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">{t('ai.showAlertsFor')}</label>
        <select className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          {farms.map((f) => <option key={f.id} value={f.areaId}>{f.area?.name ?? f.name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {alerts.length === 0 && <p className="text-sm text-gray-400">{t('ai.noAlerts')}</p>}
        {alerts.map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{a.alertType} · {a.geoArea?.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${severityColor[a.severity] ?? 'bg-gray-100 text-gray-600'}`}>{a.severity}</span>
            </div>
            <p className="mt-1 text-sm text-gray-700">{a.message}</p>
            {a.recommendation && <p className="mt-1 text-xs text-gray-500">{a.recommendation}</p>}
          </div>
        ))}
      </div>
      {canPost && <PostAlertForm defaultAreaId={areaId} onPosted={load} />}
    </div>
  );
}

function PostAlertForm({ defaultAreaId, onPosted }: { defaultAreaId: string; onPosted: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ geoAreaId: defaultAreaId, alertType: 'RAIN', severity: 'ADVISORY', message: '', recommendation: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm((f) => ({ ...f, geoAreaId: defaultAreaId })), [defaultAreaId]);
  const submit = async () => { setBusy(true); try { await api.post('/ai/weather-alerts', form); setForm((f) => ({ ...f, message: '', recommendation: '' })); onPosted(); } finally { setBusy(false); } };
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('ai.postAlert')}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.alertType} onChange={(e) => setForm({ ...form, alertType: e.target.value })}>
          {['RAIN', 'FLOOD', 'DROUGHT', 'WIND', 'FROST', 'LIGHTNING'].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
          {['ADVISORY', 'WATCH', 'WARNING'].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <input className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t('ai.alertMessage') as string} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <input className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder={t('ai.alertRecommendation') as string} value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} />
      <button onClick={submit} disabled={busy || !form.message} className="mt-2 rounded-lg bg-agrigreen-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-agrigreen-700 disabled:opacity-50">{t('ai.postAlert')}</button>
    </div>
  );
}

function PlannerPanel({ farms, crops }: { farms: any[]; crops: any[] }) {
  const { t } = useTranslation();
  const [farmId, setFarmId] = useState(''); const [cropId, setCropId] = useState(''); const [loading, setLoading] = useState(false); const [result, setResult] = useState<any>(null); const [error, setError] = useState('');
  const submit = async () => { setError(''); if (!farmId || !cropId) { setError(t('ai.selectFarmAndCrop')); return; } setLoading(true); try { const { data } = await api.post('/ai/farm-plan', { farmId, cropId }); setResult(data); } catch (e: any) { setError(e?.response?.data?.message || t('ai.error')); } finally { setLoading(false); } };
  return (
    <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-xs text-gray-500">{t('ai.plannerHint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={farmId} onChange={(e) => setFarmId(e.target.value)}><option value="">{t('ai.selectFarm')}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={cropId} onChange={(e) => setCropId(e.target.value)}><option value="">{t('ai.selectCrop')}</option>{crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full rounded-lg bg-agrigreen-600 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700 disabled:opacity-50">{loading ? '...' : t('ai.generatePlan')}</button>
      {result && <div className="mt-3 rounded-xl border border-agrigreen-100 bg-agrigreen-50 p-4"><p className="text-sm text-gray-800 whitespace-pre-wrap">{result.recommendation}</p></div>}
    </div>
  );
}

function FinancialAdvisorPanel({ farms }: { farms: any[] }) {
  const { t } = useTranslation();
  const [farmId, setFarmId] = useState(''); const [loading, setLoading] = useState(false); const [result, setResult] = useState<any>(null); const [error, setError] = useState('');
  const submit = async () => { setError(''); if (!farmId) { setError(t('ai.selectFarmFirst')); return; } setLoading(true); try { const { data } = await api.post('/ai/financial-advice', { farmId }); setResult(data); } catch (e: any) { setError(e?.response?.data?.message || t('ai.error')); } finally { setLoading(false); } };
  return (
    <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-xs text-gray-500">{t('ai.financialHint')}</p>
      <select className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={farmId} onChange={(e) => setFarmId(e.target.value)}><option value="">{t('ai.selectFarm')}</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full rounded-lg bg-agrigreen-600 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700 disabled:opacity-50">{loading ? '...' : t('ai.getAdvice')}</button>
      {result && <div className="mt-3 rounded-xl border border-agrigreen-100 bg-agrigreen-50 p-4"><p className="text-sm text-gray-800">{result.recommendation}</p></div>}
      <p className="text-xs text-gray-400">{t('ai.financeManageLink')}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────
export default function AiAdvisory() {
  const { t } = useTranslation();
  const roleNames = useAuthStore((s) => s.roleNames());
  const canPostAlerts = ['SUPER_ADMIN', 'AGRICULTURE_MANAGER', 'PROVINCE_LEADER', 'DISTRICT_LEADER'].some((r) => roleNames.includes(r));
  const [tab, setTab] = useState<Tab>('plantDoctor');
  const [farms, setFarms] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);

  useEffect(() => {
    api.get('/farms').then((r) => setFarms(r.data)).catch(() => {});
    api.get('/crops', { params: { activeOnly: 'true' } }).then((r) => setCrops(r.data)).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'plantDoctor', label: t('ai.tabPlantDoctor'), icon: '🔬' },
    { key: 'weather',     label: t('ai.tabWeather'),     icon: '🌤' },
    { key: 'planner',     label: t('ai.tabPlanner'),     icon: '📅' },
    { key: 'financial',   label: t('ai.tabFinancial'),   icon: '💰' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('ai.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('ai.subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === tb.key ? 'bg-agrigreen-600 text-white shadow-sm' : 'text-gray-600 hover:bg-agrigreen-50'}`}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>
      {tab === 'plantDoctor' && <PlantDoctorPanel farms={farms} crops={crops} />}
      {tab === 'weather'     && <WeatherPanel farms={farms} canPost={canPostAlerts} />}
      {tab === 'planner'     && <PlannerPanel farms={farms} crops={crops} />}
      {tab === 'financial'   && <FinancialAdvisorPanel farms={farms} />}
    </div>
  );
}
