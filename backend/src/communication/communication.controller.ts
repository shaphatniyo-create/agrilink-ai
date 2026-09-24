import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('communication')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('communication')
export class CommunicationController {
  constructor(private communicationService: CommunicationService) {}

  @Get('channels/mine')
  myChannels(@Req() req: any) {
    return this.communicationService.listMyChannels(req.user);
  }

  @Post('channels')
  createChannel(@Body() body: any, @Req() req: any) {
    return this.communicationService.createChannel(req.user, body);
  }

  @Post('channels/:id/join')
  joinChannel(@Param('id') id: string, @Req() req: any) {
    return this.communicationService.joinChannel(req.user, id);
  }

  @Get('channels/:id/messages')
  messages(@Param('id') id: string) {
    return this.communicationService.channelMessages(id);
  }

  @Post('channels/:id/messages')
  sendMessage(@Param('id') id: string, @Body('body') body: string, @Req() req: any) {
    return this.communicationService.sendMessage(req.user, id, body);
  }

  @Post('channels/:id/announcements')
  publishAnnouncement(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.communicationService.publishAnnouncement(req.user, id, body);
  }

  @Get('notifications')
  notifications(@Req() req: any) {
    return this.communicationService.myNotifications(req.user);
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.communicationService.markRead(req.user, id);
  }
}
