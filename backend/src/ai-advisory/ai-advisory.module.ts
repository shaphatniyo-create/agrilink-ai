import { Module } from '@nestjs/common';
import { AiAdvisoryService } from './ai-advisory.service';
import { AiAdvisoryController } from './ai-advisory.controller';
import { PlantDoctorEngine } from './plant-doctor-engine';
import { FarmsModule } from '../farms/farms.module';
import { FarmFinanceModule } from '../farm-finance/farm-finance.module';

@Module({
  imports: [FarmsModule, FarmFinanceModule],
  providers: [AiAdvisoryService, PlantDoctorEngine],
  controllers: [AiAdvisoryController],
  exports: [AiAdvisoryService],
})
export class AiAdvisoryModule {}
