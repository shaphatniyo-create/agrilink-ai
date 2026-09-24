import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  listPlans() {
    return this.subscriptionsService.listPlans();
  }

  @Roles('SUPER_ADMIN', 'DAF')
  @Post('plans')
  createPlan(@Body() body: any) {
    return this.subscriptionsService.createPlan(body);
  }

  @Roles('SUPER_ADMIN', 'DAF')
  @Post('plans/:id/features')
  setFeature(@Param('id') id: string, @Body() body: any) {
    return this.subscriptionsService.setFeature(id, body);
  }

  @Post('subscribe/:planId')
  subscribe(
    @Param('planId') planId: string,
    @Body() body: { providerCode?: string; methodId?: string } = {},
    @Req() req: any,
  ) {
    return this.subscriptionsService.subscribe(req.user, planId, body);
  }

  @Get('mine')
  mine(@Req() req: any) {
    return this.subscriptionsService.mySubscriptions(req.user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.subscriptionsService.cancel(req.user, id);
  }
}
