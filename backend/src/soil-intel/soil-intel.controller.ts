import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SoilIntelService } from './soil-intel.service';

/**
 * Soil intelligence: ESP32 reading -> reference soil (SoilGrids / RwaSIS)
 * -> crop requirements -> comparison engine -> stored AI recommendation.
 */
@ApiTags('soil-intel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('soil-intel')
export class SoilIntelController {
  constructor(private soil: SoilIntelService) {}

  /** Run the comparison engine for a farm (optionally for a specific crop) and store the result. */
  @Post('farms/:farmId/analyze')
  analyze(@Param('farmId') farmId: string, @Body() body: { cropId?: string }, @Req() req: any) {
    return this.soil.analyze(farmId, req.user, body?.cropId || undefined);
  }

  /** Past recommendations for a farm, newest first. */
  @Get('farms/:farmId/recommendations')
  history(@Param('farmId') farmId: string, @Query('limit') limit: string, @Req() req: any) {
    return this.soil.history(farmId, req.user, limit ? Number(limit) : 10);
  }

  /** Reference soil properties at a point (cached; fetched from ISRIC SoilGrids on first use). */
  @Get('reference')
  reference(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.soil.referenceAt(Number(lat), Number(lng));
  }

  /** Crop soil requirements, fertilizer options and lime bands, with sources. */
  @Get('crops')
  crops() {
    return this.soil.cropRequirements();
  }
}
