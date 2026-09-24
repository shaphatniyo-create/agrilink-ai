import { Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import HomeRedirect from './routes/HomeRedirect';
import { ROLE_GROUPS } from './routes/roleHome';
import Login from './pages/Login';
import Register from './pages/Register';
import GoogleCallback from './pages/GoogleCallback';
import VerifyEmail from './pages/VerifyEmail';
import SetPassword from './pages/SetPassword';
import PendingApproval from './pages/PendingApproval';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import Farms from './pages/Farms';
import Transport from './pages/Transport';
import Communication from './pages/Communication';
import Subscriptions from './pages/Subscriptions';
import OrgChart from './pages/OrgChart';
import Finance from './pages/Finance';
import CropsAdmin from './pages/CropsAdmin';
import GeoAdmin from './pages/GeoAdmin';
import AdminApprovals from './pages/AdminApprovals';
import AiAdvisory from './pages/AiAdvisory';
import Sensors from './pages/Sensors';

const HQ_ROLES = ['SUPER_ADMIN', 'CEO', 'DAF', 'CTO', 'AGRICULTURE_MANAGER', 'FINANCE_MANAGER'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/set-password" element={<SetPassword />} />

      <Route element={<ProtectedRoute allowPending />}>
        <Route path="/pending-approval" element={<PendingApproval />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirect />} />

          {/* One route per role group -- each strictly gated so a user can
              only ever land on / open their own dashboard (see ProtectedRoute
              and routes/roleHome.ts). The rendered Dashboard itself further
              tailors its content to the signed-in user's actual roles. */}
          {Object.entries(ROLE_GROUPS).map(([group, roles]) => (
            <Route key={group} element={<ProtectedRoute roles={roles} />}>
              <Route path={`/dashboard/${group}`} element={<Dashboard />} />
            </Route>
          ))}

          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/farms" element={<Farms />} />
          <Route path="/ai-advisory" element={<AiAdvisory />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/transport" element={<Transport />} />
          <Route path="/communication" element={<Communication />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/org-chart" element={<OrgChart />} />

          <Route element={<ProtectedRoute roles={[...HQ_ROLES]} />}>
            <Route path="/finance" element={<Finance />} />
            <Route path="/crops" element={<CropsAdmin />} />
          </Route>
          <Route element={<ProtectedRoute roles={['SUPER_ADMIN']} />}>
            <Route path="/geo-admin" element={<GeoAdmin />} />
          </Route>
          <Route element={<ProtectedRoute roles={['SUPER_ADMIN', 'HELPER_ADMIN']} />}>
            <Route path="/admin-approvals" element={<AdminApprovals />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
