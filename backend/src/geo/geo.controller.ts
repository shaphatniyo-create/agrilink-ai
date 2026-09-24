import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GeoLevel } from '@prisma/client';
import { GeoService } from './geo.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Public } from '../common/decorators/roles.decorator';

@ApiTags('geography')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('geo')
export class GeoController {
  constructor(private geoService: GeoService) {}

  @Public()
  @Get('children')
  children(@Query('parentId') parentId?: string) {
    return this.geoService.children(parentId);
  }

  @Public()
  @Get('by-level/:level')
  byLevel(@Param('level') level: GeoLevel, @Query('activeOnly') activeOnly?: string) {
    return this.geoService.listByLevel(level, activeOnly === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.geoService.findOne(id);
  }

  @Get(':id/path')
  path(@Param('id') id: string) {
    return this.geoService.path(id);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.geoService.stats(id);
  }

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() body: any) {
    return this.geoService.create(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body('active') active: boolean,
    @Body('cascade') cascade: boolean,
    @Req() req: any,
  ) {
    return this.geoService.setActive(id, active, req.user.id, !!cascade);
  }
}
