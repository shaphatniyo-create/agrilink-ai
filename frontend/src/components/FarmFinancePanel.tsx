import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

const fmt = new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 });

export default function FarmFinancePanel({ farmId, farmName }: { farmId: string; farmName: string }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '' });
  const [incomeForm, setIncomeForm] = useState({ source: '', amount: '' });

  const load = () => {
    api.get(`/farm-finance/${farmId}/summary`).then((r) => setSummary(r.data));
    api.get(`/farm-finance/${farmId}/expenses`).then((r) => setExpenses(r.data));
    api.get(`/farm-finance/${farmId}/income`).then((r) => setIncome(r.data));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  const addExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) return;
    await api.post(`/farm-finance/${farmId}/expenses`, { category: expenseForm.category, amount: Number(expenseForm.amount) });
    setExpenseForm({ category: '', amount: '' });
    load();
  };
  const addIncome = async () => {
    if (!incomeForm.source || !incomeForm.amount) return;
    await api.post(`/farm-finance/${farmId}/income`, { source: incomeForm.source, amount: Number(incomeForm.amount) });
    setIncomeForm({ source: '', amount: '' });
    load();
  };

  const downloadCsv = async () => {
    const res = await api.get(`/farm-finance/${farmId}/export.csv`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${farmName.replace(/\s+/g, '-').toLowerCase()}-ledger.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /**
   * "PDF export" without a backend PDF library: build a clean printable
   * report in a new window and let the browser's native print dialog save
   * it as a PDF. Zero new dependencies, works in every browser.
   */
  const printReport = () => {
    if (!summary) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = (label: string, obj: Record<string, number>) =>
      Object.entries(obj)
        .map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">RWF ${fmt.format(v)}</td></tr>`)
        .join('') || `<tr><td colspan="2" style="color:#999">No ${label} recorded</td></tr>`;
    win.document.write(`
      <html>
      <head>
        <title>${farmName} - Financial Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 14px; margin-top: 24px; color: #444; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          td { padding: 6px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
          .totals td { font-weight: bold; }
          .net-positive { color: #15803d; }
          .net-negative { color: #b91c1c; }
        </style>
      </head>
      <body>
        <h1>${farmName} -- Financial Report</h1>
        <p style="color:#666;font-size:12px">Generated ${new Date().toLocaleString()}</p>
        <table class="totals">
          <tr><td>Total income</td><td style="text-align:right">RWF ${fmt.format(summary.totalIncome)}</td></tr>
          <tr><td>Total expense</td><td style="text-align:right">RWF ${fmt.format(summary.totalExpense)}</td></tr>
          <tr><td>Net result</td><td style="text-align:right" class="${summary.net >= 0 ? 'net-positive' : 'net-negative'}">RWF ${fmt.format(summary.net)}</td></tr>
        </table>
        <h2>Expenses by category</h2>
        <table>${rows('expenses', summary.expenseByCategory)}</table>
        <h2>Income by source</h2>
        <table>${rows('income', summary.incomeBySource)}</table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-400">{t('finance.totalIncome')}</div>
            <div className="text-lg font-bold text-agrigreen-700">RWF {fmt.format(summary.totalIncome)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-400">{t('finance.totalExpense')}</div>
            <div className="text-lg font-bold text-gray-800">RWF {fmt.format(summary.totalExpense)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-400">{t('finance.net')}</div>
            <div className={`text-lg font-bold ${summary.net >= 0 ? 'text-agrigreen-700' : 'text-red-600'}`}>
              RWF {fmt.format(summary.net)}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={downloadCsv} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          {t('finance.exportCsv')}
        </button>
        <button onClick={printReport} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          {t('finance.printReport')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('finance.recordExpense')}</h3>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[8rem] flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder={t('finance.category') as string}
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            />
            <input
              type="number"
              className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="RWF"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
            <button onClick={addExpense} className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white">
              {t('finance.add')}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-gray-600">
            {expenses.slice(0, 6).map((e) => (
              <li key={e.id} className="flex justify-between border-b border-gray-100 py-1">
                <span>{e.category}</span>
                <span>RWF {fmt.format(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('finance.recordIncome')}</h3>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[8rem] flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder={t('finance.source') as string}
              value={incomeForm.source}
              onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
            />
            <input
              type="number"
              className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="RWF"
              value={incomeForm.amount}
              onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
            />
            <button onClick={addIncome} className="rounded bg-agrigreen-600 px-3 py-1.5 text-sm text-white">
              {t('finance.add')}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-gray-600">
            {income.slice(0, 6).map((i) => (
              <li key={i.id} className="flex justify-between border-b border-gray-100 py-1">
                <span>{i.source}</span>
                <span>RWF {fmt.format(i.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
