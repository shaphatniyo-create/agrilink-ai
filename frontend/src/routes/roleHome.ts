/**
 * Maps every RBAC role to exactly one dashboard route. This is what makes
 * "sign in -> land straight on your own dashboard, never anyone else's" work:
 * every login path (password or Google) calls getHomeRoute(roles) and
 * navigates there, and each /dashboard/:group route is wrapped in
 * <ProtectedRoute roles={...}> restricted to the roles in that group -- so
 * even a user who types another role's dashboard URL directly is bounced
 * back to their own (see ProtectedRoute).
 */
export const ROLE_GROUPS: Record<string, string[]> = {
  admin: ['SUPER_ADMIN', 'HELPER_ADMIN'],
  hq: ['CEO', 'DAF', 'CTO', 'AGRICULTURE_MANAGER', 'FINANCE_MANAGER'],
  leader: ['PROVINCE_LEADER', 'DISTRICT_LEADER', 'SECTOR_LEADER', 'CELL_LEADER', 'VILLAGE_LEADER'],
  farmer: ['FARMER'],
  cooperative: ['COOPERATIVE'],
  buyer: ['BUYER'],
  supplier: ['SUPPLIER'],
  transporter: ['TRANSPORTER'],
  expert: ['AGRICULTURAL_EXPERT'],
  marketing: ['MARKETING_PARTNER'],
  b2b: ['B2B_CLIENT'],
  support: ['CUSTOMER_SUPPORT'],
};

/** First matching group wins -- a user only ever has one primary dashboard, even if (rarely) they hold more than one role. */
export function roleGroupFor(roles: string[]): string | null {
  for (const [group, groupRoles] of Object.entries(ROLE_GROUPS)) {
    if (roles.some((r) => groupRoles.includes(r))) return group;
  }
  return null;
}

export function getHomeRoute(roles: string[]): string {
  const group = roleGroupFor(roles);
  return group ? `/dashboard/${group}` : '/pending-approval';
}
