import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SongService } from './song.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

describe('SongService', () => {
  let service: SongService;
  let prisma: {
    song: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let logService: { log: jest.Mock };

  const createdAt = new Date('2026-10-01T12:00:00Z');
  const baseSong = {
    id: 3,
    bandId: 1,
    title: 'Exagerado',
    artist: 'Cazuza',
    notes: null,
    lyrics: null,
    deletedAt: null,
    createdAt,
  };

  beforeEach(async () => {
    prisma = {
      song: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...baseSong, ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...baseSong, ...data })),
      },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SongService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: RequestContextService, useValue: { requireBandId: jest.fn().mockReturnValue(1) } },
      ],
    }).compile();

    service = module.get<SongService>(SongService);
  });

  it('should only tell whether each song has lyrics in the list', async () => {
    prisma.song.findMany.mockResolvedValue([
      { ...baseSong, lyrics: 'Amor da minha vida' },
      { ...baseSong, id: 4, title: 'Malandragem' },
    ]);

    const songs = await service.findAll();

    expect(songs.map((s) => [s.id, s.hasLyrics])).toEqual([[3, true], [4, false]]);
    expect(songs[0]).not.toHaveProperty('lyrics');
  });

  it('should return the lyrics of a single song of the band', async () => {
    prisma.song.findFirst.mockResolvedValue({ ...baseSong, lyrics: 'Amor da minha vida' });

    const song = await service.findOne(3);

    expect(song.lyrics).toBe('Amor da minha vida');
    expect(prisma.song.findFirst).toHaveBeenCalledWith({
      where: { id: 3, bandId: 1, deletedAt: null },
    });
  });

  it('should not find songs of other bands or deleted ones', async () => {
    prisma.song.findFirst.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });

  it('should keep the blank lines between verses and drop trailing spaces', async () => {
    prisma.song.findFirst.mockResolvedValue(baseSong);

    const song = await service.update(3, { lyrics: '\r\n\r\nAmor da minha vida  \r\nDaqui até a eternidade\r\n\r\nNossos destinos\n\n' });

    expect(song.lyrics).toBe('Amor da minha vida\nDaqui até a eternidade\n\nNossos destinos');
    expect(song.hasLyrics).toBe(true);
  });

  it('should clear lyrics left blank', async () => {
    prisma.song.findFirst.mockResolvedValue({ ...baseSong, lyrics: 'Amor da minha vida' });

    const song = await service.update(3, { lyrics: '  \n ' });

    expect(prisma.song.update.mock.calls[0][0].data.lyrics).toBeNull();
    expect(song.hasLyrics).toBe(false);
  });

  it('should log that the lyrics changed without copying them', async () => {
    prisma.song.findFirst.mockResolvedValue(baseSong);

    await service.update(3, { title: 'Exagerado', lyrics: 'Amor da minha vida' });

    expect(logService.log).toHaveBeenCalledWith('UPDATE', 'song', 3, { title: 'Exagerado', lyricsChanged: true });
  });

  it('should save lyrics given when creating a song', async () => {
    const song = await service.create({ title: 'Exagerado', lyrics: 'Amor da minha vida\n' });

    expect(song.lyrics).toBe('Amor da minha vida');
  });
});
