-- DropIndex
DROP INDEX `repertoire_songs_repertoire_id_song_id_key` ON `repertoire_songs`;

-- AlterTable: allow pause entries (null song_id) and add an entry type
ALTER TABLE `repertoire_songs`
    MODIFY `song_id` INTEGER NULL,
    ADD COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'song';

-- CreateIndex
CREATE INDEX `repertoire_songs_song_id_idx` ON `repertoire_songs`(`song_id`);
