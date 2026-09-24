import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

/**
 * Where anyone whose account isn't ACTIVE yet ends up -- reached either from
 * ProtectedRoute (a logged-in-but-not-approved user tries to open any app
 * route) or directly after registering. Enforces "no one can use it without
 * approval of Super Admin" at the UI layer too, on top of the backend
 * rejecting login/API calls for non-ACTIVE accounts regardless.
 */
export default function PendingApproval() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const reason = params.get('reason');

  return (
    <div className="flex min-h-screen items-center justify-center bg-agrigreen-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mb-4 text-4xl">⏳</div>
        <h1 className="mb-2 text-lg font-semibold">{t('pendingApproval.title')}</h1>
        <p className="text-sm text-gray-600">
          {reason || (user?.status === 'REJECTED' ? t('pendingApproval.rejected') : t('pendingApproval.body'))}
        </p>
        <button
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
          className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}
