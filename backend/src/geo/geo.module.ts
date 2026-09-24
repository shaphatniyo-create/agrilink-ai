import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [GeoService],
  controllers: [GeoController],
  exports: [GeoService],
})
export class GeoModule {}
