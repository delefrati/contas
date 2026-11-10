import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

describe('CalendarController', () => {
  let controller: CalendarController;
  let calendarService: { renderFeed: jest.Mock };
  let res: { setHeader: jest.Mock };

  function request(headers: Record<string, string>) {
    return { headers, protocol: 'http' } as never;
  }

  beforeEach(async () => {
    calendarService = { renderFeed: jest.fn().mockResolvedValue('BEGIN:VCALENDAR\r\n') };
    res = { setHeader: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [{ provide: CalendarService, useValue: calendarService }],
    }).compile();

    controller = module.get<CalendarController>(CalendarController);
  });

  it('should serve the feed as text/calendar, with links on the https host Caddy was reached on', async () => {
    const body = await controller.feed(
      'abc.ics',
      request({ host: 'maverick.minhabanda.com', 'x-forwarded-proto': 'https' }),
      res as never,
    );

    expect(calendarService.renderFeed).toHaveBeenCalledWith('abc', 'https://maverick.minhabanda.com');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/calendar; charset=utf-8');
    expect(body).toBe('BEGIN:VCALENDAR\r\n');
  });

  it('should fall back to the request protocol without a proxy', async () => {
    await controller.feed('abc.ics', request({ host: 'localhost:8001' }), res as never);
    expect(calendarService.renderFeed).toHaveBeenCalledWith('abc', 'http://localhost:8001');
  });

  it('should only answer .ics paths', async () => {
    await expect(controller.feed('abc', request({ host: 'x' }), res as never)).rejects.toThrow(NotFoundException);
    expect(calendarService.renderFeed).not.toHaveBeenCalled();
  });
});
