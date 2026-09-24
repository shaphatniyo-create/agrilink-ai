import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { getHomeRoute } from '../routes/roleHome';

/**
 * Lands here after AuthController#googleCallback redirects the browser back
 * with either ?access=&refresh= (existing, approved account) or
 * ?pending=true&reason=... (brand-new Google sign-up, or an existing one not
 * yet approved). Either way we never render a dashboard directly off this
 * page -- we store the tokens, re-fetch /users/me exactly like password
 * login does, and hand off to the same role-based redirect, so "continue
 * with Google" ends up on precisely the same per-role dashboard password
 * login would put you on.
 */
export default function GoogleCallback() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const pending = params.get('pending');
      if (pending === 'true') {
        setError(params.get('reason') || t('googleCallback.pending'));
        return;
      }
      const access = params.get('access');
      const refresh = params.get('refresh');
      if (!access || !refresh) {
        setError(t('googleCallback.error'));
        return;
      }
      setTokens(access, refresh);
      try {
        const me = await api.get('/users/me', { headers: { Authorization: `Bearer ${access}` } });
        setUser(me.data);
        const roles = (me.data.roleAssignments ?? []).map((r: any) => r.role);
        navigate(getHomeRoute(roles), { replace: true });
      } catch {
        setError(t('googleCallback.error'));
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-agrigreen-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        {error ? (
          <>
            <div className="mb-4 text-4xl">⏳</div>
            <h1 className="mb-2 text-lg font-semibold">{t('googleCallback.notYet')}</h1>
            <p className="text-sm text-gray-600">{error}</p>
            <a href="/login" className="mt-6 inline-block text-sm font-medium text-agrigreen-700 hover:underline">
              {t('register.backToLogin')}
            </a>
          </>
        ) : (
          <p className="text-sm text-gray-500">{t('googleCallback.working')}</p>
        )}
      </div>
    </div>
  );
}
