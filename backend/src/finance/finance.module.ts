import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { DafDashboardService } from './daf-dashboard.service';
import { FinanceController } from './finance.controller';

@Module({
  providers: [ExpensesService, DafDashboardService],
  controllers: [FinanceController],
  exports: [ExpensesService, DafDashboardService],
})
export class FinanceModule {}
