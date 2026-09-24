import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

// Every role an approving admin may hand to an ordinary registration --
// deliberately excludes SUPER_ADMIN/HELPER_ADMIN, which only go through the
// separate dual-control "propose admin" flow below.
const ASSIGNABLE_ROLES = [
  'FARMER',
  'COOPERATIVE',
  'BUYER',
  'SUPPLIER',
  'TRANSPORTER',
  'AGRICULTURAL_EXPERT',
  'MARKETING_PARTNER',
  'B2B_CLIENT',
  'CUSTOMER_SUPPORT',
  'PROVINCE_LEADER',
  'DISTRICT_LEADER',
  'SECTOR_LEADER',
  'CELL_LEADER',
  'VILLAGE_LEADER',
  'CEO',
  'DAF',
  'CTO',
  'AGRICULTURE_MANAGER',
  'FINANCE_MANAGER',
];

function RegistrationRow({ req, onDecided }: { req: any; onDecided: () => void }) {
  const { t } = useTranslation();
  const [role, setRole] = useState(req.proposedRole || 'FARMER');
  const [geoAreaId, setGeoAreaId] = useState(req.proposedGeoAreaId || '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      await api.post(`/admin/registrations/${req.id}/decide`, {
        approve,
        role: approve ? role : undefined,
        geoAreaId: approve && geoAreaId ? geoAreaId : undefined,
        notes: notes || undefined,
      });
      onDecided();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {req.targetUser?.firstName} {req.targetUser?.lastName}
          </div>
          <div className="text-xs text-gray-500">{req.targetUser?.email || req.targetUser?.phone}</div>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{t('adminApprovals.pending')}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('adminApprovals.role')}</label>
          <select className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('adminApprovals.geoAreaId')}</label>
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={geoAreaId}
            onChange={(e) => setGeoAreaId(e.target.value)}
            placeholder={t('adminApprovals.geoAreaIdHint') as string}
          />
        </div>
      </div>
      <input
        className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('adminApprovals.notes') as string}
      />
      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="rounded-lg bg-agrigreen-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-agrigreen-700 disabled:opacity-50"
        >
          {t('adminApprovals.approve')}
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {t('adminApprovals.reject')}
        </button>
      </div>
    </div>
  );
}

function AdminRequestRow({ req, onDecided, currentUserId }: { req: any; onDecided: () => void; currentUserId?: string }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwnProposal = req.requestedById === currentUserId;

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      await api.post(`/admin/admin-requests/${req.id}/decide`, { approve, notes: notes || undefined });
      onDecided();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {req.targetUser?.firstName} {req.targetUser?.lastName} &middot;{' '}
            <span className="text-agrigreen-700">{req.proposedRole}</span>
          </div>
          <div className="text-xs text-gray-500">{req.targetUser?.email}</div>
          <div className="mt-1 text-xs text-gray-400">
            {t('adminApprovals.proposedBy')} {req.requestedBy?.firstName} {req.requestedBy?.lastName}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : req.status === 'APPROVED' ? 'bg-agrigreen-100 text-agrigreen-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {req.status}
        </span>
      </div>
      {req.status === 'PENDING' && (
        <>
          {isOwnProposal ? (
            <p className="mt-3 text-xs text-amber-600">{t('adminApprovals.needDifferentAdmin')}</p>
          ) : (
            <>
              <input
                className="mt-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('adminApprovals.notes') as string}
              />
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => decide(true)}
                  className="rounded-lg bg-agrigreen-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-agrigreen-700 disabled:opacity-50"
                >
                  {t('adminApprovals.coSign')}
                </button>
                <button
                  disabled={busy}
                  onClick={() => decide(false)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('adminApprovals.reject')}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminApprovals() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.roleNames()).includes('SUPER_ADMIN');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [proposeForm, setProposeForm] = useState({ email: '', phone: '', firstName: '', lastName: '', role: 'HELPER_ADMIN' });
  const [proposeError, setProposeError] = useState('');
  const [proposeBusy, setProposeBusy] = useState(false);

  const loadRegistrations = () => api.get('/admin/registrations').then((r) => setRegistrations(r.data));
  const loadAdminRequests = () => isSuperAdmin && api.get('/admin/admin-requests').then((r) => setAdminRequests(r.data));

  useEffect(() => {
    loadRegistrations();
    loadAdminRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPropose = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposeError('');
    setProposeBusy(true);
    try {
      await api.post('/admin/admins', proposeForm);
      setProposeForm({ email: '', phone: '', firstName: '', lastName: '', role: 'HELPER_ADMIN' });
      loadAdminRequests();
    } catch (err: any) {
      setProposeError(err?.response?.data?.message || 'Could not submit.');
    } finally {
      setProposeBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('adminApprovals.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('adminApprovals.subtitle')}</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('adminApprovals.registrationsHeading')}</h2>
        <div className="space-y-3">
          {registrations.length === 0 && <p className="text-sm text-gray-400">{t('adminApprovals.none')}</p>}
          {registrations.map((r) => (
            <RegistrationRow key={r.id} req={r} onDecided={loadRegistrations} />
          ))}
        </div>
      </div>

      {isSuperAdmin && (
        <>
          <div>
            <h2 className="mb-3 text-lg font-semibold">{t('adminApprovals.proposeHeading')}</h2>
            <p className="mb-3 max-w-2xl text-xs text-gray-500">{t('adminApprovals.dualControlNotice')}</p>
            <form onSubmit={submitPropose} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
              <input
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder={t('register.firstName') as string}
                value={proposeForm.firstName}
                onChange={(e) => setProposeForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
              <input
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder={t('register.lastName') as string}
                value={proposeForm.lastName}
                onChange={(e) => setProposeForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
              <input
                type="email"
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder={t('register.email') as string}
                value={proposeForm.email}
                onChange={(e) => setProposeForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <input
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder={t('register.phone') as string}
                value={proposeForm.phone}
                onChange={(e) => setProposeForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <select
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={proposeForm.role}
                onChange={(e) => setProposeForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="HELPER_ADMIN">Helper Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
              <button
                type="submit"
                disabled={proposeBusy}
                className="rounded-lg bg-agrigreen-600 px-3 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700 disabled:opacity-50 sm:col-span-2"
              >
                {proposeBusy ? '...' : t('adminApprovals.proposeSubmit')}
              </button>
              {proposeError && <p className="text-sm text-red-600 sm:col-span-2">{proposeError}</p>}
            </form>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">{t('adminApprovals.adminRequestsHeading')}</h2>
            <div className="space-y-3">
              {adminRequests.length === 0 && <p className="text-sm text-gray-400">{t('adminApprovals.none')}</p>}
              {adminRequests.map((r) => (
                <AdminRequestRow key={r.id} req={r} onDecided={loadAdminRequests} currentUserId={user?.id} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
