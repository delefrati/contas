import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

const TOKEN = 'A'.repeat(32);
const NOW = new Date('2026-11-09T12:00:00Z');
const ORIGIN = 'https://maverick.minhabanda.com';

describe('CalendarService', () => {
  let service: CalendarService;
  let prisma: {
    member: { findFirst: jest.Mock; update: jest.Mock };
    band: { findUnique: jest.Mock };
    event: { findMany: jest.Mock };
  };
  let logService: { log: jest.Mock };
  let requestContext: { getIdentity: jest.Mock; getBandId: jest.Mock; requireBandId: jest.Mock };

  beforeEach(async () => {
    prisma = {
      member: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      band: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Maverick',
          timeZone: 'America/Sao_Paulo',
          defaultEventMinutes: 120,
        }),
      },
      event: { findMany: jest.fn().mockResolvedValue([]) },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };
    requestContext = {
      getIdentity: jest.fn().mockReturnValue({ memberId: 3 }),
      getBandId: jest.fn().mockReturnValue(1),
      requireBandId: jest.fn().mockReturnValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: RequestContextService, useValue: requestContext },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  describe('getFeed', () => {
    it("should return the member's token, looked up in the current band only", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 3, calendarToken: TOKEN });

      expect(await service.getFeed()).toEqual({ token: TOKEN });
      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: { id: 3, bandId: 1, active: true },
        select: { id: true, calendarToken: true },
      });
    });

    it('should return no token before the member asks for one', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 3, calendarToken: null });
      expect(await service.getFeed()).toEqual({ token: null });
    });

    it('should refuse super admins, who are not members of the band', async () => {
      requestContext.getIdentity.mockReturnValue({ superAdminId: 1 });
      await expect(service.getFeed()).rejects.toThrow(BadRequestException);
      expect(prisma.member.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('createFeed', () => {
    it('should store a new random token and log it without the token', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 3, calendarToken: null });

      const { token } = await service.createFeed();

      expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(prisma.member.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { calendarToken: token } });
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'calendar_feed', 3);
    });

    it('should replace an existing token', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 3, calendarToken: TOKEN });

      const { token } = await service.createFeed();

      expect(token).not.toBe(TOKEN);
      expect(logService.log).toHaveBeenCalledWith('UPDATE', 'calendar_feed', 3);
    });

    it('should refuse a member of another band', async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.createFeed()).rejects.toThrow(NotFoundException);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });
  });

  describe('removeFeed', () => {
    it('should clear the token', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 3, calendarToken: TOKEN });

      await service.removeFeed();

      expect(prisma.member.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { calendarToken: null } });
      expect(logService.log).toHaveBeenCalledWith('DELETE', 'calendar_feed', 3);
    });

    it('should do nothing when there is no token', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 3, calendarToken: null });

      await service.removeFeed();

      expect(prisma.member.update).not.toHaveBeenCalled();
      expect(logService.log).not.toHaveBeenCalled();
    });
  });

  describe('renderFeed', () => {
    const show = { id: 1, name: 'Show' };

    beforeEach(() => {
      prisma.member.findFirst.mockResolvedValue({ id: 3 });
    });

    it("should only accept the token of an active member of the host's band", async () => {
      await service.renderFeed(TOKEN, ORIGIN, NOW);

      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: { calendarToken: TOKEN, bandId: 1, active: true },
        select: { id: true },
      });
    });

    it('should list the band events of the last year onward, without deleted ones', async () => {
      await service.renderFeed(TOKEN, ORIGIN, NOW);

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bandId: 1, deletedAt: null, date: { gte: '2025-11-09' } } }),
      );
    });

    it('should turn events into calendar entries linking back to the app', async () => {
      prisma.event.findMany.mockResolvedValue([
        {
          id: 7, date: '2026-11-20', time: '21:00', endTime: '', title: 'Bar do Zé',
          location: 'Centro', notes: 'Levar cabos', type: show,
        },
        { id: 8, date: '2026-11-22', time: '', endTime: '', title: '', location: null, notes: null, type: show },
      ]);

      const ics = (await service.renderFeed(TOKEN, ORIGIN, NOW)).replace(/\r\n /g, '');

      expect(ics).toContain('X-WR-CALNAME:Maverick');
      expect(ics).toContain('UID:event-7@maverick.minhabanda.com');
      expect(ics).toContain('SUMMARY:Show: Bar do Zé');
      expect(ics).toContain('DTSTART:20261121T000000Z');
      expect(ics).toContain('DTEND:20261121T020000Z');
      expect(ics).toContain('DESCRIPTION:Levar cabos\\n\\nhttps://maverick.minhabanda.com/agenda/7');
      // Untitled events are named after their type
      expect(ics).toContain('SUMMARY:Show\r\n');
      expect(ics).toContain('DTSTART;VALUE=DATE:20261122');
    });

    it('should refuse an unknown token', async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.renderFeed(TOKEN, ORIGIN, NOW)).rejects.toThrow(NotFoundException);
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    it('should not even look up a malformed token', async () => {
      await expect(service.renderFeed('short', ORIGIN, NOW)).rejects.toThrow(NotFoundException);
      expect(prisma.member.findFirst).not.toHaveBeenCalled();
    });

    it('should refuse when the host has no active band', async () => {
      requestContext.getBandId.mockReturnValue(undefined);
      await expect(service.renderFeed(TOKEN, ORIGIN, NOW)).rejects.toThrow(NotFoundException);
      expect(prisma.member.findFirst).not.toHaveBeenCalled();
    });
  });
});
