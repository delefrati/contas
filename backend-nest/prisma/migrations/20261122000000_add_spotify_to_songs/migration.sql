-- AlterTable: the Spotify track of the version the band plays
ALTER TABLE `songs`
    ADD COLUMN `spotify_track_id` VARCHAR(22) NULL;
