import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import SoilSensorPanel from '../components/SoilSensorPanel';
import SoilIntelligencePanel from '../components/SoilIntelligencePanel';
import { useAuthStore } from '../store/authStore';

const HQ_ROLES = ['SUPER_ADMIN', 'CEO', 'DAF', 'CTO', 'AGRICULTURE_MANAGER', 'FINANCE_MANAGER'];

export default function Sensors() {
  const { t } = useTranslation();
  const { roleNames } = useAuthStore();
  const roles = roleNames();
  const isAdmin = roles.some((r) => HQ_ROLES.includes(r));

  const [farms, setFarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/farms')
      .then((r) => {
        const farmsData = r.data;
        if (farmsData.length > 0) {
          setFarms(farmsData);
        } else if (isAdmin) {
          // For admins with no personal farm, try getting IoT devices to find any farm with sensors
          api.get('/iot/devices').then((devR) => {
            const devices = devR.data || [];
            if (devices.length > 0 && devices[0].farmId) {
              // Build a synthetic farm list from device farm IDs
              const uniqueFarmIds = [...new Set(devices.map((d: any) => d.farmId))] as string[];
              const syntheticFarms = uniqueFarmIds.map((fid, i) => ({
                id: fid,
                name: devices.find((d: any) => d.farmId === fid)?.farm?.name || `Farm ${i + 1}`,
                area: null,
                farmCrops: [],
              }));
              setFarms(syntheticFarms);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <svg className="h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.sensors', 'Sensors')}</h1>
          <p className="text-sm text-gray-500">Live IoT soil sensor readings — auto-refreshes every 2 seconds</p>
        </div>
      </div>

      <div className="mt-2">
        {loading ? (
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-gray-500">
            <svg className="h-5 w-5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading sensor data…
          </div>
        ) : farms.length > 0 ? (
          <><SoilSensorPanel farms={farms} /><SoilIntelligencePanel farms={farms} /></>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center">
            <span className="text-5xl">📡</span>
            <h3 className="mt-4 text-lg font-semibold text-gray-700">No Farm Linked</h3>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              You don't have a farm linked to your account yet. Go to <strong>My Farms</strong> to create one, then register your IoT device there.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
