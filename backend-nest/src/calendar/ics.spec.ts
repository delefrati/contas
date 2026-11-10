import { addDays, buildCalendar, escapeText, foldLine, IcsEvent, zonedTimeToUtc } from './ics';

const NOW = new Date('2026-11-09T12:00:00Z');

function feed(events: Partial<IcsEvent>[], options: { timeZone?: string; defaultEventMinutes?: number } = {}) {
  return buildCalendar({
    name: 'Maverick',
    timeZone: options.timeZone ?? 'America/Sao_Paulo',
    defaultEventMinutes: options.defaultEventMinutes ?? 120,
    now: NOW,
    events: events.map((event, index) => ({
      uid: `event-${index + 1}@maverick.minhabanda.com`,
      date: '2026-11-20',
      time: '',
      endTime: '',
      summary: 'Show',
      ...event,
    })),
  });
}

// Unfolded lines of the one event in the feed
function eventLines(ics: string): string[] {
  const lines = ics.replace(/\r\n /g, '').split('\r\n');
  return lines.slice(lines.indexOf('BEGIN:VEVENT') + 1, lines.indexOf('END:VEVENT'));
}

describe('ics', () => {
  describe('zonedTimeToUtc', () => {
    it('should convert São Paulo time (UTC-3, no daylight saving) to UTC', () => {
      expect(zonedTimeToUtc('2026-11-20', '21:00', 'America/Sao_Paulo').toISOString()).toBe(
        '2026-11-21T00:00:00.000Z',
      );
    });

    it('should follow daylight saving in zones that have it', () => {
      // Lisbon is UTC+0 in winter and UTC+1 in summer
      expect(zonedTimeToUtc('2026-01-15', '21:00', 'Europe/Lisbon').toISOString()).toBe('2026-01-15T21:00:00.000Z');
      expect(zonedTimeToUtc('2026-07-15', '21:00', 'Europe/Lisbon').toISOString()).toBe('2026-07-15T20:00:00.000Z');
    });

    it('should handle zones ahead of UTC', () => {
      expect(zonedTimeToUtc('2026-11-20', '08:30', 'Asia/Tokyo').toISOString()).toBe('2026-11-19T23:30:00.000Z');
    });
  });

  describe('addDays', () => {
    it('should cross month and year ends', () => {
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
  });

  describe('escapeText', () => {
    it('should escape the characters iCalendar reserves', () => {
      expect(escapeText('Rock, Pop; Blues\\Jazz\nnext line')).toBe('Rock\\, Pop\\; Blues\\\\Jazz\\nnext line');
    });
  });

  describe('foldLine', () => {
    it('should leave short lines alone', () => {
      expect(foldLine('SUMMARY:Show')).toBe('SUMMARY:Show');
    });

    it('should fold at 75 octets without splitting multi-byte characters', () => {
      const line = `DESCRIPTION:${'ção'.repeat(40)}`;
      const folded = foldLine(line);

      for (const piece of folded.split('\r\n')) {
        expect(Buffer.byteLength(piece, 'utf8')).toBeLessThanOrEqual(75);
      }
      expect(folded.replace(/\r\n /g, '')).toBe(line);
    });
  });

  describe('buildCalendar', () => {
    it('should name the calendar and use CRLF line endings', () => {
      const ics = feed([]);

      expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
      expect(ics).toContain('X-WR-CALNAME:Maverick\r\n');
      expect(ics).toContain('X-WR-TIMEZONE:America/Sao_Paulo\r\n');
      expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
      expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    });

    it('should make events without a time last the whole day', () => {
      const lines = eventLines(feed([{ date: '2026-11-30' }]));

      expect(lines).toContain('DTSTART;VALUE=DATE:20261130');
      expect(lines).toContain('DTEND;VALUE=DATE:20261201');
    });

    it('should give the start and end in UTC', () => {
      const lines = eventLines(feed([{ time: '21:00', endTime: '23:30' }]));

      expect(lines).toContain('DTSTART:20261121T000000Z');
      expect(lines).toContain('DTEND:20261121T023000Z');
    });

    it('should end an event the next day when its end is before its start', () => {
      const lines = eventLines(feed([{ time: '22:00', endTime: '02:00' }]));

      expect(lines).toContain('DTSTART:20261121T010000Z');
      expect(lines).toContain('DTEND:20261121T050000Z');
    });

    it("should use the band's default duration when there is no end time", () => {
      const lines = eventLines(feed([{ time: '21:00' }], { defaultEventMinutes: 90 }));

      expect(lines).toContain('DTSTART:20261121T000000Z');
      expect(lines).toContain('DTEND:20261121T013000Z');
    });

    it("should read times in the band's time zone", () => {
      const lines = eventLines(feed([{ time: '21:00' }], { timeZone: 'Europe/Lisbon' }));

      expect(lines).toContain('DTSTART:20261120T210000Z');
    });

    it('should include the event details, escaped', () => {
      const lines = eventLines(
        feed([
          {
            summary: 'Show: Bar do Zé',
            location: 'Rua A, 10',
            description: 'Levar cabos; chegar cedo\n\nhttps://maverick.minhabanda.com/agenda/1',
            categories: 'Show',
            url: 'https://maverick.minhabanda.com/agenda/1',
          },
        ]),
      );

      expect(lines).toEqual(
        expect.arrayContaining([
          'UID:event-1@maverick.minhabanda.com',
          'DTSTAMP:20261109T120000Z',
          'SUMMARY:Show: Bar do Zé',
          'LOCATION:Rua A\\, 10',
          'DESCRIPTION:Levar cabos\\; chegar cedo\\n\\nhttps://maverick.minhabanda.com/agenda/1',
          'CATEGORIES:Show',
          'URL:https://maverick.minhabanda.com/agenda/1',
        ]),
      );
    });

    it('should leave out a missing location', () => {
      expect(eventLines(feed([{ location: null }])).some((line) => line.startsWith('LOCATION'))).toBe(false);
    });
  });
});
