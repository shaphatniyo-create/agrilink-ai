import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Public } from '../common/decorators/roles.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('providers')
  listProviders() {
    return this.paymentsService.listProviders();
  }

  @UseGuards(JwtAuthGuard)
  @Post('methods')
  addMethod(@Body() body: any, @Req() req: any) {
    return this.paymentsService.addMethod(req.user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('methods/mine')
  myMethods(@Req() req: any) {
    return this.paymentsService.myMethods(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  initiate(@Body() body: any, @Req() req: any) {
    return this.paymentsService.initiate(req.user, body);
  }

  // Provider webhooks are called by the payment gateway, not a logged-in user.
  @Public()
  @Post('webhooks/:providerCode')
  webhook(@Param('providerCode') providerCode: string, @Body() body: any) {
    return this.paymentsService.handleWebhook(providerCode, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER')
  @Post(':id/refund')
  refund(@Param('id') id: string, @Body('amount') amount: number, @Body('reason') reason: string) {
    return this.paymentsService.refund(id, amount, reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER')
  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Body('amount') amount: number, @Body('reason') reason: string) {
    return this.paymentsService.reverse(id, amount, reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER')
  @Get('transactions')
  listTransactions(@Query('status') status?: any) {
    return this.paymentsService.listTransactions({ status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'DAF', 'FINANCE_MANAGER')
  @Post('reconcile')
  reconcile(
    @Body('providerCode') providerCode: string,
    @Body('date') date: string,
    @Body('providerTotal') providerTotal: number,
  ) {
    return this.paymentsService.reconcile(providerCode, new Date(date), providerTotal);
  }
}
