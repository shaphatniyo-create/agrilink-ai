import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';

export default function Transport() {
  const { t } = useTranslation();
  const isTransporter = useAuthStore((s) => s.roleNames()).includes('TRANSPORTER');
  const [jobs, setJobs] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);

  useEffect(() => {
    if (isTransporter) {
      api.get('/transport/requests/available').then((r) => setJobs(r.data));
      api.get('/transport/dashboard').then((r) => setDashboard(r.data));
    }
  }, [isTransporter]);

  const quote = async (requestId: string) => {
    await api.post(`/transport/requests/${requestId}/quote`, {});
    api.get('/transport/requests/available').then((r) => setJobs(r.data));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('nav.transport')}</h1>

      {!isTransporter && (
        <p className="text-sm text-gray-500">
          Request transport for an order from the Marketplace/Orders flow. Transporter-specific tools (available
          jobs, quoting, earnings) appear here once your account has the TRANSPORTER role.
        </p>
      )}

      {isTransporter && (
        <>
          {dashboard && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">Active deliveries</div>
                <div className="text-xl font-bold">{dashboard.activeDeliveries.length}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">Completed</div>
                <div className="text-xl font-bold">{dashboard.completedDeliveries.length}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">Total earnings</div>
                <div className="text-xl font-bold">RWF {dashboard.totalEarnings.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">Vehicles</div>
                <div className="text-xl font-bold">{dashboard.vehicles.length}</div>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Available jobs</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {jobs.map((j) => (
                <div key={j.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-medium">
                    {j.pickupArea?.name} → {j.destinationArea?.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {j.crop?.name} &middot; {j.weightKg} kg &middot; {j.distanceKm ?? '?'} km
                  </div>
                  <button
                    onClick={() => quote(j.id)}
                    className="mt-3 rounded bg-agrigreen-600 px-3 py-1.5 text-sm text-white"
                  >
                    Submit quote
                  </button>
                </div>
              ))}
              {jobs.length === 0 && <p className="text-sm text-gray-500">No open jobs right now.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
