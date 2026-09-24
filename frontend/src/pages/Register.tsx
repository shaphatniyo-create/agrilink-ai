import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

const SELF_SERVICE_ROLES = [
  { value: 'FARMER', label: 'Farmer' },
  { value: 'COOPERATIVE', label: 'Cooperative' },
  { value: 'BUYER', label: 'Buyer' },
  { value: 'SUPPLIER', label: 'Agricultural input supplier' },
  { value: 'TRANSPORTER', label: 'Transporter' },
  { value: 'AGRICULTURAL_EXPERT', label: 'Agricultural expert' },
  { value: 'MARKETING_PARTNER', label: 'Marketing partner' },
  { value: 'B2B_CLIENT', label: 'B2B client' },
];

type GeoArea = { id: string; name: string };

function GeoSelect({
  label,
  items,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  items: GeoArea[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-agrigreen-500 focus:outline-none focus:ring-1 focus:ring-agrigreen-400 disabled:bg-gray-100 disabled:text-gray-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || items.length === 0}
      >
        <option value="">{placeholder ?? `— Select ${label} —`}</option>
        {items.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Register() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    showPassword: false,
    requestedRole: 'FARMER',
  });

  // ── geo state ──────────────────────────────────────────────────────────────
  const [countries, setCountries] = useState<GeoArea[]>([]);
  const [provinces, setProvinces] = useState<GeoArea[]>([]);
  const [districts, setDistricts] = useState<GeoArea[]>([]);
  const [sectors, setSectors] = useState<GeoArea[]>([]);
  const [cells, setCells] = useState<GeoArea[]>([]);
  const [villages, setVillages] = useState<GeoArea[]>([]);

  const [selCountry, setSelCountry] = useState('');
  const [selProvince, setSelProvince] = useState('');
  const [selDistrict, setSelDistrict] = useState('');
  const [selSector, setSelSector] = useState('');
  const [selCell, setSelCell] = useState('');
  const [selVillage, setSelVillage] = useState('');
  // ──────────────────────────────────────────────────────────────────────────

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string } | null>(null);

  const update =
    (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // Load countries on mount
  useEffect(() => {
    api.get('/geo/by-level/COUNTRY', { headers: { Authorization: undefined } })
      .then((r) => setCountries(r.data))
      .catch(() => {});
  }, []);

  // Cascading children loaders
  const loadChildren = async (parentId: string, setter: (v: GeoArea[]) => void) => {
    if (!parentId) { setter([]); return; }
    try {
      const r = await api.get(`/geo/children?parentId=${parentId}`);
      setter(r.data);
    } catch { setter([]); }
  };

  useEffect(() => {
    setSelProvince(''); setProvinces([]);
    setSelDistrict(''); setDistricts([]);
    setSelSector('');   setSectors([]);
    setSelCell('');     setCells([]);
    setSelVillage('');  setVillages([]);
    loadChildren(selCountry, setProvinces);
  }, [selCountry]);

  useEffect(() => {
    setSelDistrict(''); setDistricts([]);
    setSelSector('');   setSectors([]);
    setSelCell('');     setCells([]);
    setSelVillage('');  setVillages([]);
    loadChildren(selProvince, setDistricts);
  }, [selProvince]);

  useEffect(() => {
    setSelSector(''); setSectors([]);
    setSelCell('');   setCells([]);
    setSelVillage(''); setVillages([]);
    loadChildren(selDistrict, setSectors);
  }, [selDistrict]);

  useEffect(() => {
    setSelCell(''); setCells([]);
    setSelVillage(''); setVillages([]);
    loadChildren(selSector, setCells);
  }, [selSector]);

  useEffect(() => {
    setSelVillage(''); setVillages([]);
    loadChildren(selCell, setVillages);
  }, [selCell]);

  // The most specific selected geo area becomes the requestedGeoAreaId
  const requestedGeoAreaId =
    selVillage || selCell || selSector || selDistrict || selProvince || selCountry || undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email && !form.phone) {
      setError(t('register.needContact'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
        requestedRole: form.requestedRole,
        requestedGeoAreaId,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('register.error'));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-agrigreen-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-5xl">✅</div>
          <h1 className="mb-2 text-lg font-semibold">{t('register.submitted')}</h1>
          <p className="text-sm text-gray-600">{result.message}</p>
          <Link to="/login" className="mt-6 inline-block text-sm font-medium text-agrigreen-700 hover:underline">
            {t('register.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-agrigreen-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-agrigreen-600 text-white font-bold">A</div>
          <span className="text-xl font-bold text-agrigreen-700">AgriLink AI</span>
        </div>
        <h1 className="mb-1 text-lg font-semibold">{t('register.title')}</h1>
        <p className="mb-6 text-xs text-gray-500">{t('register.approvalNotice')}</p>

        <form onSubmit={submit} className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('register.firstName')}</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-agrigreen-500 focus:outline-none"
                value={form.firstName} onChange={update('firstName')} required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('register.lastName')}</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-agrigreen-500 focus:outline-none"
                value={form.lastName} onChange={update('lastName')} required
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('register.email')}</label>
              <input type="email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-agrigreen-500 focus:outline-none"
                value={form.email} onChange={update('email')} placeholder="you@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('register.phone')}</label>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-agrigreen-500 focus:outline-none"
                value={form.phone} onChange={update('phone')} placeholder="+250..." />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('register.password')}</label>
            <div className="relative">
              <input
                type={form.showPassword ? 'text' : 'password'}
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-agrigreen-500 focus:outline-none"
                value={form.password} onChange={update('password')} required
              />
              <button type="button" onClick={() => setForm(f => ({ ...f, showPassword: !f.showPassword }))}
                className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={form.showPassword ? 'Hide password' : 'Show password'}>
                {form.showPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('register.role')}</label>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-agrigreen-500 focus:outline-none"
              value={form.requestedRole} onChange={update('requestedRole')}>
              {SELF_SERVICE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* ── Geographic Location ───────────────────────────────────────── */}
          <div className="rounded-xl border border-agrigreen-100 bg-agrigreen-50/50 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-agrigreen-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Your Location <span className="text-xs font-normal text-gray-500">(optional — helps connect you with local leaders)</span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GeoSelect label="Country"  items={countries} value={selCountry}  onChange={setSelCountry} />
              <GeoSelect label="Province" items={provinces} value={selProvince} onChange={setSelProvince} disabled={!selCountry} />
              <GeoSelect label="District" items={districts} value={selDistrict} onChange={setSelDistrict} disabled={!selProvince} />
              <GeoSelect label="Sector"   items={sectors}   value={selSector}   onChange={setSelSector}   disabled={!selDistrict} />
              <GeoSelect label="Cell"     items={cells}     value={selCell}     onChange={setSelCell}     disabled={!selSector} />
              <GeoSelect label="Village"  items={villages}  value={selVillage}  onChange={setSelVillage}  disabled={!selCell} />
            </div>
            {requestedGeoAreaId && (
              <p className="mt-2 text-xs text-agrigreen-600">
                ✓ Location captured
                {selVillage ? ' (Village)' : selCell ? ' (Cell)' : selSector ? ' (Sector)' : selDistrict ? ' (District)' : selProvince ? ' (Province)' : ' (Country)'}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-agrigreen-600 py-2.5 text-sm font-semibold text-white hover:bg-agrigreen-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creating account…' : t('register.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to="/login" className="font-medium text-agrigreen-700 hover:underline">
            {t('register.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
