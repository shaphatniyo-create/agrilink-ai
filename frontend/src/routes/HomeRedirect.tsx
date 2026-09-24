import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getHomeRoute } from './roleHome';

/** "/" never renders content itself -- it only ever forwards to the signed-in user's own role dashboard. */
export default function HomeRedirect() {
  const roleNames = useAuthStore((s) => s.roleNames);
  return <Navigate to={getHomeRoute(roleNames())} replace />;
}
