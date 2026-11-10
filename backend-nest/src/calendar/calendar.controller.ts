import { Controller, Delete, Get, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CalendarFeedDto, CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Where the band's app is, as the calendar app reached it (behind Caddy, which serves https)
function requestOrigin(req: Request): string {
  const forwarded = req.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.protocol;
  return `${protocol}://${req.headers.host}`;
}

@Controller('api/calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  // The signed-in member's subscription token
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  async getFeed(): Promise<{ data: CalendarFeedDto }> {
    return { data: await this.calendarService.getFeed() };
  }

  @Post('feed')
  @UseGuards(JwtAuthGuard)
  async createFeed(): Promise<{ data: CalendarFeedDto }> {
    return { data: await this.calendarService.createFeed() };
  }

  @Delete('feed')
  @UseGuards(JwtAuthGuard)
  async removeFeed(): Promise<void> {
    await this.calendarService.removeFeed();
  }

  // Public: calendar apps fetch it with no session, the token in <token>.ics is the credential
  @Get(':file')
  async feed(
    @Param('file') file: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (!file.endsWith('.ics')) throw new NotFoundException('Calendar not found');
    const body = await this.calendarService.renderFeed(file.slice(0, -4), requestOrigin(req));
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="agenda.ics"');
    // Changes to the agenda should reach the next refresh, and the URL is a secret
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Robots-Tag', 'noindex');
    return body;
  }
}
