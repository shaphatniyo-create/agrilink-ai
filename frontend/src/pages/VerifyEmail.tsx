import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [state, setState] = useState<'working' | 'success' | 'error'>('working');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('error');
      setErrorMsg(t('verifyEmail.missingToken'));
      return;
    }
    api
      .post('/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch((err) => {
        setState('error');
        setErrorMsg(err?.response?.data?.message || t('verifyEmail.error'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-agrigreen-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        {state === 'working' && <p className="text-sm text-gray-500">{t('verifyEmail.working')}</p>}
        {state === 'success' && (
          <>
            <div className="mb-4 text-4xl">✅</div>
            <h1 className="mb-2 text-lg font-semibold">{t('verifyEmail.success')}</h1>
            <p className="text-sm text-gray-600">{t('verifyEmail.successDetail')}</p>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="mb-2 text-lg font-semibold">{t('verifyEmail.error')}</h1>
            <p className="text-sm text-gray-600">{errorMsg}</p>
          </>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-agrigreen-700 hover:underline">
          {t('register.backToLogin')}
        </Link>
      </div>
    </div>
  );
}
