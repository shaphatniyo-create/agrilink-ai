import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('transport')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transport')
export class TransportController {
  constructor(private transportService: TransportService) {}

  @Roles('TRANSPORTER')
  @Post('vehicles')
  registerVehicle(@Body() body: any, @Req() req: any) {
    return this.transportService.registerVehicle(req.user, body);
  }

  @Roles('TRANSPORTER')
  @Get('vehicles/mine')
  myVehicles(@Req() req: any) {
    return this.transportService.myVehicles(req.user);
  }

  @Get('fee-config')
  listFeeConfig() {
    return this.transportService.listFeeConfig();
  }

  @Roles('SUPER_ADMIN', 'DAF')
  @Post('fee-config')
  upsertFeeConfig(@Body() body: any) {
    return this.transportService.upsertFeeConfig(body);
  }

  @Post('requests')
  createRequest(@Body() body: any, @Req() req: any) {
    return this.transportService.createRequest(req.user, body);
  }

  @Roles('TRANSPORTER')
  @Get('requests/available')
  availableJobs() {
    return this.transportService.availableJobs();
  }

  @Roles('TRANSPORTER')
  @Post('requests/:id/quote')
  submitQuote(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.transportService.submitQuote(req.user, id, body);
  }

  @Post('quotes/:id/accept')
  acceptQuote(@Param('id') id: string, @Req() req: any) {
    return this.transportService.acceptQuote(id, req.user);
  }

  @Patch('requests/:id/status')
  updateRequestStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    return this.transportService.updateRequestStatus(id, status, req.user);
  }

  @Roles('TRANSPORTER')
  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.transportService.transporterDashboard(req.user);
  }
}
