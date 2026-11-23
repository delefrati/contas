import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaylistResultDto, PlaylistService } from './playlist.service';
import { SpotifyTrackDto } from './spotify-api';
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

  // Tracks that may be a song's version, to pick one (MB-15): by its title and artist, or by the
  // words a member typed (q)
  @Get('songs/:id/tracks')
  async searchForSong(
    @Param('id', ParseIntPipe) id: number,
    @Query('q') q?: string,
  ): Promise<{ data: SpotifyTrackDto[] }> {
    return { data: await this.playlistService.searchForSong(id, typeof q === 'string' ? q : undefined) };
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
