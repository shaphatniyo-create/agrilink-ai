import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  @Get('listings')
  listListings(
    @Query('cropId') cropId?: string,
    @Query('areaId') areaId?: string,
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.listListings({ cropId, areaId, status });
  }

  @Get('listings/:id')
  getListing(@Param('id') id: string) {
    return this.marketplaceService.getListing(id);
  }

  @Post('listings')
  createListing(@Body() body: any, @Req() req: any) {
    return this.marketplaceService.createListing(req.user, body);
  }

  @Patch('listings/:id')
  updateListing(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.marketplaceService.updateListing(id, req.user, body);
  }

  @Post('orders')
  createOrder(@Body() body: any, @Req() req: any) {
    return this.marketplaceService.createOrder(req.user, body);
  }

  @Get('orders/mine')
  myOrders(@Req() req: any) {
    return this.marketplaceService.myOrders(req.user);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    return this.marketplaceService.updateOrderStatus(id, status, req.user);
  }
}
