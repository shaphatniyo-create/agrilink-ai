import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgChartService } from './orgchart.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('org-chart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('org-chart')
export class OrgChartController {
  constructor(private orgChartService: OrgChartService) {}

  @Get('departments')
  departments() {
    return this.orgChartService.departmentTree();
  }

  @Get('root')
  root() {
    return this.orgChartService.root();
  }

  @Get('node/:areaId')
  node(@Param('areaId') areaId: string) {
    return this.orgChartService.node(areaId);
  }
}
