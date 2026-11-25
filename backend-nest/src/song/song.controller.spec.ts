import { describeRequestBodies } from '../common/request-validation.testing';
import { SongController } from './song.controller';
import { SongService } from './song.service';

const resolves = () => jest.fn().mockResolvedValue({ id: 1 });

describeRequestBodies(
  'SongController',
  () => ({
    controllers: [SongController],
    services: [[SongService, { create: resolves(), update: resolves(), importMany: resolves() }]],
  }),
  {
    accepts: [
      // Songs page's form, and SpotifyPlaylist's link
      ['a new song from the form', 'post', '/api/songs', {
        title: 'Garota de Ipanema', artist: 'Tom Jobim', notes: '', spotifyUrl: '', lyrics: 'Olha que coisa…',
      }],
      ['a song without its lyrics', 'patch', '/api/songs/1', { title: 'Garota', artist: '', notes: '', spotifyUrl: '' }],
      ['a Spotify link', 'patch', '/api/songs/1', { spotifyUrl: 'https://open.spotify.com/track/abc' }],
      ['an import as text', 'post', '/api/songs/import', { text: 'Garota de Ipanema - Tom Jobim' }],
      ['an import as a list', 'post', '/api/songs/import', { songs: [{ title: 'Garota', artist: 'Tom' }] }],
    ],
    refuses: [
      ['an extra field', 'post', '/api/songs', { title: 'Garota', bandId: 2 }],
      ['no title', 'post', '/api/songs', { artist: 'Tom Jobim' }],
      ['a title that is not text', 'patch', '/api/songs/1', { title: 42 }],
      ['an artist over 255 characters', 'patch', '/api/songs/1', { artist: 'x'.repeat(256) }],
      ['lyrics over the column size', 'patch', '/api/songs/1', { lyrics: 'ã'.repeat(40_000) }],
      ['an import that is not text', 'post', '/api/songs/import', { text: ['Garota'] }],
      ['an extra field in an imported song', 'post', '/api/songs/import', { songs: [{ title: 'Garota', id: 1 }] }],
    ],
  },
);
