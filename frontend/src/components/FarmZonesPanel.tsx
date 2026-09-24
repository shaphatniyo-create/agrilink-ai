import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type Point = { lat: number; lng: number };
type Zone = { id: string; name: string; zoneType: string; boundary: Point[]; notes?: string };

const ZONE_COLORS: Record<string, string> = {
  BOUNDARY: '#16a34a',
  SOIL: '#a16207',
  IRRIGATION: '#0284c7',
  CROP_HEALTH: '#dc2626',
};

/**
 * Renders stored farm-zone polygons as a simple scaled SVG sketch --
 * dependency-free (no map-tile library or API key needed), so it works
 * fully offline and needs nothing installed beyond what's already here.
 * A real basemap (Leaflet/Mapbox + satellite/NDVI imagery) is a natural
 * upgrade once there's a tile/imagery provider to plug in; this establishes
 * the real data model (GPS polygon storage) that upgrade would sit on top of.
 */
function ZoneSketch({ zones }: { zones: Zone[] }) {
  const allPoints = zones.flatMap((z) => z.boundary);
  if (allPoints.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-400">No zones sketched yet.</div>;
  }
  const lats = allPoints.map((p) => p.lat);
  const lngs = allPoints.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 0.15;
  const latSpan = Math.max(maxLat - minLat, 0.0005);
  const lngSpan = Math.max(maxLng - minLng, 0.0005);
  const W = 400;
  const H = 300;
  const toXY = (p: Point) => {
    const x = ((p.lng - minLng) / lngSpan) * W * (1 - 2 * pad) + W * pad;
    // lat increases northward but SVG y increases downward -- flip it.
    const y = H - (((p.lat - minLat) / latSpan) * H * (1 - 2 * pad) + H * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-64 w-full rounded-lg border border-gray-200 bg-agrigreen-50">
      {zones.map((z) => (
        <polygon
          key={z.id}
          points={z.boundary.map(toXY).join(' ')}
          fill={(ZONE_COLORS[z.zoneType] ?? '#16a34a') + '33'}
          stroke={ZONE_COLORS[z.zoneType] ?? '#16a34a'}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

export default function FarmZonesPanel({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const [zones, setZones] = useState<Zone[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState('BOUNDARY');
  const [pointsText, setPointsText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/farms/${farmId}/zones`).then((r) => setZones(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  const parsePoints = (text: string): Point[] =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [lat, lng] = line.split(',').map((v) => parseFloat(v.trim()));
        return { lat, lng };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const submit = async () => {
    setError('');
    const boundary = parsePoints(pointsText);
    if (boundary.length < 3) {
      setError(t('zones.needThreePoints'));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/farms/${farmId}/zones`, { name, zoneType, boundary });
      setName('');
      setPointsText('');
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('zones.error'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (zoneId: string) => {
    await api.post(`/farms/zones/${zoneId}/delete`);
    load();
  };

  return (
    <div className="space-y-3">
      <ZoneSketch zones={zones} />
      <div className="flex flex-wrap gap-2">
        {zones.map((z) => (
          <span key={z.id} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: ZONE_COLORS[z.zoneType] ?? '#16a34a' }} />
            {z.name} ({z.zoneType})
            <button onClick={() => remove(z.id)} className="text-gray-400 hover:text-red-600">
              &times;
            </button>
          </span>
        ))}
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          {t('zones.addZone')}
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder={t('zones.zoneName') as string}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={zoneType} onChange={(e) => setZoneType(e.target.value)}>
              {['BOUNDARY', 'SOIL', 'IRRIGATION', 'CROP_HEALTH'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
            rows={4}
            placeholder={'-1.4995,29.6335\n-1.4990,29.6345\n-1.5002,29.6350'}
            value={pointsText}
            onChange={(e) => setPointsText(e.target.value)}
          />
          <p className="text-xs text-gray-400">{t('zones.pointsHint')}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="rounded-lg bg-agrigreen-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-agrigreen-700 disabled:opacity-50">
              {t('zones.save')}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600">
              {t('zones.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
