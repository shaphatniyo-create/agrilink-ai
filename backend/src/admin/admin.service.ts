import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { AuthenticatedUser } from '../auth/auth.types';

const ADMIN_REQUEST_TYPES: Record<'SUPER_ADMIN' | 'HELPER_ADMIN', 'NEW_SUPER_ADMIN' | 'NEW_HELPER_ADMIN'> = {
  SUPER_ADMIN: 'NEW_SUPER_ADMIN',
  HELPER_ADMIN: 'NEW_HELPER_ADMIN',
};

/**
 * Implements the admin-governance rules from the "who can create an admin"
 * requirement:
 *   - Only a Super Admin may propose a new Super Admin or Helper Admin.
 *   - That proposal is inert (the account stays PENDING, unusable) until a
 *     *different* Super Admin co-signs it -- two-person control on the most
 *     powerful roles in the system, so a single compromised/rogue Super
 *     Admin account can never mint another admin unilaterally.
 *   - Ordinary self-service sign-ups (farmer, buyer, supplier, ...) are a
 *     separate, lighter-weight queue that either a Super Admin OR a Helper
 *     Admin can clear alone -- "integrate approval from helper admin and
 *     super admin" for that workflow specifically.
 *   - Nobody reaches an ACTIVE, usable account through any path without a
 *     recorded decision here.
 */
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private authService: AuthService,
    private email: EmailService,
  ) {}

  async proposeAdmin(
    actor: AuthenticatedUser,
    dto: { email: string; phone?: string; firstName: string; lastName: string; role: 'SUPER_ADMIN' | 'HELPER_ADMIN' },
  ) {
    if (!actor.roleNames.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Only a Super Admin can add another admin.');
    }
    if (dto.role !== 'SUPER_ADMIN' && dto.role !== 'HELPER_ADMIN') {
      throw new BadRequestException('role must be SUPER_ADMIN or HELPER_ADMIN.');
    }
    // Not a class-validator DTO on this route (see admin.controller.ts), so
    // it doesn't get RegisterDto/LoginDto's automatic @Transform -- normalize
    // by hand here, same rule: emails are matched case-insensitively.
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (existing) throw new BadRequestException('That phone or email is already registered.');

    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: 'PENDING',
        // No passwordHash yet -- the appointee sets their own once approved
        // (see AuthService.issuePasswordSetEmail / setPassword).
      },
    });
    const request = await this.prisma.approvalRequest.create({
      data: {
        type: ADMIN_REQUEST_TYPES[dto.role],
        targetUserId: user.id,
        proposedRole: dto.role,
        requestedById: actor.id,
      },
    });
    await this.audit.log(actor.id, 'ADMIN_ACCOUNT_PROPOSED', 'ApprovalRequest', request.id, {
      role: dto.role,
      targetUserId: user.id,
    });
    return request;
  }

  /** Pending (and recent) NEW_SUPER_ADMIN / NEW_HELPER_ADMIN requests. */
  async listAdminRequests(actor: AuthenticatedUser) {
    if (!actor.roleNames.includes('SUPER_ADMIN')) throw new ForbiddenException('Super Admin only.');
    return this.prisma.approvalRequest.findMany({
      where: { type: { in: ['NEW_SUPER_ADMIN', 'NEW_HELPER_ADMIN'] } },
      include: { targetUser: true, requestedBy: true, coSignedBy: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async decideAdminRequest(actor: AuthenticatedUser, requestId: string, approve: boolean, notes?: string) {
    if (!actor.roleNames.includes('SUPER_ADMIN')) throw new ForbiddenException('Super Admin only.');
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { targetUser: true },
    });
    if (!request || !['NEW_SUPER_ADMIN', 'NEW_HELPER_ADMIN'].includes(request.type)) {
      throw new NotFoundException('Admin approval request not found.');
    }
    if (request.status !== 'PENDING') throw new BadRequestException('This request was already decided.');
    if (request.requestedById === actor.id) {
      throw new ForbiddenException(
        'A different Super Admin must co-sign this request -- you cannot approve your own proposal.',
      );
    }
    if (!request.targetUserId || !request.targetUser) throw new NotFoundException('Target account not found.');
    // Captured into locals so TypeScript's narrowing from the guard above
    // (targetUserId/targetUser are non-null) holds reliably across every
    // `await` below, rather than re-reading the possibly-nullable fields off
    // `request` each time.
    const targetUserId = request.targetUserId;
    const targetUser = request.targetUser;
    const proposedRole = request.proposedRole;

    if (!approve) {
      await this.prisma.$transaction([
        this.prisma.approvalRequest.update({
          where: { id: requestId },
          data: { status: 'REJECTED', coSignedById: actor.id, decisionNotes: notes, decidedAt: new Date() },
        }),
        this.prisma.user.update({ where: { id: targetUserId }, data: { status: 'REJECTED' } }),
      ]);
      await this.audit.log(actor.id, 'ADMIN_ACCOUNT_REJECTED', 'ApprovalRequest', requestId);
      if (targetUser.email) {
        await this.email.sendApprovalDecisionEmail(targetUser.email, targetUser.firstName, false);
      }
      return { success: true, status: 'REJECTED' };
    }

    await this.prisma.$transaction([
      this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', coSignedById: actor.id, decisionNotes: notes, decidedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: targetUserId }, data: { status: 'ACTIVE' } }),
      this.prisma.roleAssignment.create({
        data: {
          userId: targetUserId,
          role: proposedRole as UserRole,
          isPrimary: true,
          assignedBy: actor.id,
        },
      }),
    ]);
    await this.audit.log(actor.id, 'ADMIN_ACCOUNT_APPROVED', 'ApprovalRequest', requestId, { role: proposedRole });

    if (targetUser.email) {
      await this.authService.issuePasswordSetEmail(
        targetUserId,
        targetUser.email,
        targetUser.firstName,
        proposedRole ?? undefined,
      );
    }
    return { success: true, status: 'APPROVED' };
  }

  /** SUPER_ADMIN and HELPER_ADMIN share this queue -- ordinary user sign-ups only, never admin accounts (those go through decideAdminRequest above). */
  async pendingRegistrations(actor: AuthenticatedUser) {
    if (!actor.roleNames.some((r) => (['SUPER_ADMIN', 'HELPER_ADMIN'] as UserRole[]).includes(r))) {
      throw new ForbiddenException('Super Admin or Helper Admin only.');
    }
    return this.prisma.approvalRequest.findMany({
      where: { type: 'USER_REGISTRATION', status: 'PENDING' },
      include: { targetUser: true, proposedGeoArea: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  async decideRegistration(
    actor: AuthenticatedUser,
    requestId: string,
    approve: boolean,
    adjustments: { role?: UserRole; geoAreaId?: string; departmentId?: string } = {},
    notes?: string,
  ) {
    if (!actor.roleNames.some((r) => (['SUPER_ADMIN', 'HELPER_ADMIN'] as UserRole[]).includes(r))) {
      throw new ForbiddenException('Super Admin or Helper Admin only.');
    }
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { targetUser: true },
    });
    if (!request || request.type !== 'USER_REGISTRATION') throw new NotFoundException('Registration request not found.');
    if (request.status !== 'PENDING') throw new BadRequestException('This request was already decided.');
    if (!request.targetUserId || !request.targetUser) throw new NotFoundException('Target account not found.');
    const targetUserId = request.targetUserId;
    const targetUser = request.targetUser;

    if (!approve) {
      await this.prisma.$transaction([
        this.prisma.approvalRequest.update({
          where: { id: requestId },
          data: { status: 'REJECTED', approvedById: actor.id, decisionNotes: notes, decidedAt: new Date() },
        }),
        this.prisma.user.update({ where: { id: targetUserId }, data: { status: 'REJECTED' } }),
      ]);
      await this.audit.log(actor.id, 'REGISTRATION_REJECTED', 'ApprovalRequest', requestId);
      if (targetUser.email) {
        await this.email.sendApprovalDecisionEmail(targetUser.email, targetUser.firstName, false);
      }
      return { success: true, status: 'REJECTED' };
    }

    // An admin may confirm the applicant's requested role/area as-is, or
    // override it (e.g. a Google sign-up proposes no role at all, so the
    // approving admin must supply one).
    const role = adjustments.role ?? request.proposedRole ?? undefined;
    if (!role) {
      throw new BadRequestException('A role must be provided to approve this registration.');
    }
    const geoAreaId = adjustments.geoAreaId ?? request.proposedGeoAreaId ?? undefined;
    const departmentId = adjustments.departmentId ?? request.proposedDepartmentId ?? undefined;

    await this.prisma.$transaction([
      this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedById: actor.id,
          proposedRole: role,
          proposedGeoAreaId: geoAreaId,
          proposedDepartmentId: departmentId,
          decisionNotes: notes,
          decidedAt: new Date(),
        },
      }),
      this.prisma.user.update({ where: { id: targetUserId }, data: { status: 'ACTIVE' } }),
      this.prisma.roleAssignment.create({
        data: {
          userId: targetUserId,
          role,
          geoAreaId,
          departmentId,
          isPrimary: true,
          assignedBy: actor.id,
        },
      }),
    ]);
    await this.audit.log(actor.id, 'REGISTRATION_APPROVED', 'ApprovalRequest', requestId, { role });

    if (targetUser.email) {
      await this.email.sendApprovalDecisionEmail(targetUser.email, targetUser.firstName, true, role);
    }
    return { success: true, status: 'APPROVED' };
  }
}
