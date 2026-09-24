import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdvertisingService } from './advertising.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('advertising')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('advertising')
export class AdvertisingController {
  constructor(private advertisingService: AdvertisingService) {}

  @Roles('MARKETING_PARTNER', 'B2B_CLIENT', 'SUPPLIER', 'BUYER', 'SUPER_ADMIN')
  @Post('campaigns')
  createCampaign(@Body() body: any, @Req() req: any) {
    return this.advertisingService.createCampaign(req.user, body);
  }

  @Roles('SUPER_ADMIN', 'MARKETING_PARTNER')
  @Patch('campaigns/:id/approve')
  approve(@Param('id') id: string, @Body('approve') approve: boolean) {
    return this.advertisingService.approve(id, approve);
  }

  @Get('campaigns/mine')
  myCampaigns(@Req() req: any) {
    return this.advertisingService.myCampaigns(req.user);
  }

  @Get('placements')
  placements(@Query('placementType') placementType?: string) {
    return this.advertisingService.activePlacements(placementType);
  }

  @Post('campaigns/:id/impression')
  impression(@Param('id') id: string) {
    return this.advertisingService.recordImpression(id);
  }

  @Post('campaigns/:id/click')
  click(@Param('id') id: string) {
    return this.advertisingService.recordClick(id);
  }

  @Get('campaigns/:id/performance')
  performance(@Param('id') id: string, @Req() req: any) {
    return this.advertisingService.campaignPerformance(id, req.user);
  }
}
