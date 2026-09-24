import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { getHomeRoute } from '../routes/roleHome';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    api
      .get('/auth/google/status')
      .then((r) => setGoogleEnabled(!!r.data.enabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // "identifier" accepts a phone number OR an email address -- one login
      // field either way, matching how RegisterDto lets an account carry
      // either or both.
      const { data } = await api.post('/auth/login', { identifier, password });
      setTokens(data.accessToken, data.refreshToken);
      const me = await api.get('/users/me', { headers: { Authorization: `Bearer ${data.accessToken}` } });
      setUser(me.data);
      // Straight to this user's own dashboard -- never a generic landing
      // page another role could also land on.
      const roles = (me.data.roleAssignments ?? []).map((r: any) => r.role);
      navigate(getHomeRoute(roles));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = () => {
    const base = (api.defaults.baseURL || '/api/v1').replace(/\/$/, '');
    window.location.href = `${base}/auth/google`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-agrigreen-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-agrigreen-600 text-white font-bold">A</div>
          <span className="text-xl font-bold text-agrigreen-700">AgriLink AI</span>
        </div>
        <h1 className="mb-4 text-lg font-semibold">{t('login.title')}</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('login.identifier')}</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agrigreen-500 focus:outline-none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="+250780000001 or you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('login.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-agrigreen-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  /* eye-off icon */
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  /* eye icon */
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-agrigreen-600 py-2 text-sm font-semibold text-white hover:bg-agrigreen-700 disabled:opacity-50"
          >
            {loading ? '...' : t('login.submit')}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-200" />
              {t('login.or')}
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <button
              type="button"
              onClick={continueWithGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('login.continueWithGoogle')}
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-agrigreen-700 hover:underline">
            {t('login.registerLink')}
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-gray-400">
          Demo: +250780000012 / AgriLink@2026 (farmer) &middot; shaphatniyo@gmail.com (super admin)
        </p>
      </div>
    </div>
  );
}
