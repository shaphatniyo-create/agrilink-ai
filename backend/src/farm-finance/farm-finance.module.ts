import { Module } from '@nestjs/common';
import { FarmFinanceService } from './farm-finance.service';
import { FarmFinanceController } from './farm-finance.controller';
import { FarmsModule } from '../farms/farms.module';

@Module({
  imports: [FarmsModule],
  providers: [FarmFinanceService],
  controllers: [FarmFinanceController],
  exports: [FarmFinanceService],
})
export class FarmFinanceModule {}
