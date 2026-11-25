import { describeRequestBodies } from '../common/request-validation.testing';
import { EventTypeController } from './event-type.controller';
import { EventTypeService } from './event-type.service';

const resolves = () => jest.fn().mockResolvedValue({ id: 1 });

describeRequestBodies(
  'EventTypeController',
  () => ({
    controllers: [EventTypeController],
    services: [[EventTypeService, { create: resolves(), update: resolves() }]],
  }),
  {
    accepts: [
      // EventTypesModal
      ['a new type', 'post', '/api/event-types', { name: 'Show', color: '#667eea' }],
      ['a renamed type', 'patch', '/api/event-types/1', { name: 'Ensaio', color: '#48bb78' }],
    ],
    refuses: [
      ['an extra field', 'post', '/api/event-types', { name: 'Show', bandId: 2 }],
      ['a name that is not text', 'post', '/api/event-types', { name: 7 }],
      ['no name', 'post', '/api/event-types', { color: '#667eea' }],
      ['a name over 255 characters', 'patch', '/api/event-types/1', { name: 'x'.repeat(256) }],
      ['a color that is not text', 'patch', '/api/event-types/1', { color: 0x667eea }],
    ],
  },
);
