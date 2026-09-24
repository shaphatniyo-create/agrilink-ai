import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { getHomeRoute } from '../routes/roleHome';

const HQ_ROLES = ['SUPER_ADMIN', 'CEO', 'DAF', 'CTO', 'AGRICULTURE_MANAGER', 'FINANCE_MANAGER'];

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, roleNames } = useAuthStore();
  const roles = roleNames();
  const isHQ = roles.some((r) => HQ_ROLES.includes(r));
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isHelperAdmin = roles.includes('HELPER_ADMIN');
  const isFinance = roles.some((r) => ['SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER', 'CEO'].includes(r));
  const isTransporter = roles.includes('TRANSPORTER');
  const homeRoute = getHomeRoute(roles);
  const isFarmer = roles.includes('FARMER') || roles.includes('COOPERATIVE');
  const isBuyerOrSupplier = roles.includes('BUYER') || roles.includes('SUPPLIER') || roles.includes('B2B_CLIENT') || roles.includes('MARKETING_PARTNER');

  const navItem = (to: string, label: string, icon: React.ReactNode) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-agrigreen-600 text-white' : 'text-gray-700 hover:bg-agrigreen-50 hover:text-agrigreen-700'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );

  // SVG Icons
  const icons = {
    dashboard: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    marketplace: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
    farms: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    ai: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    sensor: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    transport: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
    communication: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    subscription: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    orgChart: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    finance: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    admin: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    crops: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    geo: <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-gray-200 bg-white p-4 md:h-screen md:w-64 md:border-b-0 md:border-r md:sticky md:top-0 md:overflow-y-auto">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-agrigreen-600 text-white font-bold">A</div>
          <span className="text-lg font-bold text-agrigreen-700">{t('app.name')}</span>
        </div>
        <nav className="space-y-1">
          {navItem(homeRoute, t('nav.dashboard'), icons.dashboard)}
          
          {(isFarmer || isTransporter || isBuyerOrSupplier || isSuperAdmin) && 
            navItem('/marketplace', t('nav.marketplace'), icons.marketplace)}
            
          {(isFarmer || isSuperAdmin) && 
            navItem('/farms', t('nav.farms'), icons.farms)}
            
          {(isFarmer || isSuperAdmin) && 
            navItem('/ai-advisory', t('nav.aiAdvisory', 'AI Advisor'), icons.ai)}
            
          {(isFarmer || isSuperAdmin) && 
            navItem('/sensors', t('nav.sensors', 'Sensors'), icons.sensor)}
            
          {(isFarmer || isTransporter || isBuyerOrSupplier || isSuperAdmin) && 
            navItem('/transport', t('nav.transport'), icons.transport)}
            
          {navItem('/communication', t('nav.communication'), icons.communication)}
          {navItem('/subscriptions', t('nav.subscriptions'), icons.subscription)}
          {navItem('/org-chart', t('nav.orgChart'), icons.orgChart)}
          
          {isFinance && navItem('/finance', t('nav.finance'), icons.finance)}
          {isHQ && navItem('/crops', t('nav.crops'), icons.crops)}
          {isSuperAdmin && navItem('/geo-admin', t('nav.geoAdmin'), icons.geo)}
          {(isSuperAdmin || isHelperAdmin) && navItem('/admin-approvals', t('nav.adminApprovals'), icons.admin)}
        </nav>
        <div className="mt-8 space-y-2 border-t pt-4">
          <select
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={i18n.language}
            onChange={(e) => {
              i18n.changeLanguage(e.target.value);
              localStorage.setItem('agrilink_lang', e.target.value);
            }}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="rw">Ikinyarwanda</option>
          </select>
          <div className="text-xs text-gray-500">
            {user?.firstName} {user?.lastName}
            <div className="truncate">{roles.join(', ')}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
