import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GEO_SCOPE_PARAM_KEY } from '../decorators/roles.decorator';
import { GeoScopeService } from '../geo-scope.service';

/**
 * Enforces that the caller's role assignments cover the AdminArea referenced
 * by the request (route param, query, or body -- whichever holds the key
 * named by @GeoScoped()). SUPER_ADMIN/CEO/DAF/CTO/AGRICULTURE_MANAGER/
 * FINANCE_MANAGER (HQ roles) always pass. Province/District/Sector/Cell/
 * Village leaders pass only for their own jurisdiction (or a descendant of it).
 */
@Injectable()
export class GeoScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private geoScope: GeoScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string>(GEO_SCOPE_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!paramName) return true;

    const request = context.switchToHttp().getRequest();
    const areaId =
      request.params?.[paramName] ?? request.query?.[paramName] ?? request.body?.[paramName];
    if (!areaId) return true; // nothing to scope-check (e.g. national list endpoint)

    const user = request.user;
    if (!user) return false;

    const allowed = await this.geoScope.canAccessArea(user, areaId);
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this administrative area.');
    }
    return true;
  }
}
