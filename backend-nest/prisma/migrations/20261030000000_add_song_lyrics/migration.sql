-- Songs can have their lyrics written down, to read them in the setlist's phone view.
-- AlterTable
ALTER TABLE `songs` ADD COLUMN `lyrics` TEXT NULL;
