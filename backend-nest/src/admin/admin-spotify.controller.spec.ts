import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { AdminSpotifyController } from './admin.controller';
import { AdminRequest } from './admin-auth.guard';
import { BandService } from '../band/band.service';
import { SpotifyService } from '../spotify/spotify.service';

describe('AdminSpotifyController', () => {
  let spotifyService: { finishConnect: jest.Mock; startConnect: jest.Mock };
  let bandService: { isCentralHost: jest.Mock };
  let controller: AdminSpotifyController;
  const res = { redirect: jest.fn() } as unknown as Response;

  beforeEach(() => {
    spotifyService = {
      finishConnect: jest.fn().mockResolvedValue('/admin/spotify?spotify=connected'),
      startConnect: jest.fn().mockReturnValue('https://accounts.spotify.com/authorize?state=s'),
    };
    bandService = { isCentralHost: jest.fn().mockReturnValue(true) };
    controller = new AdminSpotifyController(
      spotifyService as unknown as SpotifyService,
      bandService as unknown as BandService,
    );
    (res.redirect as jest.Mock).mockClear();
  });

  it('should send the browser where the connect flow ends', async () => {
    const req = { headers: { host: 'minhabanda.com' } } as AdminRequest;

    await controller.callback(req, { code: 'c', state: 's' }, res);

    expect(spotifyService.finishConnect).toHaveBeenCalledWith({ code: 'c', state: 's' });
    expect(res.redirect).toHaveBeenCalledWith(302, '/admin/spotify?spotify=connected');
  });

  it('should not answer the callback on a band subdomain', async () => {
    bandService.isCentralHost.mockReturnValue(false);
    const req = { headers: { host: 'maverick.minhabanda.com' } } as AdminRequest;

    await expect(controller.callback(req, { code: 'c', state: 's' }, res)).rejects.toThrow(NotFoundException);
    expect(spotifyService.finishConnect).not.toHaveBeenCalled();
  });

  it('should start the connect for the signed-in super admin, from the page it was asked on', () => {
    const req = { headers: { origin: 'https://minhabanda.com' }, admin: { superAdminId: 3 } } as unknown as AdminRequest;

    expect(controller.connect(req)).toEqual({ data: { url: 'https://accounts.spotify.com/authorize?state=s' } });
    expect(spotifyService.startConnect).toHaveBeenCalledWith(3, 'https://minhabanda.com');
  });
});
