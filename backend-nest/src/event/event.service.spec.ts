import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventService } from './event.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RequestContextService } from '../common/request-context.service';

describe('EventService', () => {
  let service: EventService;
  let prisma: {
    event: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    eventSong: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    song: {
      findMany: jest.Mock;
    };
    eventType: {
      findFirst: jest.Mock;
    };
  };
  let logService: { log: jest.Mock };
  let requestContext: { requireBandId: jest.Mock };

  const createdAt = new Date('2026-10-01T12:00:00Z');
  const showType = { id: 1, name: 'Show', color: '#667eea' };
  const baseEvent = {
    id: 5,
    bandId: 1,
    typeId: 1,
    type: showType,
    title: 'Bar do Zé',
    date: '2026-10-24',
    time: '21:00',
    location: 'Centro',
    notes: null,
    deletedAt: null,
    createdAt,
  };

  beforeEach(async () => {
    prisma = {
      event: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      eventSong: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      song: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      eventType: {
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve([1, 2].includes(where.id) ? { id: where.id } : null),
        ),
      },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };
    requestContext = { requireBandId: jest.fn().mockReturnValue(1) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: RequestContextService, useValue: requestContext },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  describe('findAll', () => {
    it('should list the band events in chronological order with song counts', async () => {
      prisma.event.findMany.mockResolvedValue([{ ...baseEvent, _count: { setlist: 12 } }]);

      const result = await service.findAll();

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bandId: 1, deletedAt: null },
          orderBy: [{ date: 'asc' }, { time: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(result).toEqual([
        {
          id: 5,
          typeId: 1,
          type: showType,
          title: 'Bar do Zé',
          date: '2026-10-24',
          time: '21:00',
          location: 'Centro',
          notes: null,
          createdAt: createdAt.toISOString(),
          songCount: 12,
        },
      ]);
    });

    it('should filter by date range, ignoring malformed bounds', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll({ from: '2026-10-01', to: 'tomorrow' });

      expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({
        bandId: 1,
        deletedAt: null,
        date: { gte: '2026-10-01' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the setlist with songs and pauses', async () => {
      prisma.event.findFirst.mockResolvedValue({
        ...baseEvent,
        setlist: [
          { id: 1, type: 'song', songId: 3, label: null, position: 0, song: { title: 'Exagerado', artist: 'Cazuza', notes: null, lyrics: 'Amor da minha vida' } },
          { id: 2, type: 'pause', songId: null, label: 'BIS', position: 1, song: null },
        ],
      });

      const result = await service.findOne(5);

      expect(result.songCount).toBe(1);
      expect(result.setlist).toEqual([
        { id: 1, type: 'song', songId: 3, title: 'Exagerado', artist: 'Cazuza', notes: null, lyrics: 'Amor da minha vida', label: null, position: 0 },
        { id: 2, type: 'pause', songId: null, title: null, artist: null, notes: null, lyrics: null, label: 'BIS', position: 1 },
      ]);
    });

    it('should throw NotFoundException for deleted events', async () => {
      prisma.event.findFirst.mockResolvedValue({ ...baseEvent, deletedAt: new Date(), setlist: [] });

      await expect(service.findOne(5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.event.create.mockImplementation(({ data }) => Promise.resolve({ ...baseEvent, ...data, id: 9 }));
      prisma.event.findFirst.mockImplementation(() =>
        Promise.resolve({ ...baseEvent, id: 9, setlist: [] }),
      );
    });

    it('should create an event with defaults for omitted fields', async () => {
      await service.create({ typeId: 2, date: '2026-10-28' });

      expect(prisma.eventType.findFirst).toHaveBeenCalledWith({
        where: { id: 2, bandId: 1, deletedAt: null },
        select: { id: true },
      });
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: {
          bandId: 1,
          typeId: 2,
          title: '',
          date: '2026-10-28',
          time: '',
          location: null,
          notes: null,
        },
      });
      expect(prisma.eventSong.deleteMany).not.toHaveBeenCalled();
      expect(logService.log).toHaveBeenCalledWith('CREATE', 'event', 9, expect.any(Object));
    });

    it('should copy a setlist given as items, keeping only band songs', async () => {
      prisma.song.findMany.mockResolvedValue([{ id: 3 }]);

      await service.create({
        typeId: 1,
        date: '2026-11-07',
        items: [
          { type: 'song', songId: 3 },
          { type: 'pause', label: ' BIS ' },
          { type: 'song', songId: 99 },
          { type: 'song', songId: 3 },
        ],
      });

      expect(prisma.song.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [3, 99, 3] }, bandId: 1, deletedAt: null } }),
      );
      expect(prisma.eventSong.createMany).toHaveBeenCalledWith({
        data: [
          { eventId: 9, songId: 3, type: 'song', label: null, position: 0 },
          { eventId: 9, songId: null, type: 'pause', label: 'BIS', position: 1 },
        ],
      });
    });

    it('should require a valid date', async () => {
      await expect(service.create({ typeId: 1, date: '' })).rejects.toThrow(BadRequestException);
      await expect(service.create({ typeId: 1, date: '24/10/2026' })).rejects.toThrow(BadRequestException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('should reject missing, unknown or deleted types and malformed times', async () => {
      await expect(service.create({ date: '2026-10-24' } as never)).rejects.toThrow(BadRequestException);
      await expect(service.create({ typeId: 99, date: '2026-10-24' })).rejects.toThrow(BadRequestException);
      await expect(service.create({ typeId: 1, date: '2026-10-24', time: '25:00' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update fields and replace the setlist', async () => {
      prisma.event.findFirst
        .mockResolvedValueOnce(baseEvent)
        .mockResolvedValueOnce({ ...baseEvent, setlist: [] });

      await service.update(5, { location: '  ', time: '20:30', items: [] });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { location: null, time: '20:30' },
      });
      expect(prisma.eventSong.deleteMany).toHaveBeenCalledWith({ where: { eventId: 5 } });
      expect(prisma.eventSong.createMany).not.toHaveBeenCalled();
    });

    it('should change the type only to a current type of the band', async () => {
      prisma.event.findFirst
        .mockResolvedValueOnce(baseEvent)
        .mockResolvedValueOnce({ ...baseEvent, setlist: [] });

      await service.update(5, { typeId: 2 });
      expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { typeId: 2 } });

      prisma.event.findFirst.mockResolvedValueOnce(baseEvent);
      await expect(service.update(5, { typeId: 99 })).rejects.toThrow(BadRequestException);
    });

    it('should keep the current type without checking it again', async () => {
      prisma.event.findFirst
        .mockResolvedValueOnce(baseEvent)
        .mockResolvedValueOnce({ ...baseEvent, setlist: [] });

      await service.update(5, { typeId: 1, title: 'Bar do Zé' });

      expect(prisma.eventType.findFirst).not.toHaveBeenCalled();
      expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { title: 'Bar do Zé' } });
    });

    it('should throw NotFoundException for events of another band', async () => {
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(service.update(5, { title: 'x' })).rejects.toThrow(NotFoundException);
      expect(prisma.event.findFirst).toHaveBeenCalledWith({ where: { id: 5, bandId: 1 } });
    });
  });

  describe('delete', () => {
    it('should soft delete the event', async () => {
      prisma.event.findFirst.mockResolvedValue(baseEvent);

      await service.delete(5);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { deletedAt: expect.any(Date) },
      });
      expect(logService.log).toHaveBeenCalledWith('DELETE', 'event', 5, expect.any(Object));
    });

    it('should ignore events already deleted', async () => {
      prisma.event.findFirst.mockResolvedValue({ ...baseEvent, deletedAt: new Date() });

      await service.delete(5);

      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });
});
