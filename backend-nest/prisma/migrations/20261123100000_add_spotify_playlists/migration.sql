-- AlterTable: the Spotify playlist kept for all of a band's songs, and for each event's setlist
ALTER TABLE `bands`
    ADD COLUMN `spotify_playlist_id` VARCHAR(64) NULL;

ALTER TABLE `events`
    ADD COLUMN `spotify_playlist_id` VARCHAR(64) NULL;
