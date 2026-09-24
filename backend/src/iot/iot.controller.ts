import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IotService } from './iot.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/roles.decorator';

@ApiTags('iot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('iot')
export class IotController {
  constructor(private iot: IotService) {}

  /**
   * Public by design: this is what the ESP32 firmware calls, over WiFi or a
   * GSM/SIM data connection -- there's no human to log in. Each device
   * authenticates itself with the per-device secret issued at registration
   * (see POST /iot/devices), checked inside IotService#ingest, not a JWT.
   */
  @Public()
  @Post('ingest')
  ingest(@Body() body: any) {
    return this.iot.ingest(body);
  }

  @Post('devices')
  registerDevice(@Body() body: { farmId: string; label?: string }, @Req() req: any) {
    return this.iot.registerDevice(body.farmId, { label: body.label }, req.user);
  }

  @Get('devices')
  listDevices(@Query('farmId') farmId: string, @Req() req: any) {
    return this.iot.listDevices(farmId, req.user);
  }

  @Post('devices/:deviceId/deactivate')
  deactivateDevice(@Param('deviceId') deviceId: string, @Req() req: any) {
    return this.iot.deactivateDevice(deviceId, req.user);
  }

  @Post('devices/:deviceId/pump')
  setPumpMode(@Param('deviceId') deviceId: string, @Body('pumpMode') pumpMode: string, @Req() req: any) {
    return this.iot.setPumpMode(deviceId, pumpMode, req.user);
  }

  @Get('farms/:farmId/latest')
  latest(@Param('farmId') farmId: string, @Req() req: any) {
    return this.iot.latest(farmId, req.user);
  }

  @Get('farms/:farmId/history')
  history(@Param('farmId') farmId: string, @Query('limit') limit: string, @Req() req: any) {
    return this.iot.history(farmId, req.user, limit ? Number(limit) : undefined);
  }

  @Get('farms/:farmId/alerts')
  listAlerts(@Param('farmId') farmId: string, @Req() req: any) {
    return this.iot.listAlerts(farmId, req.user);
  }

  @Post('alerts/:alertId/resolve')
  resolveAlert(@Param('alertId') alertId: string, @Req() req: any) {
    return this.iot.resolveAlert(alertId, req.user);
  }

  @Get('farms/:farmId/ai-analysis')
  aiAnalysis(@Param('farmId') farmId: string, @Req() req: any) {
    return this.iot.aiAnalysis(farmId, req.user);
  }
}
