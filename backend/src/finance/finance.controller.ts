import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { DafDashboardService } from './daf-dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER', 'CEO')
@Controller('finance')
export class FinanceController {
  constructor(
    private expensesService: ExpensesService,
    private dafDashboardService: DafDashboardService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.dafDashboardService.overview();
  }

  @Get('dashboard/by-area/:level')
  byArea(@Param('level') level: 'PROVINCE' | 'DISTRICT') {
    return this.dafDashboardService.revenueByArea(level);
  }

  @Get('expenses')
  listExpenses(@Query('category') category?: any, @Query('status') status?: any) {
    return this.expensesService.list({ category, status });
  }

  @Post('expenses')
  createExpense(@Body() body: any, @Req() req: any) {
    return this.expensesService.create(req.user, body);
  }

  @Patch('expenses/:id/approve')
  approveExpense(@Param('id') id: string, @Body('approve') approve: boolean, @Req() req: any) {
    return this.expensesService.approve(id, req.user.id, approve);
  }

  @Patch('expenses/:id/paid')
  markPaid(@Param('id') id: string) {
    return this.expensesService.markPaid(id);
  }
}
