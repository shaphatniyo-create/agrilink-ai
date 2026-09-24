import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import StatCard from '../components/StatCard';

const fmt = new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 });

export default function Finance() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/finance/dashboard').then((r) => setData(r.data));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('finance.title')}</h1>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Revenue</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Today" value={`RWF ${fmt.format(data.revenue.today)}`} />
          <StatCard label="This week" value={`RWF ${fmt.format(data.revenue.week)}`} />
          <StatCard label="This month" value={`RWF ${fmt.format(data.revenue.month)}`} />
          <StatCard label="This year" value={`RWF ${fmt.format(data.revenue.year)}`} />
          <StatCard label="All time" value={`RWF ${fmt.format(data.revenue.allTime)}`} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Commission &amp; other revenue</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Settled commission" value={`RWF ${fmt.format(data.commission.total)}`} />
          <StatCard label="Subscription revenue" value={`RWF ${fmt.format(data.commission.subscriptionRevenue)}`} />
          <StatCard label="Advertising revenue" value={`RWF ${fmt.format(data.commission.advertisingRevenue)}`} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Payments</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Count</th>
                <th className="px-4 py-2">Total (RWF)</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p: any) => (
                <tr key={p.status} className="border-t">
                  <td className="px-4 py-2">{p.status}</td>
                  <td className="px-4 py-2">{p.count}</td>
                  <td className="px-4 py-2">{fmt.format(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Expenses by category</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {data.expenses.byCategory.map((e: any) => (
            <StatCard key={e.category} label={e.category} value={`RWF ${fmt.format(e.total)}`} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-agrigreen-200 bg-agrigreen-50 p-5">
        <h2 className="text-sm font-semibold uppercase text-agrigreen-700">{t('finance.netOperatingResult')}</h2>
        <p className="mt-1 text-xs text-gray-500">
          Gross revenue − refunds − payment fees − commission payable − operating expenses
        </p>
        <div className="mt-3 text-3xl font-bold text-agrigreen-700">
          RWF {fmt.format(data.profitability.netOperatingResult)}
        </div>
      </div>
    </div>
  );
}
