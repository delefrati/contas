import { describeRequestBodies } from '../common/request-validation.testing';
import { EventController } from './event.controller';
import { EventService } from './event.service';

const resolves = () => jest.fn().mockResolvedValue({ id: 1 });

describeRequestBodies(
  'EventController',
  () => ({
    controllers: [EventController],
    services: [[EventService, { create: resolves(), update: resolves() }]],
  }),
  {
    accepts: [
      // EventFormModal
      ['a new event from the form', 'post', '/api/events', {
        typeId: 1, title: 'Show', date: '2026-12-01', time: '20:00', endTime: '', location: 'Bar', notes: '',
      }],
      // EventDetail's copy to a new date, and its setlist saves
      ['a copied setlist', 'post', '/api/events', {
        typeId: 1, date: '2026-12-01', items: [{ type: 'song', songId: 3 }, { type: 'pause', label: 'Intervalo' }],
      }],
      ['a setlist', 'patch', '/api/events/1', { items: [{ type: 'pause', label: '' }] }],
    ],
    refuses: [
      ['an extra field', 'post', '/api/events', { typeId: 1, date: '2026-12-01', bandId: 2 }],
      ['a typeId as text', 'post', '/api/events', { typeId: '1', date: '2026-12-01' }],
      ['no date', 'post', '/api/events', { typeId: 1 }],
      ['a title over 255 characters', 'patch', '/api/events/1', { title: 'x'.repeat(256) }],
      ['notes over the column size', 'patch', '/api/events/1', { notes: 'é'.repeat(40_000) }],
      ['an unknown setlist item type', 'patch', '/api/events/1', { items: [{ type: 'solo' }] }],
      ['an extra field in a setlist item', 'patch', '/api/events/1', { items: [{ type: 'song', songId: 1, eventId: 9 }] }],
      ['items that are not a list', 'patch', '/api/events/1', { items: 'none' }],
      ['a list instead of an object', 'patch', '/api/events/1', [{ title: 'Show' }]],
    ],
  },
);
