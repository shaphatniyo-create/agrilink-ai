import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function OrgChart() {
  const { t } = useTranslation();
  const [node, setNode] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);

  const loadNode = (areaId?: string) => {
    const req = areaId ? api.get(`/org-chart/node/${areaId}`) : api.get('/org-chart/root');
    req.then((r) => setNode(r.data));
  };

  useEffect(() => {
    loadNode();
    api.get('/org-chart/departments').then((r) => setDepartments(r.data));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('orgChart.title')}</h1>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">HQ Departments</h2>
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-gray-500">{d.head || 'unassigned'}</div>
            </div>
          ))}
        </div>
      </div>

      {node && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase text-gray-400">{node.area.level}</div>
              <div className="text-xl font-bold">{node.area.name}</div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs ${node.area.isActive ? 'bg-agrigreen-100 text-agrigreen-700' : 'bg-gray-100 text-gray-500'}`}>
              {node.area.isActive ? 'ACTIVE' : 'inactive'}
            </span>
          </div>

          {node.leader && (
            <div className="mt-3 text-sm text-gray-600">
              Leader: <span className="font-medium">{node.leader.name}</span> &middot; {node.leader.phone}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Farmers" value={node.stats.farmerCount} />
            <Stat label="Farms" value={node.stats.farmCount} />
            <Stat label="Listings" value={node.stats.listingCount} />
            <Stat label="Orders" value={node.stats.orderCount} />
            <Stat label="Revenue (RWF)" value={node.stats.totalRevenue.toLocaleString()} />
            <Stat label="Commission (RWF)" value={node.stats.totalCommission.toLocaleString()} />
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Sub-areas</h3>
            <div className="flex flex-wrap gap-2">
              {node.children.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => loadNode(c.id)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:border-agrigreen-400"
                >
                  {c.name}
                </button>
              ))}
              {node.children.length === 0 && <p className="text-xs text-gray-400">No sub-areas.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-[10px] uppercase text-gray-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
