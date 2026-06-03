-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `date` VARCHAR(10) NOT NULL DEFAULT '';

-- Backfill existing rows: use the date portion of created_at
UPDATE `expenses` SET `date` = LEFT(`created_at`, 10) WHERE `date` = '';
