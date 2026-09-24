import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Backend-enforced RBAC. Never trust the frontend to hide a button --
 * every state-changing or sensitive-read endpoint should carry @Roles(...)
 * (or, for public/self-service endpoints, be left unrestricted deliberately).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.roleNames) return false;
    return requiredRoles.some((role: UserRole) => user.roleNames.includes(role));
  }
}
