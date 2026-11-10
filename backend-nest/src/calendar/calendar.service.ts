import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';
import { addDays, buildCalendar } from './ics';

// 24 random bytes, as base64url
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

// Older events drop out of the feed, and so out of subscribed calendars
const PAST_DAYS = 365;

export class CalendarFeedDto {
  // null until the member asks for a link
  token!: string | null;
}

// Each member can subscribe to the band's agenda from their own calendar app. Calendar apps
// can't sign in, so the URL carries a secret token instead; it only works on the member's
// band, and stops working when they are disabled or ask for a new one.
@Injectable()
export class CalendarService {
  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private requestContext: RequestContextService,
  ) {}

  // Super admins aren't members of the band, so they have no feed of their own
  private requireMemberId(): number {
    const { memberId } = this.requestContext.getIdentity();
    if (!memberId) {
      throw new BadRequestException('Only band members can subscribe to the agenda');
    }
    return memberId;
  }

  private async findMember(memberId: number): Promise<{ id: number; calendarToken: string | null }> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, bandId: this.requestContext.requireBandId(), active: true },
      select: { id: true, calendarToken: true },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async getFeed(): Promise<CalendarFeedDto> {
    const member = await this.findMember(this.requireMemberId());
    return { token: member.calendarToken };
  }

  // Replaces any previous token, so links given out before stop working
  async createFeed(): Promise<CalendarFeedDto> {
    const member = await this.findMember(this.requireMemberId());
    const token = randomBytes(24).toString('base64url');
    await this.prisma.member.update({ where: { id: member.id }, data: { calendarToken: token } });
    await this.logService.log(member.calendarToken ? 'UPDATE' : 'CREATE', 'calendar_feed', member.id);
    return { token };
  }

  async removeFeed(): Promise<void> {
    const member = await this.findMember(this.requireMemberId());
    if (!member.calendarToken) return;
    await this.prisma.member.update({ where: { id: member.id }, data: { calendarToken: null } });
    await this.logService.log('DELETE', 'calendar_feed', member.id);
  }

  // The .ics a calendar app downloads. origin is where the band's app is, for links back to events.
  async renderFeed(token: string, origin: string, now = new Date()): Promise<string> {
    // Disabled bands resolve to no band at all, so their feeds stop too
    const bandId = this.requestContext.getBandId();
    const member =
      bandId && TOKEN_PATTERN.test(token)
        ? await this.prisma.member.findFirst({
            where: { calendarToken: token, bandId, active: true },
            select: { id: true },
          })
        : null;
    if (!member) throw new NotFoundException('Calendar not found');

    const band = await this.prisma.band.findUnique({
      where: { id: bandId },
      select: { name: true, timeZone: true, defaultEventMinutes: true },
    });
    if (!band) throw new NotFoundException('Calendar not found');

    const events = await this.prisma.event.findMany({
      where: {
        bandId,
        deletedAt: null,
        date: { gte: addDays(now.toISOString().slice(0, 10), -PAST_DAYS) },
      },
      include: { type: true },
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }],
    });

    const host = new URL(origin).hostname;
    return buildCalendar({
      name: band.name,
      timeZone: band.timeZone,
      defaultEventMinutes: band.defaultEventMinutes,
      now,
      events: events.map((event) => ({
        // Event ids are unique across bands, the host keeps them apart from other sites
        uid: `event-${event.id}@${host}`,
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        summary: event.title ? `${event.type.name}: ${event.title}` : event.type.name,
        location: event.location,
        description: [event.notes, `${origin}/agenda/${event.id}`].filter(Boolean).join('\n\n'),
        categories: event.type.name,
        url: `${origin}/agenda/${event.id}`,
      })),
    });
  }
}
