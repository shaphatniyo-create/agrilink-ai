import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  /** Super Admin proposes a new Super Admin or Helper Admin (needs a second Super Admin's co-sign, see below). */
  @Roles('SUPER_ADMIN')
  @Post('admins')
  proposeAdmin(
    @Body()
    body: {
      email: string;
      phone?: string;
      firstName: string;
      lastName: string;
      role: 'SUPER_ADMIN' | 'HELPER_ADMIN';
    },
    @Req() req: any,
  ) {
    return this.adminService.proposeAdmin(req.user, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('admin-requests')
  listAdminRequests(@Req() req: any) {
    return this.adminService.listAdminRequests(req.user);
  }

  /** Co-sign (approve) or reject a pending admin-account proposal. Must be a different Super Admin than the proposer. */
  @Roles('SUPER_ADMIN')
  @Post('admin-requests/:id/decide')
  decideAdminRequest(@Param('id') id: string, @Body() body: { approve: boolean; notes?: string }, @Req() req: any) {
    return this.adminService.decideAdminRequest(req.user, id, body.approve, body.notes);
  }

  @Roles('SUPER_ADMIN', 'HELPER_ADMIN')
  @Get('registrations')
  pendingRegistrations(@Req() req: any) {
    return this.adminService.pendingRegistrations(req.user);
  }

  @Roles('SUPER_ADMIN', 'HELPER_ADMIN')
  @Post('registrations/:id/decide')
  decideRegistration(
    @Param('id') id: string,
    @Body()
    body: { approve: boolean; role?: UserRole; geoAreaId?: string; departmentId?: string; notes?: string },
    @Req() req: any,
  ) {
    return this.adminService.decideRegistration(
      req.user,
      id,
      body.approve,
      { role: body.role, geoAreaId: body.geoAreaId, departmentId: body.departmentId },
      body.notes,
    );
  }
}
