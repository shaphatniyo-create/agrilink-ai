import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function CropsAdmin() {
  const { t } = useTranslation();
  const [crops, setCrops] = useState<any[]>([]);

  const load = () => api.get('/crops').then((r) => setCrops(r.data));
  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string, active: boolean) => {
    await api.patch(`/crops/${id}/active`, { active: !active });
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('crops.title')}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {crops.map((c) => (
          <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">
                  {c.name} <span className="text-xs text-gray-400">({c.localName})</span>
                </div>
                <div className="text-xs text-gray-500">{c.category}</div>
              </div>
              <button
                onClick={() => toggle(c.id, c.isActive)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  c.isActive ? 'bg-agrigreen-100 text-agrigreen-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c.isActive ? 'ACTIVE' : 'inactive'}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>Growing period: {c.growingPeriodDays} days</div>
              <div>Yield: {c.expectedYieldPerHaKg} kg/ha</div>
              <div>Cost: RWF {c.productionCostRwfPerHa?.toLocaleString()}/ha</div>
              <div>Est. revenue: RWF {c.estimatedRevenueRwfPerHa?.toLocaleString()}/ha</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
