import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoScopeService, HQ_ROLES } from '../common/geo-scope.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class CommunicationService {
  constructor(
    private prisma: PrismaService,
    private geoScope: GeoScopeService,
  ) {}

  /**
   * Communication hierarchy: HQ -> Province -> District -> Sector -> Cell ->
   * Village. A leader may create/post to a channel at their own geo level or
   * any level below it within their jurisdiction (e.g. a District Leader can
   * reach their Sector/Cell/Village channels); a Village Leader cannot reach
   * up to Province/HQ or across to another village. HQ roles reach everything.
   */
  private async canManageChannel(user: AuthenticatedUser, channel: { type: string; areaId: string | null; departmentId: string | null }): Promise<boolean> {
    if (user.roleNames.some((r) => HQ_ROLES.includes(r))) return true;
    if (channel.type === 'HQ') return false;
    if (channel.type === 'DEPARTMENT') {
      return user.roles.some((r) => r.departmentId === channel.departmentId);
    }
    if (channel.areaId) return this.geoScope.canAccessArea(user, channel.areaId);
    return false;
  }

  async listMyChannels(user: AuthenticatedUser) {
    return this.prisma.channel.findMany({
      where: { members: { some: { userId: user.id } } },
      include: { area: true, department: true, _count: { select: { members: true, messages: true } } },
    });
  }

  async createChannel(user: AuthenticatedUser, data: { type: any; areaId?: string; departmentId?: string; name: string }) {
    const allowed = await this.canManageChannel(user, {
      type: data.type,
      areaId: data.areaId ?? null,
      departmentId: data.departmentId ?? null,
    });
    if (!allowed) throw new ForbiddenException('You cannot create a channel at this level.');
    const channel = await this.prisma.channel.create({
      data: { ...data, createdById: user.id },
    });
    await this.prisma.channelMember.create({ data: { channelId: channel.id, userId: user.id, isAdmin: true } });
    return channel;
  }

  async joinChannel(user: AuthenticatedUser, channelId: string) {
    return this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId: user.id } },
      create: { channelId, userId: user.id },
      update: {},
    });
  }

  async sendMessage(user: AuthenticatedUser, channelId: string, body: string, attachments?: unknown) {
    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this channel.');
    return this.prisma.message.create({ data: { channelId, senderId: user.id, body, attachments: attachments as any } });
  }

  channelMessages(channelId: string) {
    return this.prisma.message.findMany({
      where: { channelId },
      include: { sender: true },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
  }

  /** Announcements (incl. EMERGENCY agricultural alerts) - only channel managers/HQ per canManageChannel. */
  async publishAnnouncement(
    user: AuthenticatedUser,
    channelId: string,
    data: { title: string; body: string; priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY'; expiresAt?: Date },
  ) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found.');
    const allowed = await this.canManageChannel(user, channel);
    if (!allowed) throw new ForbiddenException('You cannot broadcast to this channel.');

    const announcement = await this.prisma.announcement.create({
      data: { channelId, ...data, publishedById: user.id },
    });

    // Fan out a Notification to every member of the channel.
    const members = await this.prisma.channelMember.findMany({ where: { channelId } });
    await this.prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: 'ANNOUNCEMENT',
        title: data.title,
        body: data.body,
      })),
    });
    return announcement;
  }

  myNotifications(user: AuthenticatedUser, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, read: unreadOnly ? false : undefined },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif || notif.userId !== user.id) throw new NotFoundException('Notification not found.');
    return this.prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
  }
}
