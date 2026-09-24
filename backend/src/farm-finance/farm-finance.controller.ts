import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FarmFinanceService } from './farm-finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('farm-finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('farm-finance')
export class FarmFinanceController {
  constructor(private farmFinance: FarmFinanceService) {}

  @Get(':farmId/summary')
  summary(@Param('farmId') farmId: string, @Req() req: any) {
    return this.farmFinance.summary(farmId, req.user);
  }

  @Get(':farmId/expenses')
  listExpenses(@Param('farmId') farmId: string, @Req() req: any) {
    return this.farmFinance.listExpenses(farmId, req.user);
  }

  @Post(':farmId/expenses')
  recordExpense(@Param('farmId') farmId: string, @Body() body: any, @Req() req: any) {
    return this.farmFinance.recordExpense(farmId, body, req.user);
  }

  @Get(':farmId/income')
  listIncome(@Param('farmId') farmId: string, @Req() req: any) {
    return this.farmFinance.listIncome(farmId, req.user);
  }

  @Post(':farmId/income')
  recordIncome(@Param('farmId') farmId: string, @Body() body: any, @Req() req: any) {
    return this.farmFinance.recordIncome(farmId, body, req.user);
  }

  /**
   * Dependency-free CSV download. (PDF export is handled client-side as a
   * printable report page -- see frontend/src/pages/AiAdvisory.tsx /
   * FarmFinance section -- using the browser's native print-to-PDF, which
   * needs no extra backend library to produce a real, shareable PDF.)
   */
  @Get(':farmId/export.csv')
  async exportCsv(@Param('farmId') farmId: string, @Req() req: any, @Res() res: Response) {
    const csv = await this.farmFinance.exportCsv(farmId, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="farm-${farmId}-ledger.csv"`);
    res.send(csv);
  }
}
