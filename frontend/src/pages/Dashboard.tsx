import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import SoilSensorPanel from '../components/SoilSensorPanel';

const HQ_ROLES = ['SUPER_ADMIN', 'CEO', 'DAF', 'CTO', 'AGRICULTURE_MANAGER', 'FINANCE_MANAGER'];
const LEADER_ROLES = ['PROVINCE_LEADER', 'DISTRICT_LEADER', 'SECTOR_LEADER', 'CELL_LEADER', 'VILLAGE_LEADER'];

const fmt = new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 });

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, roleNames } = useAuthStore();
  const roles = roleNames();
  const isHQ = roles.some((r) => HQ_ROLES.includes(r));
  const isLeader = roles.some((r) => LEADER_ROLES.includes(r));
  const isFarmer = roles.includes('FARMER');
  const isTransporter = roles.includes('TRANSPORTER');

  const [finance, setFinance] = useState<any>(null);
  const [farms, setFarms] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [transportDash, setTransportDash] = useState<any>(null);

  useEffect(() => {
    if (isHQ) api.get('/finance/dashboard').then((r) => setFinance(r.data)).catch(() => {});
    // HQ/admin roles also need farms here (not just farmer/leader) so the
    // soil-sensor panel below can show them field-sensor data across the
    // network too, not only their own farm.
    if (isFarmer || isLeader || isHQ) api.get('/farms').then((r) => setFarms(r.data)).catch(() => {});
    api.get('/marketplace/orders/mine').then((r) => setOrders(r.data)).catch(() => {});
    if (isTransporter) api.get('/transport/dashboard').then((r) => setTransportDash(r.data)).catch(() => {});
  }, [isHQ, isFarmer, isLeader, isTransporter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('dashboard.welcome')}, {user?.firstName}
        </h1>
        <p className="text-sm text-gray-500">{roles.join(' · ')}</p>
      </div>

      {isHQ && finance && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Revenue (all time)" value={`RWF ${fmt.format(finance.revenue.allTime)}`} />
          <StatCard label="Commission revenue" value={`RWF ${fmt.format(finance.commission.total)}`} />
          <StatCard label="Operating expenses" value={`RWF ${fmt.format(finance.expenses.total)}`} />
          <StatCard
            label={t('finance.netOperatingResult')}
            value={`RWF ${fmt.format(finance.profitability.netOperatingResult)}`}
          />
        </div>
      )}

      {(isFarmer || isLeader) && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">{t('farms.title')}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {farms.slice(0, 6).map((f) => (
              <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-gray-500">{f.area?.name}</div>
                <div className="mt-2 text-xs text-gray-400">{f.farmCrops?.length ?? 0} production record(s)</div>
              </div>
            ))}
            {farms.length === 0 && <p className="text-sm text-gray-500">No farms yet.</p>}
          </div>
        </div>
      )}

      {(isFarmer || isLeader || isHQ) && farms.length > 0 && <SoilSensorPanel farms={farms} />}

      {isTransporter && transportDash && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Active deliveries" value={transportDash.activeDeliveries.length} />
          <StatCard label="Completed" value={transportDash.completedDeliveries.length} />
          <StatCard label="Total earnings" value={`RWF ${fmt.format(transportDash.totalEarnings)}`} />
          <StatCard label="Vehicles" value={transportDash.vehicles.length} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Recent orders</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Crop</th>
                <th className="px-4 py-2">Quantity</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-2">{o.listing?.crop?.name}</td>
                  <td className="px-4 py-2">{o.quantity}</td>
                  <td className="px-4 py-2">RWF {fmt.format(o.totalAmount)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-agrigreen-100 px-2 py-0.5 text-xs text-agrigreen-700">
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
