-- AlterTable: allow an optional custom label on pause entries (e.g. "BIS")
ALTER TABLE `repertoire_songs`
    ADD COLUMN `label` VARCHAR(255) NULL;
