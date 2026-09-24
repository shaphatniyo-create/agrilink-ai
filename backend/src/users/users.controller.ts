import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.usersService.me(req.user);
  }

  @Roles(
    'SUPER_ADMIN',
    'CEO',
    'DAF',
    'CTO',
    'AGRICULTURE_MANAGER',
    'FINANCE_MANAGER',
    'PROVINCE_LEADER',
    'DISTRICT_LEADER',
    'SECTOR_LEADER',
    'CELL_LEADER',
    'VILLAGE_LEADER',
  )
  @Get()
  findAll(@Query('role') role?: UserRole, @Query('areaId') areaId?: string, @Req() req?: any) {
    return this.usersService.findAll(req.user, { role, areaId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Roles(
    'SUPER_ADMIN',
    'PROVINCE_LEADER',
    'DISTRICT_LEADER',
    'SECTOR_LEADER',
    'CELL_LEADER',
    'VILLAGE_LEADER',
  )
  @Post(':id/roles')
  assignRole(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.usersService.assignRole(req.user, id, body);
  }

  @Roles(
    'SUPER_ADMIN',
    'PROVINCE_LEADER',
    'DISTRICT_LEADER',
    'SECTOR_LEADER',
    'CELL_LEADER',
    'VILLAGE_LEADER',
  )
  @Post('roles/:roleAssignmentId/revoke')
  revokeRole(@Param('roleAssignmentId') roleAssignmentId: string, @Req() req: any) {
    return this.usersService.revokeRole(req.user, roleAssignmentId);
  }

  @Roles('SUPER_ADMIN', 'CUSTOMER_SUPPORT')
  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body('status') status: any, @Req() req: any) {
    return this.usersService.setStatus(req.user, id, status);
  }
}
