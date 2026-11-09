import { NotFoundException } from '@nestjs/common';
import { OfflineService } from './offline.service';

describe('OfflineService', () => {
  const band = { id: 1, slug: 'maverick', name: 'Maverick', logoUrl: null };
  let bandService: { findById: jest.Mock };
  let eventService: { findAllWithSetlists: jest.Mock };
  let eventTypeService: { findAll: jest.Mock };
  let songService: { findAllWithLyrics: jest.Mock };
  let requestContext: { requireBandId: jest.Mock };
  let service: OfflineService;

  beforeEach(() => {
    bandService = { findById: jest.fn().mockResolvedValue(band) };
    eventService = { findAllWithSetlists: jest.fn().mockResolvedValue([{ id: 5 }]) };
    eventTypeService = { findAll: jest.fn().mockResolvedValue([{ id: 1 }]) };
    songService = { findAllWithLyrics: jest.fn().mockResolvedValue([{ id: 9, lyrics: 'la' }]) };
    requestContext = { requireBandId: jest.fn().mockReturnValue(1) };
    service = new OfflineService(
      bandService as never,
      eventService as never,
      eventTypeService as never,
      songService as never,
      requestContext as never,
    );
  });

  it('bundles the band data of the current host', async () => {
    const now = new Date(2026, 10, 9, 12);

    await expect(service.getSnapshot(now)).resolves.toEqual({
      generatedAt: now.toISOString(),
      window: { from: '2026-10-01', to: '2027-11-09' },
      band,
      eventTypes: [{ id: 1 }],
      events: [{ id: 5 }],
      songs: [{ id: 9, lyrics: 'la' }],
    });
    expect(bandService.findById).toHaveBeenCalledWith(1);
    expect(eventService.findAllWithSetlists).toHaveBeenCalledWith('2026-10-01', '2027-11-09');
  });

  it('crosses the year boundary going back a month', async () => {
    await service.getSnapshot(new Date(2027, 0, 15, 12));

    expect(eventService.findAllWithSetlists).toHaveBeenCalledWith('2026-12-01', '2028-01-15');
  });

  it('fails when the band is gone', async () => {
    bandService.findById.mockResolvedValue(null);

    await expect(service.getSnapshot()).rejects.toThrow(NotFoundException);
  });
});
