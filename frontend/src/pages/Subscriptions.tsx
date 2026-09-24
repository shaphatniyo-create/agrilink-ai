import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function Subscriptions() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);

  const load = () => {
    api.get('/subscriptions/plans').then((r) => setPlans(r.data));
    api.get('/subscriptions/mine').then((r) => setMine(r.data));
  };
  useEffect(() => {
    load();
  }, []);

  const subscribe = async (planId: string) => {
    // Paid plans now actually collect payment (via the configurable payment
    // provider abstraction) before activating -- see SubscriptionsService.subscribe.
    // The mock/sandbox provider confirms instantly so the reload below shows
    // it ACTIVE right away; a real push-to-pay provider (e.g. MTN MoMo) would
    // return redirectUrl/message here instead while the customer confirms on
    // their phone, and activation lands via webhook shortly after.
    const { data } = await api.post(`/subscriptions/subscribe/${planId}`);
    if (data?.redirectUrl) window.location.href = data.redirectUrl;
    else if (data?.message) window.alert(data.message);
    load();
  };

  const activePlanId = mine.find((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')?.planId;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('nav.subscriptions')}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-5 ${
              p.id === activePlanId ? 'border-agrigreen-500 bg-agrigreen-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="text-xs uppercase text-gray-400">{p.tier}</div>
            <div className="text-lg font-bold">{p.name}</div>
            <div className="mt-1 text-2xl font-bold text-agrigreen-700">
              RWF {p.priceRwf.toLocaleString()}
              <span className="text-sm font-normal text-gray-400">/{p.billingCycle.toLowerCase()}</span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-gray-600">
              {p.features?.map((f: any) => (
                <li key={f.id}>
                  ✓ {f.featureName} {f.limitValue != null ? `(${f.limitValue})` : '(unlimited)'}
                </li>
              ))}
            </ul>
            <button
              onClick={() => subscribe(p.id)}
              disabled={p.id === activePlanId}
              className="mt-4 w-full rounded-lg bg-agrigreen-600 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700 disabled:opacity-50"
            >
              {p.id === activePlanId ? 'Current plan' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
