import { FormEvent, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

/**
 * Where an admin-approved account (a new Super Admin/Helper Admin, or any
 * account an admin activated with no password of its own) lands from the
 * "set your password" email link issued by AuthService.issuePasswordSetEmail.
 */
export default function SetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const token = params.get('token');
    if (!token) {
      setError(t('setPassword.missingToken'));
      return;
    }
    if (password !== confirm) {
      setError(t('setPassword.mismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/set-password', { token, password });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('setPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-agrigreen-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-4 text-lg font-semibold">{t('setPassword.title')}</h1>
        {done ? (
          <>
            <p className="text-sm text-gray-600">{t('setPassword.success')}</p>
            <Link to="/login" className="mt-6 inline-block text-sm font-medium text-agrigreen-700 hover:underline">
              {t('login.submit')}
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t('setPassword.newPassword')}</label>
              <input
                type="password"
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t('setPassword.confirmPassword')}</label>
              <input
                type="password"
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-agrigreen-600 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700 disabled:opacity-50"
            >
              {loading ? '...' : t('setPassword.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
