import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getHomeRoute } from './roleHome';

/**
 * roles, when passed, strictly isolates this route: only a user holding one
 * of the listed roles may render it. Anyone else -- including another
 * authenticated, approved user with a different role -- is bounced to their
 * own dashboard, never shown this one. This is what turns "farmer dashboard"
 * and "buyer dashboard" into routes that are actually exclusive to their
 * role, not just differently-labeled links on a shared page.
 */
export default function ProtectedRoute({ roles, allowPending }: { roles?: string[]; allowPending?: boolean }) {
  const { accessToken, user, roleNames } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  // allowPending=true is only ever set on the /pending-approval route itself
  // -- without this escape hatch, a not-yet-ACTIVE user redirected here would
  // immediately be redirected right back to itself in an infinite loop.
  if (!allowPending && user && user.status !== 'ACTIVE') return <Navigate to="/pending-approval" replace />;
  if (roles && !roleNames().some((r) => roles.includes(r))) {
    return <Navigate to={getHomeRoute(roleNames())} replace />;
  }
  return <Outlet />;
}
