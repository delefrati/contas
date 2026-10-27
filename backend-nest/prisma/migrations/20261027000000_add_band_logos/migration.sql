-- Bands can upload a logo, stored in the row so database backups include it.
-- AlterTable
ALTER TABLE `bands` ADD COLUMN `logo` MEDIUMBLOB NULL,
    ADD COLUMN `logo_type` VARCHAR(20) NULL,
    ADD COLUMN `logo_updated_at` DATETIME(3) NULL;

