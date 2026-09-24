import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import FarmZonesPanel from '../components/FarmZonesPanel';
import FarmFinancePanel from '../components/FarmFinancePanel';
import SoilSensorPanel from '../components/SoilSensorPanel';

export default function Farms() {
  const { t } = useTranslation();
  const [farms, setFarms] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', areaId: '', sizeHectares: 1 });
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'zones' | 'finance' | 'sensors'>('sensors');

  const load = () => api.get('/farms').then((r) => setFarms(r.data));
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    await api.post('/farms', form);
    setShowForm(false);
    load();
  };

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('farms.title')}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-agrigreen-600 px-4 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700"
        >
          {t('farms.newFarm')}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Farm name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Village/Cell Area ID"
              value={form.areaId}
              onChange={(e) => setForm({ ...form, areaId: e.target.value })}
            />
            <input
              type="number"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Size (ha)"
              value={form.sizeHectares}
              onChange={(e) => setForm({ ...form, sizeHectares: Number(e.target.value) })}
            />
          </div>
          <button onClick={create} className="rounded bg-agrigreen-600 px-4 py-1.5 text-sm text-white">
            Save
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {farms.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setSelectedFarmId(f.id === selectedFarmId ? null : f.id);
              setDetailTab('sensors');
            }}
            className={`rounded-xl border p-4 text-left transition ${
              f.id === selectedFarmId ? 'border-agrigreen-500 bg-agrigreen-50' : 'border-gray-200 bg-white hover:border-agrigreen-300'
            }`}
          >
            <div className="font-semibold">{f.name}</div>
            <div className="text-xs text-gray-500">{f.area?.name}</div>
            <div className="mt-2 text-sm text-gray-600">
              {f.sizeHectares} ha &middot; {f.soilType || 'soil n/a'}
            </div>
            <div className="mt-3 space-y-1">
              {(f.farmCrops || []).map((fc: any) => (
                <div key={fc.id} className="rounded bg-agrigreen-100 px-2 py-1 text-xs text-agrigreen-700">
                  {fc.crop?.name} &middot; {fc.season} &middot; {fc.status}
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs font-medium text-agrigreen-700">
              {f.id === selectedFarmId ? t('farms.hideDetails') : t('farms.manage')}
            </div>
          </button>
        ))}
        {farms.length === 0 && <p className="text-sm text-gray-500">No farms registered yet.</p>}
      </div>

      {selectedFarm && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selectedFarm.name}</h2>
            <div className="flex gap-2">
              {/* Sensors is first and default */}
              <button
                onClick={() => setDetailTab('sensors')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  detailTab === 'sensors' ? 'bg-agrigreen-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Sensors
              </button>
              <button
                onClick={() => setDetailTab('zones')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  detailTab === 'zones' ? 'bg-agrigreen-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t('farms.zonesTab')}
              </button>
              <button
                onClick={() => setDetailTab('finance')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  detailTab === 'finance' ? 'bg-agrigreen-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t('farms.financeTab')}
              </button>
            </div>
          </div>

          {detailTab === 'sensors' ? (
            <SoilSensorPanel farms={[selectedFarm]} />
          ) : detailTab === 'zones' ? (
            <FarmZonesPanel farmId={selectedFarm.id} />
          ) : (
            <FarmFinancePanel farmId={selectedFarm.id} farmName={selectedFarm.name} />
          )}
        </div>
      )}
    </div>
  );
}
