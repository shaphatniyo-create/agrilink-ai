import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ── Severity badge colours ────────────────────────────────────────────────────
const severityColor: Record<string, string> = {
  ADVISORY: 'bg-blue-100 text-blue-700 border-blue-200',
  WATCH:    'bg-amber-100 text-amber-700 border-amber-200',
  WARNING:  'bg-red-100 text-red-700 border-red-200',
};

// ── Gauge thresholds ──────────────────────────────────────────────────────────
function gaugeColor(value: number | null | undefined, low: number, high: number) {
  if (value == null) return 'bg-gray-200';
  if (value < low)  return 'bg-blue-400';
  if (value > high) return 'bg-red-400';
  return 'bg-emerald-400';
}

// ── Mini horizontal bar gauge ─────────────────────────────────────────────────
function Gauge({ value, min, max, low, high }: { value?: number | null; min: number; max: number; low: number; high: number }) {
  const pct = value != null ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-all duration-700 ${gaugeColor(value, low, high)}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Single metric tile ────────────────────────────────────────────────────────
function Metric({
  label, value, unit, min, max, low, high, icon,
}: {
  label: string; value?: number | null; unit?: string;
  min: number; max: number; low: number; high: number; icon: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">{icon} {label}</span>
        {value != null && (
          <span className={`h-1.5 w-1.5 rounded-full ${gaugeColor(value, low, high)}`} />
        )}
      </div>
      <div className="mt-1 text-base font-bold text-gray-800">
        {value != null ? `${value}${unit ?? ''}` : <span className="text-gray-300 text-sm">—</span>}
      </div>
      <Gauge value={value} min={min} max={max} low={low} high={high} />
    </div>
  );
}

// ── Pulse dot (online indicator) ──────────────────────────────────────────────
function PulseDot({ online }: { online: boolean }) {
  return (
    <span className="relative inline-flex h-3 w-3">
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    </span>
  );
}

const REFRESH_INTERVAL = 2_000; // 2 s auto-refresh — near-real-time

/** Seconds elapsed since a given date, formatted as a short string. */
function timeAgo(date: Date | null): string {
  if (!date) return '';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

/**
 * Live sensor data panel for the farmer dashboard.
 * Polls every 5 s and shows soil moisture, temperature, pH, N/P/K, pump state,
 * plus active alerts with a resolve button.
 */
export default function SoilSensorPanel({ farms }: { farms: any[] }) {
  const { t } = useTranslation();
  const [farmId, setFarmId] = useState('');
  const [data, setData] = useState<{ devices: any[]; alerts: any[] } | null>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick]               = useState(0);
  const [refreshing, setRefreshing]   = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel]             = useState('');
  const [busy, setBusy]               = useState(false);
  const [newCredential, setNewCredential] = useState<{ deviceCode: string; apiKey: string } | null>(null);
  const [error, setError]             = useState('');
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the "Xs ago" badge ticking every second
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  useEffect(() => {
    if (farms.length > 0 && !farmId) setFarmId(farms[0].id);
  }, [farms, farmId]);

  const load = useCallback(async (showSpinner = false) => {
    if (!farmId) return;
    if (showSpinner) setRefreshing(true);
    try {
      const r = await api.get(`/iot/farms/${farmId}/latest`);
      setData(r.data);
      setLastUpdated(new Date());
    } catch {
      /* silent – keep stale data */
    } finally {
      setRefreshing(false);
    }
  }, [farmId]);

  const loadAi = useCallback(async () => {
    if (!farmId) return;
    setAiLoading(true);
    try {
      const r = await api.get(`/iot/farms/${farmId}/ai-analysis`);
      setAiData(r.data);
    } catch {
      /* silent */
    } finally {
      setAiLoading(false);
    }
  }, [farmId]);

  // Initial load + auto-refresh sensor data
  useEffect(() => {
    load(true);
    intervalRef.current = setInterval(() => load(), REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  // AI analysis – load on mount and every 10 s
  useEffect(() => {
    loadAi();
    aiIntervalRef.current = setInterval(() => loadAi(), 10_000);
    return () => { if (aiIntervalRef.current) clearInterval(aiIntervalRef.current); };
  }, [loadAi]);

  const addDevice = async () => {
    setError('');
    setBusy(true);
    try {
      const { data: res } = await api.post('/iot/devices', { farmId, label: label || undefined });
      setNewCredential({ deviceCode: res.device.deviceCode, apiKey: res.apiKey });
      setLabel('');
      setShowAddForm(false);
      load(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('iot.error'));
    } finally {
      setBusy(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    await api.post(`/iot/alerts/${alertId}/resolve`);
    load(true);
  };

  if (farms.length === 0) return null;

  const onlineCount = data?.devices.filter((d) => d.online).length ?? 0;
  const totalCount  = data?.devices.length ?? 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">{t('iot.title')}</h2>
          {/* LIVE badge */}
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 tracking-wide">LIVE</span>
          </span>
          {lastUpdated && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
              {/* tick is read to force re-render */}
              {tick >= 0 && (refreshing ? '⟳ Refreshing…' : `Updated ${timeAgo(lastUpdated)}`)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-gray-500">
              <span className="font-semibold text-emerald-600">{onlineCount}</span>/{totalCount} online
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
          </button>
          {farms.length > 1 && (
            <select
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm"
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
            >
              {farms.slice(0, 100).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── New device credential banner ──────────────────────────────── */}
      {newCredential && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">{t('iot.credentialTitle')}</p>
          <p className="mt-1 text-xs text-amber-700">{t('iot.credentialWarning')}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded border border-amber-200 bg-white p-2 font-mono text-xs">
              <div className="text-[10px] uppercase text-gray-400">{t('iot.deviceCode')}</div>
              {newCredential.deviceCode}
            </div>
            <div className="rounded border border-amber-200 bg-white p-2 break-all font-mono text-xs">
              <div className="text-[10px] uppercase text-gray-400">{t('iot.apiKey')}</div>
              {newCredential.apiKey}
            </div>
          </div>
          <button onClick={() => setNewCredential(null)} className="mt-2 text-xs font-medium text-amber-700 underline">
            {t('iot.credentialDismiss')}
          </button>
        </div>
      )}

      {/* ── Active alerts ─────────────────────────────────────────────── */}
      {data && data.alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {data.alerts.map((a: any) => (
            <div key={a.id} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${severityColor[a.severity] ?? 'bg-gray-50 border-gray-200'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityColor[a.severity]}`}>{a.severity}</span>
                  <span className="text-xs opacity-70">{a.device?.label || a.device?.deviceCode}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{a.message}</p>
                {a.recommendation && <p className="mt-0.5 text-xs opacity-80">{a.recommendation}</p>}
              </div>
              <button
                onClick={() => resolveAlert(a.id)}
                className="shrink-0 rounded-lg border border-current/30 bg-white/60 px-3 py-1 text-xs font-medium hover:bg-white"
              >
                {t('iot.resolve')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Device cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.devices.map((d: any) => (
          <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {/* Device header */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <PulseDot online={d.online} />
                  <span className="text-sm font-bold text-gray-900">{d.label || d.deviceCode}</span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-gray-400">{d.deviceCode}</div>
              </div>
              <div className="flex items-center gap-2">
                {d.latestReading?.pumpState && (
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    d.latestReading.pumpState === 'ON'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    💧 {t('iot.pump')}: {d.latestReading.pumpState}
                  </span>
                )}
                <select
                  value={d.pumpMode || 'AUTO'}
                  onChange={async (e) => {
                    await api.post(`/iot/devices/${d.id}/pump`, { pumpMode: e.target.value });
                    load(false);
                  }}
                  className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-agrigreen-500"
                >
                  <option value="AUTO">AUTO (Sensor)</option>
                  <option value="ON">Force ON</option>
                  <option value="OFF">Force OFF</option>
                </select>
              </div>
            </div>

            {/* Sensor metrics grid */}
            {d.latestReading ? (
              <div className="grid grid-cols-3 gap-2">
                <Metric label={t('iot.moisture') as string}    value={d.latestReading.moisturePct}   unit="%" icon="💧" min={0}   max={100} low={20}  high={80} />
                <Metric label={t('iot.temperature') as string} value={d.latestReading.temperatureC}  unit="°C" icon="🌡" min={0}   max={60}  low={10}  high={40} />
                <Metric label={t('iot.ph') as string}          value={d.latestReading.ph}            icon="⚗"  min={0}   max={14}  low={5.5} high={7.5} />
                <Metric label="Nitrogen"                        value={d.latestReading.nitrogenPpm}   unit=" ppm" icon="🌿" min={0} max={500} low={50}  high={400} />
                <Metric label="Phosphorus"                      value={d.latestReading.phosphorusPpm} unit=" ppm" icon="🔵" min={0} max={500} low={20}  high={350} />
                <Metric label="Potassium"                       value={d.latestReading.potassiumPpm}  unit=" ppm" icon="🟡" min={0} max={500} low={50}  high={400} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <span className="text-3xl">📡</span>
                <p className="mt-2 text-sm text-gray-400">{t('iot.noReadingsYet')}</p>
                <p className="text-xs text-gray-300">Waiting for device to send data</p>
              </div>
            )}

            {/* Last reading timestamp */}
            {d.latestReading?.readingAt && (
              <p className="mt-3 text-right text-[10px] text-gray-300">
                Last reading: {new Date(d.latestReading.readingAt).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>

      {(!data || data.devices.length === 0) && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="text-5xl">🌱</span>
          <p className="mt-3 text-sm text-gray-500">{t('iot.noDevices')}</p>
          <p className="mt-1 text-xs text-gray-400">Register your first ESP32 sensor below to start monitoring soil conditions.</p>
        </div>
      )}

      {/* ── AI Analysis Panel ─────────────────────────────────────────── */}
      {aiData && aiData.status !== 'NO_DATA' && (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
          {/* AI Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <h3 className="text-sm font-bold text-violet-900">AI Soil Analysis</h3>
                <p className="text-[10px] text-violet-500">
                  {aiLoading ? 'Analyzing…' : aiData.analyzedAt ? `Analyzed ${timeAgo(new Date(aiData.analyzedAt))}` : ''}
                </p>
              </div>
            </div>
            {/* Health Score Ring */}
            <div className="flex flex-col items-center">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full border-4 text-lg font-bold ${
                aiData.overallScore >= 75 ? 'border-emerald-400 text-emerald-700 bg-emerald-50' :
                aiData.overallScore >= 50 ? 'border-amber-400 text-amber-700 bg-amber-50' :
                'border-red-400 text-red-700 bg-red-50'
              }`}>
                {aiData.overallScore}
              </div>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Soil Score</span>
            </div>
          </div>

          {/* Summary Banner */}
          <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-medium ${
            aiData.status === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-800' :
            aiData.status === 'GOOD'      ? 'bg-green-100 text-green-800' :
            aiData.status === 'FAIR'      ? 'bg-amber-100 text-amber-800' :
            aiData.status === 'POOR'      ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {aiData.summary}
          </div>

          {/* Parameter Insights */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {aiData.insights?.map((ins: any, i: number) => (
              <div key={i} className={`rounded-xl border p-3 ${
                ins.status === 'OPTIMAL'  ? 'border-emerald-200 bg-emerald-50' :
                ins.status === 'WARNING'  ? 'border-amber-200 bg-amber-50' :
                'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    {ins.icon} {ins.parameter}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${
                    ins.status === 'OPTIMAL' ? 'bg-emerald-500' :
                    ins.status === 'WARNING' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                </div>
                <div className={`mt-1 text-sm font-bold ${
                  ins.status === 'OPTIMAL' ? 'text-emerald-800' :
                  ins.status === 'WARNING' ? 'text-amber-800' : 'text-red-800'
                }`}>{ins.value}</div>
                <p className="mt-0.5 text-[10px] text-gray-500 leading-tight">{ins.detail}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {aiData.recommendations?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">📋 Action Plan</h4>
              <div className="space-y-2">
                {aiData.recommendations.map((rec: any, i: number) => (
                  <div key={i} className={`flex gap-3 rounded-xl border p-3 ${
                    rec.priority === 'HIGH'   ? 'border-red-200 bg-red-50' :
                    rec.priority === 'MEDIUM' ? 'border-amber-200 bg-amber-50' :
                    'border-blue-200 bg-blue-50'
                  }`}>
                    <span className="mt-0.5 text-xl">{rec.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          rec.priority === 'HIGH'   ? 'bg-red-200 text-red-800' :
                          rec.priority === 'MEDIUM' ? 'bg-amber-200 text-amber-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>{rec.priority}</span>
                        <span className="text-xs font-bold text-gray-800">{rec.action}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-600 leading-snug">{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* ── Add device form ───────────────────────────────────────────── */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-4 flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          {t('iot.addDevice')}
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Register a new sensor device</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agrigreen-500 focus:outline-none"
              placeholder={t('iot.deviceLabelPlaceholder') as string}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <button onClick={addDevice} disabled={busy}
              className="rounded-lg bg-agrigreen-600 px-4 py-2 text-sm font-medium text-white hover:bg-agrigreen-700 disabled:opacity-50">
              {t('iot.register')}
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-white">
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">{t('iot.addDeviceHint')}</p>
        </div>
      )}

      {/* Auto-refresh notice */}
      <p className="mt-3 text-right text-[10px] text-gray-300">
        ⟳ Auto-refreshes every 5 seconds
      </p>
    </div>
  );
}
