import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServiceType, CommissionTxStatus } from '@prisma/client';
import { CommissionsService } from './commissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commissions')
export class CommissionsController {
  constructor(private commissionsService: CommissionsService) {}

  @Roles('SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER')
  @Get('rules')
  listRules(@Query('serviceType') serviceType?: ServiceType) {
    return this.commissionsService.listRules(serviceType);
  }

  @Roles('SUPER_ADMIN', 'DAF')
  @Post('rules')
  createRule(@Body() body: any, @Req() req: any) {
    return this.commissionsService.createRule(body, req.user.id);
  }

  @Roles('SUPER_ADMIN', 'DAF')
  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.commissionsService.updateRule(id, body, req.user.id);
  }

  @Roles('SUPER_ADMIN', 'CEO', 'DAF')
  @Patch('rules/:id/approve')
  approveRule(@Param('id') id: string, @Req() req: any) {
    return this.commissionsService.approveRule(id, req.user.id);
  }

  @Roles('SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER')
  @Get('ledger')
  ledger(@Query('status') status?: CommissionTxStatus) {
    return this.commissionsService.ledger({ status });
  }
}
