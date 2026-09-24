import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiAdvisoryService } from './ai-advisory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('ai-advisory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiAdvisoryController {
  constructor(private aiAdvisory: AiAdvisoryService) {}

  @Post('plant-doctor')
  diagnosePlant(@Body() body: any, @Req() req: any) {
    return this.aiAdvisory.diagnosePlant(req.user, body);
  }

  @Get('diagnoses')
  myDiagnoses(@Query('farmId') farmId: string | undefined, @Req() req: any) {
    return this.aiAdvisory.myDiagnoses(req.user, farmId);
  }

  @Get('weather-alerts')
  getWeatherAlerts(@Query('areaId') areaId: string) {
    return this.aiAdvisory.getWeatherAlerts(areaId);
  }

  /** Posting an alert is a monitoring/authority action, not open to every role. */
  @Roles('SUPER_ADMIN', 'AGRICULTURE_MANAGER', 'PROVINCE_LEADER', 'DISTRICT_LEADER')
  @Post('weather-alerts')
  postWeatherAlert(@Body() body: any, @Req() req: any) {
    return this.aiAdvisory.postWeatherAlert(req.user, body);
  }

  @Post('farm-plan')
  planFarm(@Body() body: any, @Req() req: any) {
    return this.aiAdvisory.planFarm(req.user, body);
  }

  @Post('financial-advice')
  financialAdvice(@Body('farmId') farmId: string, @Req() req: any) {
    return this.aiAdvisory.financialAdvice(req.user, farmId);
  }
}
