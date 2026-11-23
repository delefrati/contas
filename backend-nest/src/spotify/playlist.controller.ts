import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaylistResultDto, PlaylistService } from './playlist.service';
import { SpotifyService } from './spotify.service';

// The band's side of Spotify: playlists made in the platform's account (MB-16)
@Controller('api/spotify')
@UseGuards(JwtAuthGuard)
export class PlaylistController {
  constructor(
    private playlistService: PlaylistService,
    private spotifyService: SpotifyService,
  ) {}

  @Get('status')
  async status(): Promise<{ data: { availability: 'not-set-up' | 'unavailable' | 'working' } }> {
    return { data: { availability: await this.spotifyService.availability() } };
  }

  @Post('playlists/songs')
  async makeForSongs(): Promise<{ data: PlaylistResultDto }> {
    return { data: await this.playlistService.makeForSongs() };
  }

  @Post('playlists/events/:id')
  async makeForEvent(@Param('id', ParseIntPipe) id: number): Promise<{ data: PlaylistResultDto }> {
    return { data: await this.playlistService.makeForEvent(id) };
  }
}
