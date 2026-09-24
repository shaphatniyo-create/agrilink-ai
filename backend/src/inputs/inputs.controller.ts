import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InputsService } from './inputs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('input-suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inputs')
export class InputsController {
  constructor(private inputsService: InputsService) {}

  @Get('products')
  listProducts(@Query('category') category?: any) {
    return this.inputsService.listProducts(category);
  }

  @Roles('SUPPLIER', 'SUPER_ADMIN')
  @Post('products')
  createProduct(@Body() body: any, @Req() req: any) {
    return this.inputsService.createProduct(req.user, body);
  }

  @Post('orders')
  createOrder(@Body() body: any, @Req() req: any) {
    return this.inputsService.createOrder(req.user, body);
  }

  @Get('orders/mine')
  myOrders(@Req() req: any) {
    return this.inputsService.myOrders(req.user);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    return this.inputsService.updateOrderStatus(id, status, req.user);
  }
}
