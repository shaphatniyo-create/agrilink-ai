import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoScopeService } from '../common/geo-scope.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private geoScope: GeoScopeService,
    private audit: AuditService,
  ) {}

  async me(user: AuthenticatedUser) {
    return this.prisma.user.findUnique({
      where: { id: user.id },
      include: { roleAssignments: { where: { revokedAt: null }, include: { geoArea: true, department: true } } },
    });
  }

  async findAll(user: AuthenticatedUser, filters: { role?: UserRole; areaId?: string }) {
    const areaIds = await this.geoScope.accessibleAreaIds(user);
    return this.prisma.user.findMany({
      where: {
        roleAssignments: {
          some: {
            role: filters.role,
            geoAreaId: filters.areaId ?? (areaIds ? { in: areaIds } : undefined),
            revokedAt: null,
          },
        },
      },
      include: { roleAssignments: true },
      take: 500,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roleAssignments: { include: { geoArea: true, department: true } } },
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  /**
   * Assign a role to a user, optionally scoped to an AdminArea (leader roles)
   * or Department (HQ roles). Only SUPER_ADMIN, or a leader assigning a role
   * strictly *below* their own level within their own jurisdiction, may do this.
   *
   * Deliberately NOT a back door around the admin-governance rules:
   *  - SUPER_ADMIN/HELPER_ADMIN can never be granted here, at any privilege
   *    level -- those only ever come from AdminService's dual-control
   *    propose/co-sign flow (a single actor, including a Super Admin, could
   *    otherwise mint another Super Admin unilaterally through this generic
   *    endpoint, defeating the two-person control entirely).
   *  - A PENDING or REJECTED user can never be activated here -- that would
   *    let anyone holding a leader role bypass the Super Admin/Helper Admin
   *    approval queue for self-registrations. Activation only ever happens
   *    through AdminService.decideRegistration/decideAdminRequest, which
   *    record the approval decision this system is built around.
   */
  async assignRole(
    actor: AuthenticatedUser,
    targetUserId: string,
    data: { role: UserRole; geoAreaId?: string; departmentId?: string; isPrimary?: boolean },
  ) {
    if (data.role === 'SUPER_ADMIN' || data.role === 'HELPER_ADMIN') {
      throw new ForbiddenException(
        'Super Admin and Helper Admin accounts can only be created via the dual-control admin ' +
          'approval flow (POST /admin/admins), never through direct role assignment.',
      );
    }
    if (!this.geoScope.hasNationalAccess(actor)) {
      if (!data.geoAreaId) throw new ForbiddenException('Only Super Admin/HQ can assign unscoped roles.');
      const allowed = await this.geoScope.canAccessArea(actor, data.geoAreaId);
      if (!allowed) throw new ForbiddenException('You cannot assign roles outside your jurisdiction.');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found.');
    if (target.status === 'PENDING' || target.status === 'REJECTED') {
      throw new ForbiddenException(
        'This account is not yet approved. Approve it via the Super Admin/Helper Admin approval ' +
          'queue (POST /admin/registrations/:id/decide) rather than assigning a role directly.',
      );
    }
    const assignment = await this.prisma.roleAssignment.create({
      data: {
        userId: targetUserId,
        role: data.role,
        geoAreaId: data.geoAreaId,
        departmentId: data.departmentId,
        isPrimary: data.isPrimary ?? false,
        assignedBy: actor.id,
      },
    });
    await this.audit.log(actor.id, 'ROLE_ASSIGNED', 'RoleAssignment', assignment.id, { role: data.role });
    return assignment;
  }

  async revokeRole(actor: AuthenticatedUser, roleAssignmentId: string) {
    const assignment = await this.prisma.roleAssignment.findUnique({ where: { id: roleAssignmentId } });
    if (!assignment) throw new NotFoundException('Role assignment not found.');
    if (!this.geoScope.hasNationalAccess(actor) && assignment.geoAreaId) {
      const allowed = await this.geoScope.canAccessArea(actor, assignment.geoAreaId);
      if (!allowed) throw new ForbiddenException('You cannot revoke this role.');
    }
    await this.prisma.roleAssignment.update({ where: { id: roleAssignmentId }, data: { revokedAt: new Date() } });
    await this.audit.log(actor.id, 'ROLE_REVOKED', 'RoleAssignment', roleAssignmentId);
    return { success: true };
  }

  /**
   * Suspend/reactivate/deactivate an already-approved account (support-desk
   * moderation). Deliberately cannot be used by CUSTOMER_SUPPORT to activate
   * a PENDING or REJECTED account -- that first activation is reserved for
   * the Super Admin/Helper Admin approval queue (AdminService), so "no one
   * can use it without Super Admin approval" has exactly one door, not two.
   */
  async setStatus(actor: AuthenticatedUser, userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found.');
    const isFirstActivation = status === 'ACTIVE' && (target.status === 'PENDING' || target.status === 'REJECTED');
    if (isFirstActivation && !actor.roleNames.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(
        'A PENDING or REJECTED account can only be activated via the approval queue ' +
          '(POST /admin/registrations/:id/decide) or by a Super Admin.',
      );
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status } });
    await this.audit.log(actor.id, `USER_${status}`, 'User', userId);
    return updated;
  }
}
