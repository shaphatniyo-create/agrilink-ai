import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CropsService } from './crops.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('crops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crops')
export class CropsController {
  constructor(private cropsService: CropsService) {}

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.cropsService.findAll(activeOnly === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cropsService.findOne(id);
  }

  @Roles('SUPER_ADMIN', 'AGRICULTURE_MANAGER')
  @Post()
  create(@Body() body: any) {
    return this.cropsService.create(body);
  }

  @Roles('SUPER_ADMIN', 'AGRICULTURE_MANAGER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.cropsService.update(id, body);
  }

  @Roles('SUPER_ADMIN', 'AGRICULTURE_MANAGER')
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body('active') active: boolean, @Req() req: any) {
    return this.cropsService.setActive(id, active, req.user.id);
  }
}
