import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Soil intelligence: compares the latest ESP32 reading with reference soil
 * data (SoilGrids / RwaSIS) and the chosen crop's requirements, then shows
 * crop suitability, lime and fertilizer advice, and the best-suited crops.
 */

const statusStyle: Record<string, string> = {
  OK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOW: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  UNKNOWN: 'bg-gray-50 text-gray-500 border-gray-200',
};
const statusLabel: Record<string, string> = { OK: 'In range', LOW: 'Low', HIGH: 'High', UNKNOWN: 'No data' };

const overallStyle: Record<string, string> = {
  SUITABLE: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  MODERATE: 'text-amber-700 bg-amber-50 border-amber-200',
  POOR: 'text-red-700 bg-red-50 border-red-200',
  NO_CROP: 'text-gray-600 bg-gray-50 border-gray-200',
  NO_DATA: 'text-gray-600 bg-gray-50 border-gray-200',
};

const fmt = (v: any, digits = 1) => (v == null || Number.isNaN(v) ? '—' : typeof v === 'number' ? String(Math.round(v * 10 ** digits) / 10 ** digits) : String(v));

export default function SoilIntelligencePanel({ farms }: { farms: any[] }) {
  const [farmId, setFarmId] = useState<string>('');
  const [crops, setCrops] = useState<{ id: string; name: string }[]>([]);
  const [cropId, setCropId] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (farms.length > 0 && !farmId) setFarmId(farms[0].id);
  }, [farms, farmId]);

  useEffect(() => {
    api.get('/soil-intel/crops')
      .then((r) => setCrops((r.data?.requirements ?? []).map((x: any) => ({ id: x.cropId, name: x.crop?.name })).sort((a: any, b: any) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  const loadHistory = useCallback(async () => {
    if (!farmId) return;
    try {
      const r = await api.get(`/soil-intel/farms/${farmId}/recommendations`, { params: { limit: 5 } });
      setHistory(r.data ?? []);
    } catch { /* silent */ }
  }, [farmId]);

  const analyze = useCallback(async () => {
    if (!farmId) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post(`/soil-intel/farms/${farmId}/analyze`, { cropId: cropId || undefined });
      setResult(r.data);
      if (!cropId && r.data?.crop?.id) setCropId(r.data.crop.id);
      loadHistory();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Analysis failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [farmId, cropId, loadHistory]);

  // Run once when the farm changes so the farmer sees advice without clicking.
  useEffect(() => { setResult(null); if (farmId) analyze(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [farmId]);

  if (farms.length === 0) return null;

  const lime = result?.lime;
  const fert = result?.fertilizer;
  const rec = fert?.recommended;
  const ref = result?.reference;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Soil &amp; crop recommendations</h2>
          <p className="text-xs text-gray-500">Sensor reading vs. reference soil data vs. crop needs</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {farms.length > 1 && (
            <select value={farmId} onChange={(e) => setFarmId(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
              {farms.slice(0, 100).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <select value={cropId} onChange={(e) => setCropId(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
            <option value="">Farm's current crop</option>
            {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={analyze} disabled={busy || !farmId} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? 'Analyzing…' : 'Analyze soil'}
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!result && busy && <div className="p-6 text-center text-sm text-gray-500">Comparing your soil with reference data…</div>}

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${overallStyle[result.status] ?? overallStyle.NO_DATA}`}>
            {result.suitabilityScore != null && (
              <div className="text-center">
                <div className="text-3xl font-extrabold">{result.suitabilityScore}</div>
                <div className="text-[10px] uppercase tracking-wide">/ 100</div>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {result.crop ? `${result.crop.name}${result.crop.localName ? ` (${result.crop.localName})` : ''}` : 'No crop selected'}
                {' · '}{result.status.replace('_', ' ').toLowerCase()}
              </div>
              <p className="mt-1 text-sm">{result.summary}</p>
            </div>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-3">Parameter</th>
                  <th className="py-2 pr-3">Your sensor</th>
                  <th className="py-2 pr-3">Reference soil</th>
                  <th className="py-2 pr-3">Crop needs</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.comparisons.map((c: any) => (
                  <tr key={c.key} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-700">{c.label}</td>
                    <td className="py-2 pr-3">{fmt(c.sensor)} {c.sensor != null && c.unit}</td>
                    <td className="py-2 pr-3 text-gray-500">{fmt(c.reference)} {c.reference != null && c.unit}</td>
                    <td className="py-2 pr-3 text-gray-500">{c.min != null ? `${fmt(c.min)}–${fmt(c.max)} ${c.unit}` : '—'}</td>
                    <td className="py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle[c.status]}`}>{statusLabel[c.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Lime */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Lime</div>
              {lime ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-gray-800">
                    {lime.needed && lime.rateTHa ? `${lime.product}: ${lime.rateTHa} t/ha` : lime.needed ? 'Consider liming' : 'No lime needed'}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{lime.advice}</p>
                  {lime.frequency && lime.needed && <p className="mt-1 text-xs text-gray-500">Frequency: {lime.frequency}{lime.altRateTHa ? ` · lower-cost option ${lime.altRateTHa} t/ha` : ''}</p>}
                  {lime.cropNote && <p className="mt-1 text-xs text-amber-700">{lime.cropNote}</p>}
                  <p className="mt-2 text-[11px] text-gray-400">pH {fmt(lime.ph)} from {lime.phSource === 'SENSOR' ? 'your sensor' : 'reference soil map'} · {lime.source}</p>
                </>
              ) : <p className="mt-1 text-sm text-gray-500">No pH data yet.</p>}
            </div>

            {/* Fertilizer */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Fertilizer</div>
              {rec ? (
                <>
                  <div className="mt-1 text-sm font-semibold text-gray-800">{rec.name} ({rec.code})</div>
                  <ul className="mt-1 text-sm text-gray-700">
                    {rec.dapKgHa ? <li>DAP: {rec.dapKgHa} kg/ha</li> : null}
                    {rec.npk171717KgHa ? <li>NPK 17-17-17: {rec.npk171717KgHa} kg/ha</li> : null}
                    {rec.ureaKgHa ? <li>Urea (top-dress): {rec.ureaKgHa} kg/ha</li> : null}
                    {rec.kclKgHa ? <li>KCl: {rec.kclKgHa} kg/ha</li> : null}
                  </ul>
                  {rec.timing && <p className="mt-1 text-xs text-gray-500">{rec.timing}</p>}
                  <p className="mt-2 text-[11px] text-gray-400">{rec.source}</p>
                </>
              ) : null}
              {fert?.nutrientNotes?.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-sm text-gray-700">
                  {fert.nutrientNotes.map((n: string) => <li key={n}>{n}</li>)}
                </ul>
              )}
              {fert && <p className="mt-2 text-xs text-gray-500">{fert.note} <a className="text-emerald-700 underline" href={fert.moreInfoUrl} target="_blank" rel="noreferrer">Smart Nkunganire</a></p>}
            </div>
          </div>

          {/* Best crops */}
          {result.ranking?.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Best-suited crops for this soil</div>
              <div className="flex flex-wrap gap-2">
                {result.ranking.map((r: any) => (
                  <button key={r.cropId} onClick={() => setCropId(r.cropId)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${r.cropId === result.crop?.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <span className="font-semibold">{r.name}</span> <span className="text-gray-500">{r.score}/100</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reference soil */}
          {ref && (
            <div className="rounded-xl border border-gray-100 p-4 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Reference soil at this location ({ref.depth})</div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><span className="text-gray-400">pH</span> <b>{fmt(ref.ph)}</b></div>
                <div><span className="text-gray-400">Texture</span> <b>{ref.texture ?? '—'}</b></div>
                <div><span className="text-gray-400">Org. carbon</span> <b>{fmt(ref.organicCarbonGKg)} g/kg</b></div>
                <div><span className="text-gray-400">Total N</span> <b>{fmt(ref.nitrogenGKg, 2)} g/kg</b></div>
                <div><span className="text-gray-400">CEC</span> <b>{fmt(ref.cecCmolKg)} cmol/kg</b></div>
                <div><span className="text-gray-400">Clay</span> <b>{fmt(ref.clayPct)}%</b></div>
                <div><span className="text-gray-400">Sand</span> <b>{fmt(ref.sandPct)}%</b></div>
                <div><span className="text-gray-400">Silt</span> <b>{fmt(ref.siltPct)}%</b></div>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">Source: {ref.source}</p>
            </div>
          )}
          {!ref && result.status !== 'NO_DATA' && (
            <p className="text-xs text-gray-500">No reference soil data: add the farm's GPS location (or send latitude/longitude from the sensor) to compare with the soil map.</p>
          )}

          <p className="text-[11px] text-gray-400">{result.disclaimer}</p>

          {history.length > 1 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500">Previous analyses</summary>
              <ul className="mt-2 space-y-1">
                {history.slice(1).map((h) => (
                  <li key={h.id} className="text-gray-600">
                    {new Date(h.createdAt).toLocaleString()} · {h.crop?.name ?? 'No crop'} · {h.suitabilityScore ?? '—'}/100 · {h.summary}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
