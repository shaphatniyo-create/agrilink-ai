import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

const fmt = new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 });

export default function Marketplace() {
  const { t } = useTranslation();
  const [listings, setListings] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cropId: '', areaId: '', title: '', quantity: 100, unit: 'kg', pricePerUnit: 0 });
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});

  const load = () => {
    api.get('/marketplace/listings').then((r) => setListings(r.data));
  };

  useEffect(() => {
    load();
    api.get('/crops?activeOnly=true').then((r) => setCrops(r.data));
  }, []);

  const createListing = async () => {
    await api.post('/marketplace/listings', form);
    setShowForm(false);
    load();
  };

  const buy = async (listingId: string) => {
    const quantity = buyQty[listingId] || 1;
    await api.post('/marketplace/orders', { listingId, quantity });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('marketplace.title')}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-agrigreen-600 px-4 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700"
        >
          {t('marketplace.newListing')}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              value={form.cropId}
              onChange={(e) => setForm({ ...form, cropId: e.target.value })}
            >
              <option value="">Select crop</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Area ID (village/cell)"
              value={form.areaId}
              onChange={(e) => setForm({ ...form, areaId: e.target.value })}
            />
            <input
              type="number"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Quantity (kg)"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
            <input
              type="number"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Price per kg (RWF)"
              value={form.pricePerUnit}
              onChange={(e) => setForm({ ...form, pricePerUnit: Number(e.target.value) })}
            />
          </div>
          <button onClick={createListing} className="rounded bg-agrigreen-600 px-4 py-1.5 text-sm text-white">
            Publish
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-agrigreen-600">{l.crop?.name}</div>
            <div className="font-semibold">{l.title}</div>
            <div className="text-sm text-gray-500">{l.area?.name}</div>
            <div className="mt-2 text-lg font-bold">RWF {fmt.format(l.pricePerUnit)}/{l.unit}</div>
            <div className="text-xs text-gray-400">{l.quantity} {l.unit} available</div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                value={buyQty[l.id] || ''}
                onChange={(e) => setBuyQty({ ...buyQty, [l.id]: Number(e.target.value) })}
                placeholder="Qty"
              />
              <button
                onClick={() => buy(l.id)}
                className="rounded bg-agrigreen-600 px-3 py-1 text-sm text-white hover:bg-agrigreen-700"
              >
                Order
              </button>
            </div>
          </div>
        ))}
        {listings.length === 0 && <p className="text-sm text-gray-500">No active listings yet.</p>}
      </div>
    </div>
  );
}
