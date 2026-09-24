import { Module } from '@nestjs/common';
import { OrgChartService } from './orgchart.service';
import { OrgChartController } from './orgchart.controller';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [GeoModule],
  providers: [OrgChartService],
  controllers: [OrgChartController],
})
export class OrgChartModule {}
