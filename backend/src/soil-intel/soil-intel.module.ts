import { Module } from '@nestjs/common';
import { FarmsModule } from '../farms/farms.module';
import { SoilIntelService } from './soil-intel.service';
import { SoilIntelController } from './soil-intel.controller';

@Module({
  imports: [FarmsModule],
  providers: [SoilIntelService],
  controllers: [SoilIntelController],
})
export class SoilIntelModule {}
