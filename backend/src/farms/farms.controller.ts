import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FarmsService } from './farms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('farms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('farms')
export class FarmsController {
  constructor(private farmsService: FarmsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.farmsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.farmsService.findOne(id, req.user);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.farmsService.create(body, req.user);
  }

  @Post(':id/crops')
  addFarmCrop(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.farmsService.addFarmCrop(id, body, req.user);
  }

  @Patch('crops/:farmCropId')
  updateFarmCrop(@Param('farmCropId') farmCropId: string, @Body() body: any, @Req() req: any) {
    return this.farmsService.updateFarmCrop(farmCropId, body, req.user);
  }

  @Get(':id/zones')
  listZones(@Param('id') id: string, @Req() req: any) {
    return this.farmsService.listZones(id, req.user);
  }

  @Post(':id/zones')
  addZone(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.farmsService.addZone(id, body, req.user);
  }

  @Post('zones/:zoneId/delete')
  deleteZone(@Param('zoneId') zoneId: string, @Req() req: any) {
    return this.farmsService.deleteZone(zoneId, req.user);
  }
}
