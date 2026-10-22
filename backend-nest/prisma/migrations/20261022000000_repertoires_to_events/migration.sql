-- Setlists become calendar events, each with its own setlist and a type the band
-- registers (show, rehearsal, get-together...). Existing setlists are kept as shows
-- on the same date.

-- CreateTable
CREATE TABLE `event_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `band_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `color` VARCHAR(7) NOT NULL DEFAULT '#667eea',
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_types_band_id_idx`(`band_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Every band starts with shows and rehearsals
INSERT INTO `event_types` (`band_id`, `name`, `color`) SELECT `id`, 'Show', '#667eea' FROM `bands`;
INSERT INTO `event_types` (`band_id`, `name`, `color`) SELECT `id`, 'Ensaio', '#48bb78' FROM `bands`;

-- DropForeignKey
ALTER TABLE `repertoires` DROP FOREIGN KEY `repertoires_band_id_fkey`;
ALTER TABLE `repertoire_songs` DROP FOREIGN KEY `repertoire_songs_repertoire_id_fkey`;
ALTER TABLE `repertoire_songs` DROP FOREIGN KEY `repertoire_songs_song_id_fkey`;

-- RenameTable
RENAME TABLE `repertoires` TO `events`, `repertoire_songs` TO `event_songs`;

-- AlterTable
ALTER TABLE `events`
    CHANGE COLUMN `name` `title` VARCHAR(255) NOT NULL DEFAULT '',
    MODIFY `date` VARCHAR(10) NOT NULL,
    ADD COLUMN `type_id` INTEGER NULL,
    ADD COLUMN `time` VARCHAR(5) NOT NULL DEFAULT '',
    ADD COLUMN `location` VARCHAR(255) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD INDEX `events_band_id_date_idx`(`band_id`, `date`),
    ADD INDEX `events_type_id_idx`(`type_id`),
    DROP INDEX `repertoires_band_id_idx`;

UPDATE `events` e
    JOIN `event_types` t ON t.`band_id` = e.`band_id` AND t.`name` = 'Show'
    SET e.`type_id` = t.`id`;

ALTER TABLE `events` MODIFY `type_id` INTEGER NOT NULL;

ALTER TABLE `event_songs`
    RENAME COLUMN `repertoire_id` TO `event_id`,
    RENAME INDEX `repertoire_songs_repertoire_id_idx` TO `event_songs_event_id_idx`,
    RENAME INDEX `repertoire_songs_song_id_idx` TO `event_songs_song_id_idx`;

-- AddForeignKey
ALTER TABLE `event_types` ADD CONSTRAINT `event_types_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `events` ADD CONSTRAINT `events_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `events` ADD CONSTRAINT `events_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `event_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `event_songs` ADD CONSTRAINT `event_songs_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `event_songs` ADD CONSTRAINT `event_songs_song_id_fkey` FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
